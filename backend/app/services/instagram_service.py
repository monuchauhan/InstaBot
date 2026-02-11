from typing import Optional, List
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.db.models import InstagramAccount
from app.core.config import settings
from app.core.encryption import encrypt_token, decrypt_token


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
    """Exchange authorization code for access token."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            settings.META_TOKEN_URL,
            params={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                "code": code,
            }
        )
        response.raise_for_status()
        return response.json()


async def get_long_lived_token(short_lived_token: str) -> dict:
    """Exchange short-lived token for long-lived token."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://graph.facebook.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            }
        )
        response.raise_for_status()
        return response.json()


async def get_instagram_business_account(access_token: str) -> dict:
    """Get Instagram Business Account ID from connected Facebook Page."""
    async with httpx.AsyncClient() as client:
        # First, get the user's Facebook Pages
        pages_response = await client.get(
            f"https://graph.facebook.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/me/accounts",
            params={"access_token": access_token}
        )
        pages_response.raise_for_status()
        pages_data = pages_response.json()
        
        if not pages_data.get("data"):
            raise ValueError("No Facebook Pages found")
        
        # Get the first page's Instagram Business Account
        page = pages_data["data"][0]
        page_id = page["id"]
        page_token = page["access_token"]
        
        ig_response = await client.get(
            f"https://graph.facebook.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/{page_id}",
            params={
                "fields": "instagram_business_account",
                "access_token": page_token,
            }
        )
        ig_response.raise_for_status()
        ig_data = ig_response.json()
        
        if "instagram_business_account" not in ig_data:
            raise ValueError("No Instagram Business Account connected to this page")
        
        ig_account_id = ig_data["instagram_business_account"]["id"]
        
        # Get Instagram account details
        ig_details_response = await client.get(
            f"https://graph.facebook.com/{settings.INSTAGRAM_GRAPH_API_VERSION}/{ig_account_id}",
            params={
                "fields": "username,name",
                "access_token": access_token,
            }
        )
        ig_details_response.raise_for_status()
        ig_details = ig_details_response.json()
        
        return {
            "instagram_user_id": ig_account_id,
            "instagram_username": ig_details.get("username"),
            "page_id": page_id,
            "page_access_token": page_token,
        }


async def connect_instagram_account(
    db: AsyncSession,
    user_id: int,
    code: str
) -> InstagramAccount:
    """Connect an Instagram account via OAuth."""
    # Exchange code for token
    token_data = await exchange_code_for_token(code)
    short_lived_token = token_data["access_token"]
    
    # Get long-lived token
    long_lived_data = await get_long_lived_token(short_lived_token)
    long_lived_token = long_lived_data["access_token"]
    expires_in = long_lived_data.get("expires_in", 5184000)  # Default 60 days
    
    # Get Instagram account details
    ig_data = await get_instagram_business_account(long_lived_token)
    
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
    from datetime import timedelta
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
