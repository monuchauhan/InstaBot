"""Add subscription and email verification fields to User model

This migration adds the following fields to the users table:
- email_verified: Boolean for email verification status
- email_verification_token: Token for email verification
- email_verification_sent_at: Timestamp when verification email was sent
- password_reset_token: Token for password reset
- password_reset_sent_at: Timestamp when password reset email was sent
- subscription_tier: User's subscription tier (free, pro, enterprise)
- subscription_expires_at: When the subscription expires
- stripe_customer_id: Stripe customer ID
- stripe_subscription_id: Stripe subscription ID

Run this migration with:
    alembic upgrade head

Or manually with PostgreSQL:
    psql -d instabot -f migrations/002_add_subscription_fields.sql
"""

-- Add email verification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;

-- Add password reset fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_sent_at TIMESTAMP;

-- Add subscription fields
-- First, create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE subscriptiontier AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier subscriptiontier DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Create indexes for tokens and stripe IDs
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Auto-verify existing users (they were created before email verification was required)
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
