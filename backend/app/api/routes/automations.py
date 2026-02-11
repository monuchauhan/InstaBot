from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, User, AutomationType
from app.core.subscription import enforce_automation_limit, enforce_feature_access
from app.schemas import (
    AutomationSettingsCreate,
    AutomationSettingsUpdate,
    AutomationSettingsResponse,
)
from app.services import (
    get_user_automation_settings,
    get_automation_settings_by_id,
    create_automation_settings,
    update_automation_settings,
    delete_automation_settings,
    get_instagram_account_by_id,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("", response_model=List[AutomationSettingsResponse])
async def get_automations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all automation settings for the current user."""
    automations = await get_user_automation_settings(db, current_user.id)
    return automations


@router.post("", response_model=AutomationSettingsResponse, status_code=status.HTTP_201_CREATED)
async def create_automation(
    automation_in: AutomationSettingsCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create new automation settings."""
    # Check subscription tier limits
    await enforce_automation_limit(db, current_user)
    
    # Check if user can use this automation type
    enforce_feature_access(current_user, automation_in.automation_type.value)
    
    # Verify Instagram account belongs to user if provided
    if automation_in.instagram_account_id:
        account = await get_instagram_account_by_id(
            db, automation_in.instagram_account_id, current_user.id
        )
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instagram account not found"
            )
    
    try:
        automation = await create_automation_settings(db, current_user.id, automation_in)
        return automation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{automation_id}", response_model=AutomationSettingsResponse)
async def get_automation(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific automation setting."""
    automation = await get_automation_settings_by_id(db, automation_id, current_user.id)
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found"
        )
    return automation


@router.put("/{automation_id}", response_model=AutomationSettingsResponse)
async def update_automation(
    automation_id: int,
    automation_in: AutomationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update automation settings."""
    automation = await get_automation_settings_by_id(db, automation_id, current_user.id)
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found"
        )
    
    automation = await update_automation_settings(db, automation, automation_in)
    return automation


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete automation settings."""
    automation = await get_automation_settings_by_id(db, automation_id, current_user.id)
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found"
        )
    
    await delete_automation_settings(db, automation)
    return None


@router.post("/{automation_id}/toggle", response_model=AutomationSettingsResponse)
async def toggle_automation(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle automation on/off."""
    automation = await get_automation_settings_by_id(db, automation_id, current_user.id)
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found"
        )
    
    automation = await update_automation_settings(
        db, 
        automation, 
        AutomationSettingsUpdate(is_enabled=not automation.is_enabled)
    )
    return automation
