from datetime import datetime
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db, User
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_token, get_password_hash
from app.core.email import send_verification_email, send_password_reset_email, send_welcome_email
from app.core.subscription import SubscriptionService
from app.schemas import (
    Token,
    UserCreate,
    UserResponse,
    UserUpdate,
    LoginRequest,
    RefreshTokenRequest,
)
from app.services import (
    create_user,
    get_user_by_email,
    authenticate_user,
    update_user,
    get_user_by_id,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    existing_user = await get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = await create_user(db, user_in)
    
    # Send verification email if email is configured
    if settings.email_enabled:
        verification_token = secrets.token_urlsafe(32)
        user.email_verification_token = verification_token
        user.email_verification_sent_at = datetime.utcnow()
        await db.commit()
        await send_verification_email(user.email, verification_token)
    else:
        # Auto-verify if email is not configured (development mode)
        user.email_verified = True
        await db.commit()
    
    return user


@router.post("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Verify user email with token."""
    result = await db.execute(
        select(User).where(User.email_verification_token == token)
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Check if token is expired (24 hours)
    if user.email_verification_sent_at:
        hours_elapsed = (datetime.utcnow() - user.email_verification_sent_at).total_seconds() / 3600
        if hours_elapsed > 24:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired. Please request a new one."
            )
    
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_sent_at = None
    await db.commit()
    
    # Send welcome email
    await send_welcome_email(user.email, user.full_name)
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    """Resend verification email."""
    user = await get_user_by_email(db, email)
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a verification link has been sent."}
    
    if user.email_verified:
        return {"message": "Email is already verified."}
    
    if not settings.email_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured"
        )
    
    verification_token = secrets.token_urlsafe(32)
    user.email_verification_token = verification_token
    user.email_verification_sent_at = datetime.utcnow()
    await db.commit()
    
    await send_verification_email(user.email, verification_token)
    
    return {"message": "If the email exists, a verification link has been sent."}


@router.post("/forgot-password")
async def forgot_password(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    """Request password reset email."""
    user = await get_user_by_email(db, email)
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a password reset link has been sent."}
    
    if not settings.email_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured"
        )
    
    reset_token = secrets.token_urlsafe(32)
    user.password_reset_token = reset_token
    user.password_reset_sent_at = datetime.utcnow()
    await db.commit()
    
    await send_password_reset_email(user.email, reset_token)
    
    return {"message": "If the email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    token: str,
    new_password: str,
    db: AsyncSession = Depends(get_db),
):
    """Reset password with token."""
    result = await db.execute(
        select(User).where(User.password_reset_token == token)
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token is expired (1 hour)
    if user.password_reset_sent_at:
        hours_elapsed = (datetime.utcnow() - user.password_reset_sent_at).total_seconds() / 3600
        if hours_elapsed > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired. Please request a new one."
            )
    
    user.hashed_password = get_password_hash(new_password)
    user.password_reset_token = None
    user.password_reset_sent_at = None
    await db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    existing_user = await get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = await create_user(db, user_in)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login and get access token."""
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/login/json", response_model=Token)
async def login_json(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with JSON body and get access token."""
    user = await authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    payload = verify_token(token_data.refresh_token, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    user = await get_user_by_id(db, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Get current user profile."""
    return current_user


@router.get("/me/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscription details and usage."""
    limits = SubscriptionService.get_tier_limits(current_user.subscription_tier)
    
    # Get current usage
    account_count = await SubscriptionService.get_user_account_count(db, current_user.id)
    automation_count = await SubscriptionService.get_user_automation_count(db, current_user.id)
    
    return {
        "tier": current_user.subscription_tier.value,
        "expires_at": current_user.subscription_expires_at,
        "is_active": SubscriptionService.is_subscription_active(current_user),
        "limits": {
            "max_accounts": limits["max_accounts"],
            "max_automations": limits["max_automations"],
            "max_actions_per_day": limits["max_actions_per_day"],
            "features": limits["features"],
        },
        "usage": {
            "accounts": account_count,
            "automations": automation_count,
        },
    }


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile."""
    user = await update_user(db, current_user, user_in)
    return user
