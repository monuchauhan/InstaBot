"""Analytics service for dashboard metrics."""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import ActionLog, ActionType, AutomationSettings, InstagramAccount


async def get_dashboard_analytics(
    db: AsyncSession,
    user_id: int,
    days: int = 30,
) -> Dict[str, Any]:
    """Get aggregated analytics for the user's dashboard.
    
    Returns metrics like total comments replied, DMs sent,
    action counts by day, and automation statistics.
    """
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)
    prev_period_start = period_start - timedelta(days=days)

    # --- Aggregate counts for the current period ---
    current_counts = await _get_period_counts(db, user_id, period_start, now)
    prev_counts = await _get_period_counts(db, user_id, prev_period_start, period_start)

    # --- Daily breakdown for chart ---
    daily_stats = await _get_daily_stats(db, user_id, period_start, now)

    # --- Automation summary ---
    automation_result = await db.execute(
        select(
            func.count(AutomationSettings.id).label("total"),
            func.sum(case((AutomationSettings.is_enabled == True, 1), else_=0)).label("active"),
        ).where(AutomationSettings.user_id == user_id)
    )
    auto_row = automation_result.one()

    # --- Connected accounts ---
    account_result = await db.execute(
        select(func.count(InstagramAccount.id)).where(
            InstagramAccount.user_id == user_id,
            InstagramAccount.is_active == True,
        )
    )
    active_accounts = account_result.scalar() or 0

    # --- Compute percentage changes ---
    def pct_change(current: int, previous: int) -> Optional[float]:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    return {
        "total_comments_replied": current_counts["comment_reply"],
        "total_dms_sent": current_counts["dm_sent"],
        "total_errors": current_counts["error"],
        "total_actions": current_counts["total"],
        "comments_change_pct": pct_change(
            current_counts["comment_reply"], prev_counts["comment_reply"]
        ),
        "dms_change_pct": pct_change(
            current_counts["dm_sent"], prev_counts["dm_sent"]
        ),
        "actions_change_pct": pct_change(
            current_counts["total"], prev_counts["total"]
        ),
        "active_automations": int(auto_row.active or 0),
        "total_automations": int(auto_row.total or 0),
        "active_accounts": active_accounts,
        "daily_stats": daily_stats,
        "period_days": days,
    }


async def _get_period_counts(
    db: AsyncSession,
    user_id: int,
    start: datetime,
    end: datetime,
) -> Dict[str, int]:
    """Get action counts by type for a date range."""
    result = await db.execute(
        select(
            ActionLog.action_type,
            func.count(ActionLog.id).label("cnt"),
        )
        .where(
            ActionLog.user_id == user_id,
            ActionLog.created_at >= start,
            ActionLog.created_at < end,
            ActionLog.status == "success",
        )
        .group_by(ActionLog.action_type)
    )
    rows = result.all()
    counts: Dict[str, int] = {
        "comment_reply": 0,
        "dm_sent": 0,
        "dm_response": 0,
        "webhook_received": 0,
        "error": 0,
        "total": 0,
    }
    for row in rows:
        key = row.action_type.value if hasattr(row.action_type, 'value') else row.action_type
        counts[key] = row.cnt
        counts["total"] += row.cnt

    # Also count errors (any status)
    error_result = await db.execute(
        select(func.count(ActionLog.id)).where(
            ActionLog.user_id == user_id,
            ActionLog.created_at >= start,
            ActionLog.created_at < end,
            ActionLog.status == "failed",
        )
    )
    counts["error"] = error_result.scalar() or 0

    return counts


async def _get_daily_stats(
    db: AsyncSession,
    user_id: int,
    start: datetime,
    end: datetime,
) -> List[Dict[str, Any]]:
    """Get daily action counts grouped by date."""
    date_col = func.date(ActionLog.created_at).label("day")
    result = await db.execute(
        select(
            date_col,
            func.sum(
                case(
                    (ActionLog.action_type == ActionType.COMMENT_REPLY, 1),
                    else_=0,
                )
            ).label("comments"),
            func.sum(
                case(
                    (ActionLog.action_type == ActionType.DM_SENT, 1),
                    else_=0,
                )
            ).label("dms"),
            func.count(ActionLog.id).label("total"),
        )
        .where(
            ActionLog.user_id == user_id,
            ActionLog.created_at >= start,
            ActionLog.created_at < end,
        )
        .group_by(date_col)
        .order_by(date_col)
    )
    rows = result.all()
    return [
        {
            "date": str(row.day),
            "comments": int(row.comments or 0),
            "dms": int(row.dms or 0),
            "total": int(row.total or 0),
        }
        for row in rows
    ]
