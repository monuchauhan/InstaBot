import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db import get_db
from app.worker.tasks import process_comment_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify the webhook signature using HMAC SHA-256."""
    if not settings.META_APP_SECRET:
        logger.warning("META_APP_SECRET not configured, skipping signature verification")
        return False
    expected_signature = hmac.new(
        settings.META_APP_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected_signature}", signature)


@router.get("/instagram")
async def verify_instagram_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    """Verify Instagram webhook subscription (GET request from Meta).
    
    Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
    We must respond with the hub.challenge value as plain text with 200 status.
    """
    logger.info(f"Webhook verification request: mode={hub_mode}, token={hub_verify_token[:4]}...")
    
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        logger.info("Webhook verification successful")
        # Meta requires the challenge returned as plain text, NOT JSON
        return PlainTextResponse(content=hub_challenge, status_code=200)
    
    logger.warning("Webhook verification failed: token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/instagram")
async def handle_instagram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle incoming Instagram webhook events."""
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Process the webhook event
    logger.info(f"Webhook received: object={payload.get('object')}, entries={len(payload.get('entry', []))}")
    
    if payload.get("object") == "instagram":
        for entry in payload.get("entry", []):
            ig_user_id = entry.get("id")
            
            # Handle changes-based webhooks (comments, mentions, etc.)
            for change in entry.get("changes", []):
                field = change.get("field")
                logger.info(f"Webhook change: field={field}, ig_user_id={ig_user_id}")
                
                if field == "comments":
                    comment_data = change.get("value", {})
                    process_comment_event.delay(
                        instagram_user_id=ig_user_id,
                        comment_data=comment_data,
                    )
                elif field == "mentions":
                    logger.info(f"Mention event received for {ig_user_id}")
                    # Could add mention processing here
            
            # Handle messaging webhooks (different structure)
            for messaging_event in entry.get("messaging", []):
                logger.info(f"Messaging event received for {ig_user_id}: {json.dumps(messaging_event)[:200]}")
    else:
        logger.warning(f"Unexpected webhook object type: {payload.get('object')}")
    
    # Always return 200 OK to acknowledge receipt
    return {"status": "ok"}
