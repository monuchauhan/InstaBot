from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, User, ActionType
from app.schemas import ActionLogListResponse, ActionLogResponse
from app.services import get_user_action_logs
from app.api.deps import get_current_user

router = APIRouter(prefix="/logs", tags=["Action Logs"])


@router.get("", response_model=ActionLogListResponse)
async def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action_type: Optional[ActionType] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated action logs for the current user."""
    logs, total = await get_user_action_logs(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        action_type=action_type,
        status=status,
    )
    
    return ActionLogListResponse(
        logs=[ActionLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )
