-- Migration: Add recipient_username to action_logs
-- Stores the Instagram @username alongside the numeric recipient_id
-- so the inbox can display human-readable contact names.

ALTER TABLE action_logs
ADD COLUMN recipient_username VARCHAR(100) DEFAULT NULL;

-- Back-fill: for existing rows where the username was stored in the
-- JSON details field by send_dm_with_flow, we leave them NULL.
-- New logs will populate this column going forward.
