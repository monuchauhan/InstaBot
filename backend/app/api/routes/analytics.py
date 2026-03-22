"""Dashboard analytics endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, User
from app.schemas import DashboardAnalyticsResponse
from app.services.analytics_service import get_dashboard_analytics
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardAnalyticsResponse)
async def dashboard_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated dashboard analytics for the current user.
    
    Returns total comments replied, DMs sent, daily breakdown,
    automation counts, and percentage change vs previous period.
    """
    data = await get_dashboard_analytics(db, current_user.id, days=days)
    return DashboardAnalyticsResponse(**data)
