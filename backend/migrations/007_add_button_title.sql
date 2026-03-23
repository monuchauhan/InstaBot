-- Add button_title column to conversation_steps
-- This stores the user-visible label for the quick reply button that triggers this step.
-- Instagram limits quick reply button titles to 20 characters.

ALTER TABLE conversation_steps
ADD COLUMN IF NOT EXISTS button_title VARCHAR(20) DEFAULT NULL;
