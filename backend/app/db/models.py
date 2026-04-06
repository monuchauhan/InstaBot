from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True, index=True)
    email_verification_sent_at = Column(DateTime, nullable=True)
    
    # Password reset
    password_reset_token = Column(String(255), nullable=True, index=True)
    password_reset_sent_at = Column(DateTime, nullable=True)
    
    # Subscription
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE)
    subscription_expires_at = Column(DateTime, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    instagram_accounts = relationship("InstagramAccount", back_populates="user", cascade="all, delete-orphan")
    automation_settings = relationship("AutomationSettings", back_populates="user", cascade="all, delete-orphan")
    action_logs = relationship("ActionLog", back_populates="user", cascade="all, delete-orphan")


class InstagramAccount(Base):
    """Connected Instagram Professional accounts."""
    __tablename__ = "instagram_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    instagram_user_id = Column(String(100), unique=True, index=True, nullable=False)
    instagram_username = Column(String(100), nullable=True)
    page_id = Column(String(100), nullable=True)  # Facebook Page ID
    access_token_encrypted = Column(Text, nullable=False)  # Encrypted long-lived token
    token_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="instagram_accounts")


class AutomationSettings(Base):
    """Automation configuration for each user.
    
    Each automation replies to a comment on the post with one of
    template_messages chosen at random, and sends a DM composed of a
    greeting message followed by a list of links.
    """
    __tablename__ = "automation_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    instagram_account_id = Column(Integer, ForeignKey("instagram_accounts.id", ondelete="CASCADE"), nullable=True)
    is_enabled = Column(Boolean, default=False)
    template_messages = Column(Text, nullable=True)  # JSON array of comment reply templates (one chosen at random)
    dm_greeting = Column(Text, nullable=True)  # Greeting DM message. Supports {username} placeholder
    dm_links = Column(Text, nullable=True)  # JSON array of URLs to send after the greeting
    trigger_keywords = Column(Text, nullable=True)  # JSON array of keywords that trigger the automation
    target_post_id = Column(String(100), nullable=True, index=True)  # Instagram media ID to scope automation to a specific post
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="automation_settings")


class ActionType(str, enum.Enum):
    COMMENT_REPLY = "comment_reply"
    DM_SENT = "dm_sent"
    DM_RESPONSE = "dm_response"
    WEBHOOK_RECEIVED = "webhook_received"
    ERROR = "error"


class ActionLog(Base):
    """Log of all automation actions."""
    __tablename__ = "action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    instagram_account_id = Column(Integer, ForeignKey("instagram_accounts.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(Enum(ActionType), nullable=False)
    status = Column(String(50), default="success")  # success, failed, pending
    details = Column(Text, nullable=True)  # JSON with action details
    comment_id = Column(String(100), nullable=True)
    recipient_id = Column(String(100), nullable=True)
    recipient_username = Column(String(100), nullable=True)
    message_sent = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="action_logs")
