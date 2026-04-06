-- Migration 008: Merge auto_reply_comment + send_dm into single automation type
-- Also removes conversation flow system and inbox-related features.

-- 1. Drop conversation flow tables (order matters due to FK constraints)
DROP TABLE IF EXISTS conversation_states CASCADE;
DROP TABLE IF EXISTS conversation_steps CASCADE;
DROP TABLE IF EXISTS conversation_flows CASCADE;

-- 2. Add dm_message column to automation_settings
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS dm_message TEXT;

-- 3. Remove automation_type column
ALTER TABLE automation_settings DROP COLUMN IF EXISTS automation_type;

-- 4. Drop the automationtype enum type (created by SQLAlchemy)
DROP TYPE IF EXISTS automationtype;
