-- Migration 009: Automation UI overhaul
-- - Rename template_message -> template_messages (convert existing values to JSON arrays)
-- - Drop dm_message, add dm_greeting + dm_links

-- Step 1: Rename column
ALTER TABLE automation_settings RENAME COLUMN template_message TO template_messages;

-- Step 2: Convert existing single-string values to JSON arrays
-- e.g. "Hello there" -> '["Hello there"]'
UPDATE automation_settings
SET template_messages = '["' || replace(replace(template_messages, '\', '\\'), '"', '\"') || '"]'
WHERE template_messages IS NOT NULL;

-- Step 3: Add new DM columns
ALTER TABLE automation_settings ADD COLUMN dm_greeting TEXT;
ALTER TABLE automation_settings ADD COLUMN dm_links TEXT;

-- Step 4: Migrate existing dm_message content to dm_greeting
UPDATE automation_settings SET dm_greeting = dm_message WHERE dm_message IS NOT NULL;

-- Step 5: Drop old dm_message column
ALTER TABLE automation_settings DROP COLUMN dm_message;
