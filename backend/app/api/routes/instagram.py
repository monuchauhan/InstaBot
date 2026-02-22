from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, User
from app.core.config import settings
from app.core.subscription import enforce_account_limit, SubscriptionService
from app.schemas import InstagramAccountResponse, InstagramOAuthCallback
from app.services import (
    get_user_instagram_accounts,
    get_instagram_account_by_id,
    connect_instagram_account,
    disconnect_instagram_account,
)
from app.services.instagram_service import subscribe_to_webhooks, get_decrypted_token
from app.api.deps import get_current_user
from typing import List

router = APIRouter(prefix="/instagram", tags=["Instagram"])


@router.get("/connect-url")
async def get_instagram_connect_url(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the OAuth URL to connect Instagram account."""
    # Check subscription tier limits before generating OAuth URL
    await enforce_account_limit(db, current_user)
    
    params = {
        "client_id": settings.INSTAGRAM_APP_ID,  # Instagram App ID, not Meta App ID
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        "scope": "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages",
        "response_type": "code",
        "state": str(current_user.id),  # Include user ID in state for verification
    }
    
    oauth_url = f"{settings.META_OAUTH_URL}?{urlencode(params)}"
    
    return {"oauth_url": oauth_url}


@router.post("/callback", response_model=InstagramAccountResponse)
async def instagram_oauth_callback(
    callback_data: InstagramOAuthCallback,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Handle Instagram OAuth callback and connect account."""
    # Check subscription tier limits before connecting
    await enforce_account_limit(db, current_user)
    
    try:
        account = await connect_instagram_account(db, current_user.id, callback_data.code)
        return account
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect Instagram account: {str(e)}"
        )


@router.get("/accounts", response_model=List[InstagramAccountResponse])
async def get_connected_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all connected Instagram accounts for the current user."""
    accounts = await get_user_instagram_accounts(db, current_user.id)
    return accounts


@router.get("/accounts/{account_id}", response_model=InstagramAccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific connected Instagram account."""
    account = await get_instagram_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instagram account not found"
        )
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect an Instagram account."""
    account = await get_instagram_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instagram account not found"
        )
    
    await disconnect_instagram_account(db, account)
    return None


@router.post("/accounts/{account_id}/subscribe-webhooks")
async def subscribe_account_webhooks(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually subscribe an already-connected Instagram account to webhooks.
    
    Useful for accounts connected before webhook subscription was implemented,
    or to re-subscribe after any issues.
    """
    account = await get_instagram_account_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instagram account not found"
        )
    
    access_token = get_decrypted_token(account)
    success = await subscribe_to_webhooks(access_token, account.instagram_user_id)
    
    if success:
        return {"status": "subscribed", "account_id": account_id}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to subscribe to webhooks. Check the backend logs."
        )
