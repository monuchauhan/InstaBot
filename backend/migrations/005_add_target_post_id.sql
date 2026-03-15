-- Migration: Add target_post_id to automation_settings
-- This allows automations to be scoped to a specific Instagram post

ALTER TABLE automation_settings
ADD COLUMN target_post_id VARCHAR(100) DEFAULT NULL;

CREATE INDEX ix_automation_settings_target_post_id
ON automation_settings (target_post_id);

-- Drop the old unique constraint on (user_id, automation_type, instagram_account_id) if it exists
-- so that multiple automations of the same type can exist for different posts.
-- (The service layer handles uniqueness via target_post_id now.)
