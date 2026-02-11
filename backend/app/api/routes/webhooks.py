import hmac
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db import get_db
from app.worker.tasks import process_comment_event

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify the webhook signature using HMAC SHA-256."""
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
    """Verify Instagram webhook subscription (GET request from Meta)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        return int(hub_challenge)
    
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
    if payload.get("object") == "instagram":
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") == "comments":
                    # Queue the comment event for async processing
                    comment_data = change.get("value", {})
                    process_comment_event.delay(
                        instagram_user_id=entry.get("id"),
                        comment_data=comment_data,
                    )
    
    # Always return 200 OK to acknowledge receipt
    return {"status": "ok"}
