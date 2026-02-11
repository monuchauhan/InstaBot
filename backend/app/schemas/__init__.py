from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.db.models import AutomationType, ActionType, SubscriptionTier


# ============= User Schemas =============

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class UserResponse(UserBase):
    id: int
    is_active: bool
    email_verified: bool = False
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE
    subscription_expires_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserWithAccounts(UserResponse):
    instagram_accounts: List["InstagramAccountResponse"] = []


# ============= Auth Schemas =============

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ============= Instagram Account Schemas =============

class InstagramAccountBase(BaseModel):
    instagram_username: Optional[str] = None


class InstagramAccountResponse(BaseModel):
    id: int
    instagram_user_id: str
    instagram_username: Optional[str] = None
    is_active: bool
    connected_at: datetime
    
    class Config:
        from_attributes = True


class InstagramOAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None


# ============= Automation Settings Schemas =============

class AutomationSettingsBase(BaseModel):
    automation_type: AutomationType
    is_enabled: bool = False
    template_message: Optional[str] = None
    trigger_keywords: Optional[List[str]] = None


class AutomationSettingsCreate(AutomationSettingsBase):
    instagram_account_id: Optional[int] = None


class AutomationSettingsUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    template_message: Optional[str] = None
    trigger_keywords: Optional[List[str]] = None


class AutomationSettingsResponse(AutomationSettingsBase):
    id: int
    user_id: int
    instagram_account_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ============= Action Log Schemas =============

class ActionLogBase(BaseModel):
    action_type: ActionType
    status: str = "success"
    details: Optional[str] = None


class ActionLogResponse(ActionLogBase):
    id: int
    user_id: int
    instagram_account_id: Optional[int] = None
    comment_id: Optional[str] = None
    recipient_id: Optional[str] = None
    message_sent: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ActionLogListResponse(BaseModel):
    logs: List[ActionLogResponse]
    total: int
    page: int
    page_size: int


# ============= Webhook Schemas =============

class WebhookVerification(BaseModel):
    hub_mode: str = Field(..., alias="hub.mode")
    hub_verify_token: str = Field(..., alias="hub.verify_token")
    hub_challenge: str = Field(..., alias="hub.challenge")


class WebhookComment(BaseModel):
    id: str
    text: str
    from_user: dict = Field(..., alias="from")
    media: dict
    timestamp: str


class WebhookEntry(BaseModel):
    id: str
    time: int
    changes: List[dict]


class WebhookPayload(BaseModel):
    object: str
    entry: List[WebhookEntry]


# Update forward references
UserWithAccounts.model_rebuild()
