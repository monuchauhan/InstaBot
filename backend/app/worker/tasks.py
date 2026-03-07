import json
import logging
import httpx
from datetime import datetime, timedelta
from typing import Optional
from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.encryption import decrypt_token, encrypt_token
from app.db.models import (
    InstagramAccount, 
    AutomationSettings, 
    ActionLog, 
    AutomationType, 
    ActionType,
    ConversationFlow,
    ConversationStep,
    ConversationState,
)

logger = logging.getLogger(__name__)

# Create sync database session for Celery tasks
# Note: Using sync SQLAlchemy for Celery since Celery doesn't natively support async
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
engine = create_engine(SYNC_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session() -> Session:
    """Get a synchronous database session for Celery tasks."""
    return SessionLocal()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_comment_event(self, instagram_user_id: str, comment_data: dict):
    """
    Process an incoming comment event from Instagram webhook.
    This task determines which automations to trigger.
    """
    logger.info(f"Processing comment event for ig_user={instagram_user_id}, data={json.dumps(comment_data)[:200]}")
    db = get_db_session()
    try:
        # Find the Instagram account
        account = db.query(InstagramAccount).filter(
            InstagramAccount.instagram_user_id == instagram_user_id,
            InstagramAccount.is_active == True
        ).first()
        
        if not account:
            logger.warning(f"Account not found or inactive for ig_user_id={instagram_user_id}")
            return {"status": "skipped", "reason": "Account not found or inactive"}
        
        # Log the webhook event
        log = ActionLog(
            user_id=account.user_id,
            instagram_account_id=account.id,
            action_type=ActionType.WEBHOOK_RECEIVED,
            status="success",
            details=json.dumps(comment_data),
            comment_id=comment_data.get("id"),
        )
        db.add(log)
        db.commit()
        
        # Get the comment details
        comment_id = comment_data.get("id")
        comment_text = comment_data.get("text", "")
        from_user = comment_data.get("from", {})
        commenter_id = from_user.get("id")
        
        # Ignore comments made by the account owner (prevents infinite reply loop)
        if commenter_id == instagram_user_id:
            logger.info(f"Ignoring self-comment from account owner ig_user_id={instagram_user_id}")
            return {"status": "skipped", "reason": "Self-comment ignored"}
        
        # Check for auto-reply comment automation
        auto_reply_settings = db.query(AutomationSettings).filter(
            AutomationSettings.instagram_account_id == account.id,
            AutomationSettings.automation_type == AutomationType.AUTO_REPLY_COMMENT,
            AutomationSettings.is_enabled == True
        ).first()
        
        if auto_reply_settings:
            # Check if comment matches trigger keywords (if any)
            should_reply = True
            if auto_reply_settings.trigger_keywords:
                keywords = json.loads(auto_reply_settings.trigger_keywords)
                should_reply = any(
                    keyword.lower() in comment_text.lower() 
                    for keyword in keywords
                )
            
            if should_reply and auto_reply_settings.template_message:
                logger.info(f"Triggering comment reply: comment_id={comment_id}, reply='{auto_reply_settings.template_message[:50]}'")
                post_comment_reply.delay(
                    account_id=account.id,
                    comment_id=comment_id,
                    reply_text=auto_reply_settings.template_message,
                    user_id=account.user_id,
                )
        
        # Check for send DM automation
        dm_settings = db.query(AutomationSettings).filter(
            AutomationSettings.instagram_account_id == account.id,
            AutomationSettings.automation_type == AutomationType.SEND_DM,
            AutomationSettings.is_enabled == True
        ).first()
        
        if dm_settings and commenter_id:
            # Check if DM matches trigger keywords (if any)
            should_dm = True
            if dm_settings.trigger_keywords:
                keywords = json.loads(dm_settings.trigger_keywords)
                should_dm = any(
                    keyword.lower() in comment_text.lower() 
                    for keyword in keywords
                )
            
            if should_dm and dm_settings.template_message:
                # Get commenter username for personalization
                commenter_username = from_user.get("username", "")
                
                send_dm_with_flow.delay(
                    account_id=account.id,
                    recipient_id=commenter_id,
                    commenter_username=commenter_username,
                    automation_id=dm_settings.id,
                    user_id=account.user_id,
                    comment_id=comment_id,
                )
        
        return {"status": "processed", "comment_id": comment_id}
        
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def post_comment_reply(
    self, 
    account_id: int, 
    comment_id: str, 
    reply_text: str, 
    user_id: int
):
    """
    Post a reply to a comment on Instagram.
    Uses the /{comment_id}/replies endpoint.
    """
    db = get_db_session()
    try:
        account = db.query(InstagramAccount).filter(
            InstagramAccount.id == account_id
        ).first()
        
        if not account:
            return {"status": "failed", "reason": "Account not found"}
        
        access_token = decrypt_token(account.access_token_encrypted)
        
        # Post the reply using Instagram Graph API
        # For Instagram API with Instagram Login: graph.instagram.com
        with httpx.Client() as client:
            response = client.post(
                f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/{comment_id}/replies",
                params={
                    "message": reply_text,
                    "access_token": access_token,
                }
            )
            
            logger.info(f"Comment reply response: status={response.status_code}, body={response.text[:200]}")
            
            if response.status_code == 200:
                result = response.json()
                
                # Log successful reply
                log = ActionLog(
                    user_id=user_id,
                    instagram_account_id=account_id,
                    action_type=ActionType.COMMENT_REPLY,
                    status="success",
                    comment_id=comment_id,
                    message_sent=reply_text,
                    details=json.dumps(result),
                )
                db.add(log)
                db.commit()
                
                return {"status": "success", "reply_id": result.get("id")}
            else:
                error_msg = response.text
                
                # Log failed reply
                log = ActionLog(
                    user_id=user_id,
                    instagram_account_id=account_id,
                    action_type=ActionType.COMMENT_REPLY,
                    status="failed",
                    comment_id=comment_id,
                    message_sent=reply_text,
                    error_message=error_msg,
                )
                db.add(log)
                db.commit()
                
                raise Exception(f"Failed to post reply: {error_msg}")
                
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_dm(
    self,
    account_id: int,
    recipient_id: str,
    message_text: str,
    user_id: int,
    comment_id: Optional[str] = None,
):
    """
    Send a DM to a user on Instagram.
    Uses the /me/messages endpoint and respects the 24-hour messaging window.
    """
    db = get_db_session()
    try:
        account = db.query(InstagramAccount).filter(
            InstagramAccount.id == account_id
        ).first()
        
        if not account:
            return {"status": "failed", "reason": "Account not found"}
        
        # Check if we've already sent a DM to this user recently (respect 24-hour rule)
        from datetime import timedelta
        recent_dm = db.query(ActionLog).filter(
            ActionLog.instagram_account_id == account_id,
            ActionLog.recipient_id == recipient_id,
            ActionLog.action_type == ActionType.DM_SENT,
            ActionLog.status == "success",
            ActionLog.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).first()
        
        if recent_dm:
            log = ActionLog(
                user_id=user_id,
                instagram_account_id=account_id,
                action_type=ActionType.DM_SENT,
                status="skipped",
                recipient_id=recipient_id,
                message_sent=message_text,
                details=json.dumps({"reason": "Already sent DM within 24 hours"}),
            )
            db.add(log)
            db.commit()
            return {"status": "skipped", "reason": "Already sent DM within 24 hours"}
        
        access_token = decrypt_token(account.access_token_encrypted)
        
        # Send DM — use Private Reply (comment_id recipient) when triggered
        # by a comment, otherwise use the regular messaging endpoint.
        if comment_id:
            with httpx.Client() as client:
                response = client.post(
                    f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/messages",
                    params={"access_token": access_token},
                    json={
                        "recipient": {"comment_id": comment_id},
                        "message": {"text": message_text},
                    },
                )
        else:
            with httpx.Client() as client:
                response = client.post(
                    f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/messages",
                    params={"access_token": access_token},
                    json={
                        "recipient": {"id": recipient_id},
                        "message": {"text": message_text},
                    }
                )
            
        logger.info(f"DM send response: status={response.status_code}, body={response.text[:200]}")
            
        if response.status_code == 200:
            result = response.json()
            
            # Log successful DM
            log = ActionLog(
                user_id=user_id,
                instagram_account_id=account_id,
                action_type=ActionType.DM_SENT,
                status="success",
                recipient_id=recipient_id,
                message_sent=message_text,
                comment_id=comment_id,
                details=json.dumps(result),
            )
            db.add(log)
            db.commit()
            
            return {"status": "success", "message_id": result.get("message_id")}
        else:
            error_msg = response.text
            
            # Log failed DM
            log = ActionLog(
                user_id=user_id,
                instagram_account_id=account_id,
                action_type=ActionType.DM_SENT,
                status="failed",
                recipient_id=recipient_id,
                message_sent=message_text,
                comment_id=comment_id,
                error_message=error_msg,
            )
            db.add(log)
            db.commit()
            
            raise Exception(f"Failed to send DM: {error_msg}")
                
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


def _personalize_message(template: str, username: str) -> str:
    """Replace {username} placeholder with the actual username."""
    return template.replace("{username}", username or "there")


def _build_dm_payload(
    recipient_id: str,
    message_text: str,
    quick_replies: Optional[list] = None,
) -> dict:
    """Build the Instagram Messaging API payload.
    
    Supports plain text and quick-reply buttons.
    Instagram quick_reply format:
    {
        "content_type": "text",
        "title": "Button Label",
        "payload": "INTERNAL_PAYLOAD"
    }
    """
    message = {"text": message_text}
    
    if quick_replies:
        message["quick_replies"] = [
            {
                "content_type": "text",
                "title": qr["title"],
                "payload": qr["payload"],
            }
            for qr in quick_replies
        ]
    
    return {
        "recipient": {"id": recipient_id},
        "message": message,
    }


def _send_instagram_dm(
    access_token: str,
    recipient_id: str,
    message_text: str,
    quick_replies: Optional[list] = None,
) -> dict:
    """Send a DM via the Instagram Messaging API. Returns the API response dict."""
    payload = _build_dm_payload(recipient_id, message_text, quick_replies)
    
    with httpx.Client() as client:
        response = client.post(
            f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/messages",
            params={"access_token": access_token},
            json=payload,
        )
        
        logger.info(f"DM send response: status={response.status_code}, body={response.text[:200]}")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Instagram API error {response.status_code}: {response.text}")


def _send_private_reply(
    access_token: str,
    comment_id: str,
    message_text: str,
) -> dict:
    """Send a Private Reply DM in response to a comment.

    Uses POST /me/messages with recipient.comment_id which does NOT require
    the 24-hour messaging window.  This is the correct way to DM someone
    who commented on your post but has not messaged you first.

    Docs: https://developers.facebook.com/docs/instagram-platform/private-replies

    Note: Private Replies only support plain text (no quick_replies / buttons).
    Only one private reply can be sent per comment, within 7 days.
    """
    with httpx.Client() as client:
        response = client.post(
            f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/messages",
            params={"access_token": access_token},
            json={
                "recipient": {"comment_id": comment_id},
                "message": {"text": message_text},
            },
        )

        logger.info(
            f"Private reply response: status={response.status_code}, "
            f"body={response.text[:200]}"
        )

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(
                f"Instagram API error {response.status_code}: {response.text}"
            )


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_dm_with_flow(
    self,
    account_id: int,
    recipient_id: str,
    commenter_username: str,
    automation_id: int,
    user_id: int,
    comment_id: Optional[str] = None,
):
    """
    Send a DM with optional conversation flow (quick reply buttons).
    
    Flow:
    1. Look up the conversation flow for this automation
    2. Send the initial message (personalized with {username})
    3. If the flow has root-level steps with quick replies, include them
    4. Create a ConversationState to track the user's position
    """
    from app.services.conversation_service import get_or_create_state_sync
    
    db = get_db_session()
    try:
        account = db.query(InstagramAccount).filter(
            InstagramAccount.id == account_id
        ).first()
        
        if not account:
            return {"status": "failed", "reason": "Account not found"}
        
        # Check 24-hour DM window
        recent_dm = db.query(ActionLog).filter(
            ActionLog.instagram_account_id == account_id,
            ActionLog.recipient_id == recipient_id,
            ActionLog.action_type == ActionType.DM_SENT,
            ActionLog.status == "success",
            ActionLog.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).first()
        
        if recent_dm:
            log = ActionLog(
                user_id=user_id,
                instagram_account_id=account_id,
                action_type=ActionType.DM_SENT,
                status="skipped",
                recipient_id=recipient_id,
                details=json.dumps({"reason": "Already sent DM within 24 hours"}),
            )
            db.add(log)
            db.commit()
            return {"status": "skipped", "reason": "Already sent DM within 24 hours"}
        
        # Get the automation settings for template fallback
        automation = db.query(AutomationSettings).filter(
            AutomationSettings.id == automation_id
        ).first()
        
        if not automation:
            return {"status": "failed", "reason": "Automation not found"}
        
        access_token = decrypt_token(account.access_token_encrypted)
        
        # Check if there's a conversation flow
        flow = db.query(ConversationFlow).filter(
            ConversationFlow.automation_id == automation_id
        ).first()
        
        if flow:
            # Use the flow's initial message
            message_text = _personalize_message(flow.initial_message, commenter_username)
            
            # Get root-level steps (quick reply options for the initial message)
            root_steps = db.query(ConversationStep).filter(
                ConversationStep.flow_id == flow.id,
                ConversationStep.parent_step_id.is_(None),
            ).order_by(ConversationStep.step_order).all()
            
            # Build quick replies from root steps
            quick_replies = None
            if root_steps:
                quick_replies = []
                for step in root_steps:
                    if step.payload_trigger:
                        quick_replies.append({
                            "title": step.payload_trigger.replace("_", " ").title()[:20],
                            "payload": step.payload_trigger,
                        })
            
            # Send the DM — use Private Replies when triggered by a comment
            if comment_id:
                # Private Replies API doesn't support quick_replies (text only).
                result = _send_private_reply(access_token, comment_id, message_text)
                
                # After a successful private reply the messaging window is open.
                # Send a follow-up message with quick-reply buttons so the user
                # can continue the conversation flow.
                if quick_replies:
                    import time
                    time.sleep(1)  # Brief pause to ensure message ordering
                    try:
                        followup_text = "Please choose an option below:"
                        _send_instagram_dm(
                            access_token, recipient_id, followup_text, quick_replies,
                        )
                        logger.info(
                            f"Sent follow-up quick replies to recipient={recipient_id}"
                        )
                    except Exception as followup_err:
                        # Log but don't fail the whole task — the initial DM was sent
                        logger.warning(
                            f"Failed to send follow-up quick replies: {followup_err}"
                        )
            else:
                result = _send_instagram_dm(access_token, recipient_id, message_text, quick_replies)
            
            # Create conversation state to track this user
            get_or_create_state_sync(db, account.id, recipient_id, flow.id)
            
        else:
            # No flow - send simple personalized DM using template_message
            message_text = _personalize_message(
                automation.template_message or "Hi {username}!",
                commenter_username,
            )
            if comment_id:
                result = _send_private_reply(access_token, comment_id, message_text)
            else:
                result = _send_instagram_dm(access_token, recipient_id, message_text)
        
        # Log successful DM
        log = ActionLog(
            user_id=user_id,
            instagram_account_id=account_id,
            action_type=ActionType.DM_SENT,
            status="success",
            recipient_id=recipient_id,
            message_sent=message_text,
            comment_id=comment_id,
            details=json.dumps(result),
        )
        db.add(log)
        db.commit()
        
        return {"status": "success", "message_id": result.get("message_id")}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to send DM with flow: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_dm_response(
    self,
    instagram_account_ig_id: str,
    sender_id: str,
    message_text: str,
    quick_reply_payload: Optional[str] = None,
):
    """
    Process an incoming DM response from a user in a conversation flow.
    
    When a user taps a quick reply button, Instagram sends a messaging webhook
    with the payload. We look up the conversation state, find the next step,
    and send the appropriate response.
    """
    from app.services.conversation_service import (
        get_active_state_sync,
        find_next_step_sync,
    )
    
    db = get_db_session()
    try:
        # Find the Instagram account
        account = db.query(InstagramAccount).filter(
            InstagramAccount.instagram_user_id == instagram_account_ig_id,
            InstagramAccount.is_active == True,
        ).first()
        
        if not account:
            logger.warning(f"Account not found for ig_user_id={instagram_account_ig_id}")
            return {"status": "skipped", "reason": "Account not found"}
        
        # Ignore messages from the account owner (echo)
        if sender_id == instagram_account_ig_id:
            return {"status": "skipped", "reason": "Self-message ignored"}
        
        # Get active conversation state for this sender
        state = get_active_state_sync(db, account.id, sender_id)
        
        if not state:
            logger.info(f"No active conversation state for sender={sender_id}")
            return {"status": "skipped", "reason": "No active conversation"}
        
        # Use the quick_reply payload if available, otherwise try to match message text
        payload = quick_reply_payload or message_text.upper().replace(" ", "_")
        
        # Find the next step
        next_step = find_next_step_sync(
            db, state.flow_id, state.current_step_id, payload
        )
        
        if not next_step:
            logger.info(f"No matching step for payload='{payload}' in flow={state.flow_id}")
            # Log the unmatched response
            log = ActionLog(
                user_id=account.user_id,
                instagram_account_id=account.id,
                action_type=ActionType.DM_RESPONSE,
                status="skipped",
                recipient_id=sender_id,
                message_sent=message_text,
                details=json.dumps({"reason": "No matching step", "payload": payload}),
            )
            db.add(log)
            db.commit()
            return {"status": "skipped", "reason": "No matching step"}
        
        access_token = decrypt_token(account.access_token_encrypted)
        
        # Personalize the step message
        # We don't have the username readily here, so we use a fallback
        personalized_message = next_step.message_text  # Steps can also use {username}
        
        # Build quick replies for this step (from its child steps)
        quick_replies = None
        if not next_step.is_end_step:
            child_steps = db.query(ConversationStep).filter(
                ConversationStep.flow_id == state.flow_id,
                ConversationStep.parent_step_id == next_step.id,
            ).order_by(ConversationStep.step_order).all()
            
            if child_steps:
                quick_replies = [
                    {
                        "title": cs.payload_trigger.replace("_", " ").title()[:20] if cs.payload_trigger else f"Option {cs.step_order}",
                        "payload": cs.payload_trigger or f"STEP_{cs.id}",
                    }
                    for cs in child_steps
                ]
            
            # Also check if this step itself has quick_replies defined
            if next_step.quick_replies and not quick_replies:
                quick_replies = next_step.quick_replies
        
        # Send the response
        result = _send_instagram_dm(access_token, sender_id, personalized_message, quick_replies)
        
        # Update conversation state
        state.current_step_id = next_step.id
        if next_step.is_end_step:
            state.is_active = False
        state.updated_at = datetime.utcnow()
        
        # Log the DM response
        log = ActionLog(
            user_id=account.user_id,
            instagram_account_id=account.id,
            action_type=ActionType.DM_SENT,
            status="success",
            recipient_id=sender_id,
            message_sent=personalized_message,
            details=json.dumps({
                "flow_step": next_step.id,
                "trigger_payload": payload,
                "api_response": result,
            }),
        )
        db.add(log)
        db.commit()
        
        return {"status": "success", "step_id": next_step.id}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to process DM response: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task
def refresh_instagram_tokens():
    """
    Periodic task to refresh Instagram access tokens before they expire.
    Should be scheduled to run daily.
    """
    db = get_db_session()
    try:
        from datetime import timedelta
        
        # Find accounts with tokens expiring in the next 7 days
        expiring_soon = datetime.utcnow() + timedelta(days=7)
        accounts = db.query(InstagramAccount).filter(
            InstagramAccount.is_active == True,
            InstagramAccount.token_expires_at <= expiring_soon
        ).all()
        
        for account in accounts:
            try:
                access_token = decrypt_token(account.access_token_encrypted)
                
                # Use Instagram Login token refresh endpoint
                with httpx.Client() as client:
                    response = client.get(
                        f"https://graph.instagram.com/refresh_access_token",
                        params={
                            "grant_type": "ig_refresh_token",
                            "access_token": access_token,
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        new_token = data["access_token"]
                        expires_in = data.get("expires_in", 5184000)
                        
                        account.access_token_encrypted = encrypt_token(new_token)
                        account.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                        db.commit()
                        logger.info(f"Token refreshed for account {account.id}")
                    else:
                        logger.error(f"Token refresh failed for account {account.id}: {response.text}")
                        
            except Exception as e:
                # Log error but continue with other accounts
                logger.error(f"Failed to refresh token for account {account.id}: {e}")
                continue
                
        return {"status": "completed", "accounts_processed": len(accounts)}
        
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
