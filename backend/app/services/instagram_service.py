import logging
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.db.models import InstagramAccount
from app.core.config import settings
from app.core.encryption import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)


async def get_instagram_account_by_id(
    db: AsyncSession, 
    account_id: int, 
    user_id: int
) -> Optional[InstagramAccount]:
    """Get an Instagram account by ID for a specific user."""
    result = await db.execute(
        select(InstagramAccount).where(
            InstagramAccount.id == account_id,
            InstagramAccount.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_instagram_account_by_ig_user_id(
    db: AsyncSession, 
    instagram_user_id: str
) -> Optional[InstagramAccount]:
    """Get an Instagram account by Instagram user ID."""
    result = await db.execute(
        select(InstagramAccount).where(
            InstagramAccount.instagram_user_id == instagram_user_id
        )
    )
    return result.scalar_one_or_none()


async def get_user_instagram_accounts(
    db: AsyncSession, 
    user_id: int
) -> List[InstagramAccount]:
    """Get all Instagram accounts for a user."""
    result = await db.execute(
        select(InstagramAccount).where(InstagramAccount.user_id == user_id)
    )
    return list(result.scalars().all())


async def exchange_code_for_token(code: str) -> dict:
    """Exchange authorization code for a short-lived access token.
    
    Uses Instagram Login API (api.instagram.com), not Facebook Login.
    Returns: { access_token, user_id }
    """
    async with httpx.AsyncClient() as client:
        # Instagram Login requires a POST with form data (not GET with query params)
        response = await client.post(
            settings.META_TOKEN_URL,
            data={
                "client_id": settings.INSTAGRAM_APP_ID,      # Instagram App ID
                "client_secret": settings.INSTAGRAM_APP_SECRET,  # Instagram App Secret
                "grant_type": "authorization_code",
                "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                "code": code,
            }
        )
        response.raise_for_status()
        data = response.json()
        logger.info(f"Token exchange successful for user_id={data.get('user_id')}")
        return data  # { access_token, user_id }


async def get_long_lived_token(short_lived_token: str) -> dict:
    """Exchange short-lived token for long-lived token (60 days).
    
    Uses Instagram Graph API endpoint, not Facebook Graph API.
    Returns: { access_token, token_type, expires_in }
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            settings.INSTAGRAM_LONG_LIVED_TOKEN_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.INSTAGRAM_APP_SECRET,  # Instagram App Secret
                "access_token": short_lived_token,
            }
        )
        response.raise_for_status()
        data = response.json()
        logger.info(f"Long-lived token obtained, expires_in={data.get('expires_in')}")
        return data  # { access_token, token_type, expires_in }


async def get_instagram_user_profile(access_token: str, user_id: str) -> dict:
    """Get Instagram user profile details using Instagram Login API.
    
    With Instagram Login, the user_id is returned directly from the token
    exchange — no need to go through Facebook Pages.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://graph.instagram.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me",
            params={
                "fields": "user_id,username,name,account_type,profile_picture_url",
                "access_token": access_token,
            }
        )
        response.raise_for_status()
        profile = response.json()
        logger.info(f"Instagram profile retrieved: @{profile.get('username')}")
        
        return {
            "instagram_user_id": str(profile.get("user_id", user_id)),
            "instagram_username": profile.get("username"),
            "page_id": None,  # Not needed with Instagram Login
        }


async def connect_instagram_account(
    db: AsyncSession,
    user_id: int,
    code: str
) -> InstagramAccount:
    """Connect an Instagram account via OAuth (Instagram Login flow)."""
    # Exchange code for short-lived token
    token_data = await exchange_code_for_token(code)
    short_lived_token = token_data["access_token"]
    ig_user_id = str(token_data["user_id"])  # Instagram Login returns user_id directly
    
    # Get long-lived token
    long_lived_data = await get_long_lived_token(short_lived_token)
    long_lived_token = long_lived_data["access_token"]
    expires_in = long_lived_data.get("expires_in", 5184000)  # Default 60 days
    
    # Get Instagram user profile
    ig_data = await get_instagram_user_profile(long_lived_token, ig_user_id)
    
    # Check if account already connected
    existing = await get_instagram_account_by_ig_user_id(
        db, ig_data["instagram_user_id"]
    )
    
    if existing:
        if existing.user_id != user_id:
            raise ValueError("This Instagram account is already connected to another user")
        # Update existing account
        existing.access_token_encrypted = encrypt_token(long_lived_token)
        existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        existing.instagram_username = ig_data.get("instagram_username")
        existing.page_id = ig_data.get("page_id")
        existing.is_active = True
        await db.flush()
        await db.refresh(existing)
        return existing
    
    # Create new account
    account = InstagramAccount(
        user_id=user_id,
        instagram_user_id=ig_data["instagram_user_id"],
        instagram_username=ig_data.get("instagram_username"),
        page_id=ig_data.get("page_id"),
        access_token_encrypted=encrypt_token(long_lived_token),
        token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def disconnect_instagram_account(
    db: AsyncSession,
    account: InstagramAccount
) -> None:
    """Disconnect an Instagram account."""
    await db.delete(account)
    await db.flush()


def get_decrypted_token(account: InstagramAccount) -> str:
    """Get the decrypted access token for an Instagram account."""
    return decrypt_token(account.access_token_encrypted)
