import json
import logging
import random
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
    ActionType,
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
    Finds the matching automation and triggers both a comment reply
    and a DM to the commenter.
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
        
        # Get the media (post) this comment belongs to
        media_data = comment_data.get("media", {})
        media_id = media_data.get("id")  # Instagram media ID of the post
        
        # Ignore comments made by the account owner (prevents infinite reply loop)
        if commenter_id == instagram_user_id:
            logger.info(f"Ignoring self-comment from account owner ig_user_id={instagram_user_id}")
            return {"status": "skipped", "reason": "Self-comment ignored"}
        
        # Find matching automation: post-specific first, then generic
        automation = None
        if media_id:
            automation = db.query(AutomationSettings).filter(
                AutomationSettings.instagram_account_id == account.id,
                AutomationSettings.is_enabled == True,
                AutomationSettings.target_post_id == media_id,
            ).first()
        if not automation:
            # Fall back to generic (no post-specific) automation
            automation = db.query(AutomationSettings).filter(
                AutomationSettings.instagram_account_id == account.id,
                AutomationSettings.is_enabled == True,
                AutomationSettings.target_post_id.is_(None),
            ).first()
        
        if not automation:
            logger.info(f"No matching automation for account={account.id}")
            return {"status": "skipped", "reason": "No matching automation"}
        
        # Check if comment matches trigger keywords (if any)
        should_trigger = True
        if automation.trigger_keywords:
            keywords = json.loads(automation.trigger_keywords)
            should_trigger = any(
                keyword.lower() in comment_text.lower() 
                for keyword in keywords
            )
        
        if not should_trigger:
            return {"status": "skipped", "reason": "No keyword match"}
        
        # Trigger comment reply if template_messages is set
        if automation.template_messages:
            templates = json.loads(automation.template_messages)
            reply_text = random.choice(templates) if templates else None
            if reply_text:
                logger.info(f"Triggering comment reply: comment_id={comment_id}, reply='{reply_text[:50]}'")
                post_comment_reply.delay(
                    account_id=account.id,
                    comment_id=comment_id,
                    reply_text=reply_text,
                    user_id=account.user_id,
                )
        
        # Trigger DM if dm_greeting is set and we have a commenter ID
        if automation.dm_greeting and commenter_id:
            commenter_username = from_user.get("username", "")
            dm_links = json.loads(automation.dm_links) if automation.dm_links else []
            send_dm.delay(
                account_id=account.id,
                recipient_id=commenter_id,
                message_text=_personalize_message(automation.dm_greeting, commenter_username),
                user_id=account.user_id,
                comment_id=comment_id,
                recipient_username=commenter_username,
                links=dm_links,
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
    recipient_username: Optional[str] = None,
    links: Optional[list] = None,
):
    """
    Send a DM to a user on Instagram.
    Sends greeting first (as private reply when comment_id is present),
    then follows up with links as a second plain-text message.
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
                recipient_username=recipient_username,
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
                recipient_username=recipient_username,
                message_sent=message_text,
                comment_id=comment_id,
                details=json.dumps(result),
            )
            db.add(log)
            db.commit()
            
            # Send links as a follow-up message (always via regular messaging, not private reply)
            if links:
                links_text = "\n".join(links)
                with httpx.Client() as client:
                    links_response = client.post(
                        f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/messages",
                        params={"access_token": access_token},
                        json={
                            "recipient": {"id": recipient_id},
                            "message": {"text": links_text},
                        }
                    )
                
                logger.info(f"DM links response: status={links_response.status_code}, body={links_response.text[:200]}")
                
                links_log = ActionLog(
                    user_id=user_id,
                    instagram_account_id=account_id,
                    action_type=ActionType.DM_SENT,
                    status="success" if links_response.status_code == 200 else "failed",
                    recipient_id=recipient_id,
                    recipient_username=recipient_username,
                    message_sent=links_text,
                    comment_id=comment_id,
                    details=json.dumps(links_response.json()) if links_response.status_code == 200 else None,
                    error_message=links_response.text if links_response.status_code != 200 else None,
                )
                db.add(links_log)
                db.commit()
                
                if links_response.status_code != 200:
                    logger.warning(f"Failed to send links DM: {links_response.text}")
            
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
                recipient_username=recipient_username,
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
