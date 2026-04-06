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

// Instagram Post/Media types
export interface InstagramPost {
  id: string;               // Instagram media ID
  caption: string | null;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string | null;
  thumbnail_url: string | null;  // For VIDEO media_type
  timestamp: string;
  permalink: string;
}

// Automation types
export interface AutomationSettings {
  id: number;
  user_id: number;
  instagram_account_id: number | null;
  is_enabled: boolean;
  template_messages: string[] | null;
  dm_greeting: string | null;
  dm_links: string[] | null;
  trigger_keywords: string[] | null;
  target_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationCreate {
  instagram_account_id?: number;
  is_enabled?: boolean;
  template_messages?: string[];
  dm_greeting?: string;
  dm_links?: string[];
  trigger_keywords?: string[];
  target_post_id?: string;
}

export interface AutomationUpdate {
  is_enabled?: boolean;
  template_messages?: string[];
  dm_greeting?: string;
  dm_links?: string[];
  trigger_keywords?: string[];
  target_post_id?: string;
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

// Analytics types
export interface DailyStatPoint {
  date: string;
  comments: number;
  dms: number;
  total: number;
}

export interface DashboardAnalytics {
  total_comments_replied: number;
  total_dms_sent: number;
  total_errors: number;
  total_actions: number;
  comments_change_pct: number | null;
  dms_change_pct: number | null;
  actions_change_pct: number | null;
  active_automations: number;
  total_automations: number;
  active_accounts: number;
  daily_stats: DailyStatPoint[];
  period_days: number;
}
