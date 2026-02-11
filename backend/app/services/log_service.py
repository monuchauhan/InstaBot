from typing import Optional, List
import json
from datetime import datetime
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import ActionLog, ActionType


async def create_action_log(
    db: AsyncSession,
    user_id: int,
    action_type: ActionType,
    status: str = "success",
    instagram_account_id: Optional[int] = None,
    comment_id: Optional[str] = None,
    recipient_id: Optional[str] = None,
    message_sent: Optional[str] = None,
    error_message: Optional[str] = None,
    details: Optional[dict] = None,
) -> ActionLog:
    """Create a new action log entry."""
    log = ActionLog(
        user_id=user_id,
        instagram_account_id=instagram_account_id,
        action_type=action_type,
        status=status,
        comment_id=comment_id,
        recipient_id=recipient_id,
        message_sent=message_sent,
        error_message=error_message,
        details=json.dumps(details) if details else None,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def get_user_action_logs(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    action_type: Optional[ActionType] = None,
    status: Optional[str] = None,
) -> tuple[List[ActionLog], int]:
    """Get paginated action logs for a user."""
    query = select(ActionLog).where(ActionLog.user_id == user_id)
    count_query = select(func.count(ActionLog.id)).where(ActionLog.user_id == user_id)
    
    if action_type:
        query = query.where(ActionLog.action_type == action_type)
        count_query = count_query.where(ActionLog.action_type == action_type)
    
    if status:
        query = query.where(ActionLog.status == status)
        count_query = count_query.where(ActionLog.status == status)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    offset = (page - 1) * page_size
    query = query.order_by(desc(ActionLog.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    logs = list(result.scalars().all())
    
    return logs, total


async def get_recent_logs_for_account(
    db: AsyncSession,
    instagram_account_id: int,
    limit: int = 10
) -> List[ActionLog]:
    """Get recent action logs for an Instagram account."""
    result = await db.execute(
        select(ActionLog)
        .where(ActionLog.instagram_account_id == instagram_account_id)
        .order_by(desc(ActionLog.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def check_dm_sent_in_window(
    db: AsyncSession,
    instagram_account_id: int,
    recipient_id: str,
    hours: int = 24
) -> bool:
    """Check if a DM was sent to a recipient within the specified time window."""
    from datetime import timedelta
    
    window_start = datetime.utcnow() - timedelta(hours=hours)
    
    result = await db.execute(
        select(func.count(ActionLog.id)).where(
            ActionLog.instagram_account_id == instagram_account_id,
            ActionLog.recipient_id == recipient_id,
            ActionLog.action_type == ActionType.DM_SENT,
            ActionLog.status == "success",
            ActionLog.created_at >= window_start,
        )
    )
    count = result.scalar()
    return count > 0
