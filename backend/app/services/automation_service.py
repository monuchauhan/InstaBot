from typing import Optional, List
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AutomationSettings, AutomationType
from app.schemas import AutomationSettingsCreate, AutomationSettingsUpdate


async def get_automation_settings_by_id(
    db: AsyncSession,
    settings_id: int,
    user_id: int
) -> Optional[AutomationSettings]:
    """Get automation settings by ID for a specific user."""
    result = await db.execute(
        select(AutomationSettings).where(
            AutomationSettings.id == settings_id,
            AutomationSettings.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_user_automation_settings(
    db: AsyncSession,
    user_id: int
) -> List[AutomationSettings]:
    """Get all automation settings for a user."""
    result = await db.execute(
        select(AutomationSettings).where(AutomationSettings.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_automation_by_type(
    db: AsyncSession,
    user_id: int,
    automation_type: AutomationType,
    instagram_account_id: Optional[int] = None
) -> Optional[AutomationSettings]:
    """Get automation settings by type for a user."""
    query = select(AutomationSettings).where(
        AutomationSettings.user_id == user_id,
        AutomationSettings.automation_type == automation_type
    )
    if instagram_account_id:
        query = query.where(AutomationSettings.instagram_account_id == instagram_account_id)
    
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_enabled_automation_for_account(
    db: AsyncSession,
    instagram_user_id: str,
    automation_type: AutomationType
) -> Optional[AutomationSettings]:
    """Get enabled automation for an Instagram account by Instagram user ID."""
    from app.db.models import InstagramAccount
    
    result = await db.execute(
        select(AutomationSettings)
        .join(InstagramAccount, AutomationSettings.instagram_account_id == InstagramAccount.id)
        .where(
            InstagramAccount.instagram_user_id == instagram_user_id,
            AutomationSettings.automation_type == automation_type,
            AutomationSettings.is_enabled == True
        )
    )
    return result.scalar_one_or_none()


async def create_automation_settings(
    db: AsyncSession,
    user_id: int,
    settings_in: AutomationSettingsCreate
) -> AutomationSettings:
    """Create new automation settings."""
    # Check if settings already exist for this type
    existing = await get_automation_by_type(
        db, user_id, settings_in.automation_type, settings_in.instagram_account_id
    )
    if existing:
        raise ValueError(f"Automation settings for {settings_in.automation_type} already exist")
    
    trigger_keywords = None
    if settings_in.trigger_keywords:
        trigger_keywords = json.dumps(settings_in.trigger_keywords)
    
    automation = AutomationSettings(
        user_id=user_id,
        instagram_account_id=settings_in.instagram_account_id,
        automation_type=settings_in.automation_type,
        is_enabled=settings_in.is_enabled,
        template_message=settings_in.template_message,
        trigger_keywords=trigger_keywords,
    )
    db.add(automation)
    await db.flush()
    await db.refresh(automation)
    return automation


async def update_automation_settings(
    db: AsyncSession,
    automation: AutomationSettings,
    settings_in: AutomationSettingsUpdate
) -> AutomationSettings:
    """Update automation settings."""
    update_data = settings_in.model_dump(exclude_unset=True)
    
    if "trigger_keywords" in update_data and update_data["trigger_keywords"] is not None:
        update_data["trigger_keywords"] = json.dumps(update_data["trigger_keywords"])
    
    for field, value in update_data.items():
        setattr(automation, field, value)
    
    await db.flush()
    await db.refresh(automation)
    return automation


async def delete_automation_settings(
    db: AsyncSession,
    automation: AutomationSettings
) -> None:
    """Delete automation settings."""
    await db.delete(automation)
    await db.flush()


def parse_trigger_keywords(automation: AutomationSettings) -> List[str]:
    """Parse trigger keywords from JSON string."""
    if automation.trigger_keywords:
        return json.loads(automation.trigger_keywords)
    return []
