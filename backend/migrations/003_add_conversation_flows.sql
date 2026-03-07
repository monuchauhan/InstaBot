-- Migration: Add conversation flow tables
-- Created: 2026-03-07

-- Conversation flows (linked to SEND_DM automations)
CREATE TABLE IF NOT EXISTS conversation_flows (
    id SERIAL PRIMARY KEY,
    automation_id INTEGER NOT NULL UNIQUE REFERENCES automation_settings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    initial_message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation steps (tree structure)
CREATE TABLE IF NOT EXISTS conversation_steps (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER NOT NULL REFERENCES conversation_flows(id) ON DELETE CASCADE,
    parent_step_id INTEGER REFERENCES conversation_steps(id) ON DELETE SET NULL,
    step_order INTEGER DEFAULT 0,
    payload_trigger VARCHAR(255),
    message_text TEXT NOT NULL,
    quick_replies JSONB,
    is_end_step BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation state tracking (where each user is in a flow)
CREATE TABLE IF NOT EXISTS conversation_states (
    id SERIAL PRIMARY KEY,
    instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    recipient_ig_id VARCHAR(100) NOT NULL,
    flow_id INTEGER NOT NULL REFERENCES conversation_flows(id) ON DELETE CASCADE,
    current_step_id INTEGER REFERENCES conversation_steps(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add DM_RESPONSE to action_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dm_response' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'actiontype')) THEN
        ALTER TYPE actiontype ADD VALUE 'dm_response';
    END IF;
END$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_states_recipient ON conversation_states(instagram_account_id, recipient_ig_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_steps_flow ON conversation_steps(flow_id, parent_step_id);
CREATE INDEX IF NOT EXISTS idx_conversation_flows_automation ON conversation_flows(automation_id);
