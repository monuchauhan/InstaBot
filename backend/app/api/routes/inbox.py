"""Inbox API routes – conversation threads from automation logs."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.services.inbox_service import get_conversations, get_conversation_messages

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/conversations")
async def list_conversations(
    filter_type: str | None = Query(None, description="comments | dms | automated"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List conversation threads grouped by recipient."""
    return await get_conversations(db, current_user.id, filter_type, page, page_size)


@router.get("/conversations/{recipient_id}/messages")
async def list_messages(
    recipient_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get message history for a specific conversation."""
    return await get_conversation_messages(db, current_user.id, recipient_id, page, page_size)
