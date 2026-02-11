// User types
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  email_verified: boolean;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  created_at: string;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  expires_at: string | null;
  is_active: boolean;
  limits: {
    max_accounts: number;
    max_automations: number;
    max_actions_per_day: number;
    features: string[];
  };
  usage: {
    accounts: number;
    automations: number;
  };
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Instagram Account types
export interface InstagramAccount {
  id: number;
  instagram_user_id: string;
  instagram_username: string | null;
  is_active: boolean;
  connected_at: string;
}

// Automation types
export type AutomationType = 'auto_reply_comment' | 'send_dm';

export interface AutomationSettings {
  id: number;
  user_id: number;
  instagram_account_id: number | null;
  automation_type: AutomationType;
  is_enabled: boolean;
  template_message: string | null;
  trigger_keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationCreate {
  automation_type: AutomationType;
  instagram_account_id?: number;
  is_enabled?: boolean;
  template_message?: string;
  trigger_keywords?: string[];
}

export interface AutomationUpdate {
  is_enabled?: boolean;
  template_message?: string;
  trigger_keywords?: string[];
}

// Action Log types
export type ActionType = 'comment_reply' | 'dm_sent' | 'webhook_received' | 'error';

export interface ActionLog {
  id: number;
  user_id: number;
  instagram_account_id: number | null;
  action_type: ActionType;
  status: string;
  details: string | null;
  comment_id: string | null;
  recipient_id: string | null;
  message_sent: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ActionLogList {
  logs: ActionLog[];
  total: number;
  page: number;
  page_size: number;
}

// API Response types
export interface ApiError {
  detail: string;
}
