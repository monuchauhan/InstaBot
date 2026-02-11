from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.db.models import User, InstagramAccount, AutomationSettings, SubscriptionTier
from app.core.config import settings


class SubscriptionService:
    """Handle subscription tier limits and enforcement."""
    
    @staticmethod
    def get_tier_limits(tier: SubscriptionTier) -> dict:
        """Get limits for a subscription tier."""
        limits = {
            SubscriptionTier.FREE: {
                "max_accounts": settings.FREE_TIER_MAX_ACCOUNTS,
                "max_automations": settings.FREE_TIER_MAX_AUTOMATIONS,
                "max_actions_per_day": 50,
                "features": ["auto_reply_comment"],
            },
            SubscriptionTier.PRO: {
                "max_accounts": settings.PRO_TIER_MAX_ACCOUNTS,
                "max_automations": settings.PRO_TIER_MAX_AUTOMATIONS,
                "max_actions_per_day": 500,
                "features": ["auto_reply_comment", "send_dm", "analytics"],
            },
            SubscriptionTier.ENTERPRISE: {
                "max_accounts": settings.ENTERPRISE_TIER_MAX_ACCOUNTS,
                "max_automations": settings.ENTERPRISE_TIER_MAX_AUTOMATIONS,
                "max_actions_per_day": -1,  # Unlimited
                "features": ["auto_reply_comment", "send_dm", "analytics", "api_access", "priority_support"],
            },
        }
        return limits.get(tier, limits[SubscriptionTier.FREE])
    
    @staticmethod
    async def get_user_account_count(db: AsyncSession, user_id: int) -> int:
        """Get the number of Instagram accounts for a user."""
        result = await db.execute(
            select(func.count(InstagramAccount.id)).where(
                InstagramAccount.user_id == user_id
            )
        )
        return result.scalar() or 0
    
    @staticmethod
    async def get_user_automation_count(db: AsyncSession, user_id: int) -> int:
        """Get the number of automations for a user."""
        result = await db.execute(
            select(func.count(AutomationSettings.id)).where(
                AutomationSettings.user_id == user_id
            )
        )
        return result.scalar() or 0
    
    @staticmethod
    async def can_add_account(db: AsyncSession, user: User) -> tuple[bool, Optional[str]]:
        """Check if user can add another Instagram account."""
        limits = SubscriptionService.get_tier_limits(user.subscription_tier)
        current_count = await SubscriptionService.get_user_account_count(db, user.id)
        
        if current_count >= limits["max_accounts"]:
            return False, f"Your {user.subscription_tier.value} plan allows up to {limits['max_accounts']} Instagram account(s). Please upgrade to add more."
        
        return True, None
    
    @staticmethod
    async def can_add_automation(db: AsyncSession, user: User) -> tuple[bool, Optional[str]]:
        """Check if user can add another automation."""
        limits = SubscriptionService.get_tier_limits(user.subscription_tier)
        current_count = await SubscriptionService.get_user_automation_count(db, user.id)
        
        if current_count >= limits["max_automations"]:
            return False, f"Your {user.subscription_tier.value} plan allows up to {limits['max_automations']} automation(s). Please upgrade to add more."
        
        return True, None
    
    @staticmethod
    def can_use_feature(user: User, feature: str) -> tuple[bool, Optional[str]]:
        """Check if user can use a specific feature."""
        limits = SubscriptionService.get_tier_limits(user.subscription_tier)
        
        if feature not in limits["features"]:
            return False, f"The '{feature}' feature requires a higher subscription tier. Please upgrade your plan."
        
        return True, None
    
    @staticmethod
    def is_subscription_active(user: User) -> bool:
        """Check if user's subscription is still active."""
        if user.subscription_tier == SubscriptionTier.FREE:
            return True  # Free tier is always active
        
        if user.subscription_expires_at is None:
            return True  # No expiration set
        
        return user.subscription_expires_at > datetime.utcnow()


async def enforce_account_limit(db: AsyncSession, user: User):
    """Raise HTTPException if user cannot add more accounts."""
    can_add, message = await SubscriptionService.can_add_account(db, user)
    if not can_add:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "account_limit_reached",
                "message": message,
                "upgrade_url": f"{settings.FRONTEND_URL}/pricing",
            }
        )


async def enforce_automation_limit(db: AsyncSession, user: User):
    """Raise HTTPException if user cannot add more automations."""
    can_add, message = await SubscriptionService.can_add_automation(db, user)
    if not can_add:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "automation_limit_reached",
                "message": message,
                "upgrade_url": f"{settings.FRONTEND_URL}/pricing",
            }
        )


def enforce_feature_access(user: User, feature: str):
    """Raise HTTPException if user cannot use a feature."""
    can_use, message = SubscriptionService.can_use_feature(user, feature)
    if not can_use:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "feature_not_available",
                "message": message,
                "upgrade_url": f"{settings.FRONTEND_URL}/pricing",
            }
        )
