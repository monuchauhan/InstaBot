-- Migration: Add 'dm_response' value to actiontype enum
-- Created: 2026-03-07
-- Reason: The Python ActionType enum has DM_RESPONSE but it was never added to PostgreSQL

ALTER TYPE actiontype ADD VALUE IF NOT EXISTS 'dm_response';
