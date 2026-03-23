"""Inbox service – aggregates ActionLog entries into conversation threads."""

from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActionLog, ActionType


async def get_conversations(
    db: AsyncSession,
    user_id: int,
    filter_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    """Return conversations grouped by recipient_id.

    Each conversation contains the latest message, total message count,
    and the most recent timestamp.
    """

    # Sub-query: latest log per recipient
    sub = (
        select(
            ActionLog.recipient_id,
            func.max(ActionLog.id).label("latest_id"),
            func.count(ActionLog.id).label("total_messages"),
        )
        .where(
            and_(
                ActionLog.user_id == user_id,
                ActionLog.recipient_id.isnot(None),
                ActionLog.recipient_id != "",
            )
        )
        .group_by(ActionLog.recipient_id)
    )

    if filter_type == "comments":
        sub = sub.where(ActionLog.action_type == ActionType.COMMENT_REPLY)
    elif filter_type == "dms":
        sub = sub.where(
            or_(
                ActionLog.action_type == ActionType.DM_SENT,
                ActionLog.action_type == ActionType.DM_RESPONSE,
            )
        )
    elif filter_type == "automated":
        sub = sub.where(
            ActionLog.action_type.in_([ActionType.DM_SENT, ActionType.COMMENT_REPLY])
        )

    sub = sub.subquery()

    # Total count
    count_q = select(func.count()).select_from(sub)
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # Fetch paginated conversation summaries
    conversations_q = (
        select(
            sub.c.recipient_id,
            sub.c.latest_id,
            sub.c.total_messages,
        )
        .order_by(desc(sub.c.latest_id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(conversations_q)).all()

    # Fetch the actual latest log for each conversation
    if not rows:
        return {"conversations": [], "total": total, "page": page, "page_size": page_size}

    latest_ids = [r.latest_id for r in rows]
    logs_q = select(ActionLog).where(ActionLog.id.in_(latest_ids))
    logs_result = await db.execute(logs_q)
    logs_map = {log.id: log for log in logs_result.scalars().all()}

    # Also look up the best available username for each recipient.
    # We query the most recent log that has a non-null recipient_username.
    all_recipient_ids = [r.recipient_id for r in rows]
    username_q = (
        select(
            ActionLog.recipient_id,
            ActionLog.recipient_username,
        )
        .where(
            and_(
                ActionLog.user_id == user_id,
                ActionLog.recipient_id.in_(all_recipient_ids),
                ActionLog.recipient_username.isnot(None),
                ActionLog.recipient_username != "",
            )
        )
        .order_by(desc(ActionLog.id))
    )
    username_rows = (await db.execute(username_q)).all()
    username_map: dict[str, str] = {}
    for urow in username_rows:
        if urow.recipient_id not in username_map:
            username_map[urow.recipient_id] = urow.recipient_username

    conversations = []
    for row in rows:
        log = logs_map.get(row.latest_id)
        if not log:
            continue
        conversations.append(
            {
                "recipient_id": row.recipient_id,
                "recipient_username": username_map.get(row.recipient_id) or log.recipient_username or "",
                "total_messages": row.total_messages,
                "last_message": log.message_sent or log.error_message or "",
                "last_action_type": log.action_type.value if log.action_type else "",
                "last_status": log.status or "",
                "last_timestamp": log.created_at.isoformat() if log.created_at else "",
            }
        )

    return {
        "conversations": conversations,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_conversation_messages(
    db: AsyncSession,
    user_id: int,
    recipient_id: str,
    page: int = 1,
    page_size: int = 50,
):
    """Return all action logs for a specific recipient (conversation thread)."""

    count_q = (
        select(func.count())
        .select_from(ActionLog)
        .where(
            and_(
                ActionLog.user_id == user_id,
                ActionLog.recipient_id == recipient_id,
            )
        )
    )
    total = (await db.execute(count_q)).scalar() or 0

    msgs_q = (
        select(ActionLog)
        .where(
            and_(
                ActionLog.user_id == user_id,
                ActionLog.recipient_id == recipient_id,
            )
        )
        .order_by(ActionLog.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(msgs_q)
    logs = result.scalars().all()

    messages = []
    for log in logs:
        messages.append(
            {
                "id": log.id,
                "action_type": log.action_type.value if log.action_type else "",
                "status": log.status or "",
                "message": log.message_sent or log.error_message or "",
                "comment_id": log.comment_id,
                "recipient_username": log.recipient_username or "",
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
        )

    return {
        "messages": messages,
        "total": total,
        "page": page,
        "page_size": page_size,
        "recipient_id": recipient_id,
    }
