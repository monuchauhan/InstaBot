import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "InstaBot"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENCRYPTION_KEY: str
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    # Instagram/Meta API
    META_APP_ID: str
    META_APP_SECRET: str
    META_WEBHOOK_VERIFY_TOKEN: str
    INSTAGRAM_GRAPH_API_VERSION: str = "v18.0"
    INSTAGRAM_REDIRECT_URI: str
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Email (SMTP) - Optional for email verification
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "InstaBot"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    
    # Subscription Tiers (limits per tier)
    FREE_TIER_MAX_ACCOUNTS: int = 1
    FREE_TIER_MAX_AUTOMATIONS: int = 2
    PRO_TIER_MAX_ACCOUNTS: int = 5
    PRO_TIER_MAX_AUTOMATIONS: int = 10
    ENTERPRISE_TIER_MAX_ACCOUNTS: int = 100
    ENTERPRISE_TIER_MAX_AUTOMATIONS: int = 100
    
    # Stripe (Optional - for billing)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v
    
    @property
    def INSTAGRAM_API_BASE_URL(self) -> str:
        return f"https://graph.instagram.com/{self.INSTAGRAM_GRAPH_API_VERSION}"
    
    @property
    def META_OAUTH_URL(self) -> str:
        return "https://www.facebook.com/v18.0/dialog/oauth"
    
    @property
    def META_TOKEN_URL(self) -> str:
        return "https://graph.facebook.com/v18.0/oauth/access_token"
    
    @property
    def email_enabled(self) -> bool:
        return all([self.SMTP_HOST, self.SMTP_USER, self.SMTP_PASSWORD, self.SMTP_FROM_EMAIL])
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
