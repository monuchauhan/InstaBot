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
export type AutomationType = 'auto_reply_comment' | 'send_dm';

export interface AutomationSettings {
  id: number;
  user_id: number;
  instagram_account_id: number | null;
  automation_type: AutomationType;
  is_enabled: boolean;
  template_message: string | null;
  trigger_keywords: string[] | null;
  target_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationCreate {
  automation_type: AutomationType;
  instagram_account_id?: number;
  is_enabled?: boolean;
  template_message?: string;
  trigger_keywords?: string[];
  target_post_id?: string;
}

export interface AutomationUpdate {
  is_enabled?: boolean;
  template_message?: string;
  trigger_keywords?: string[];
  target_post_id?: string;
}

// Conversation Flow types
export interface QuickReplyOption {
  title: string;
  payload: string;
}

export interface ConversationStep {
  id: number;
  flow_id: number;
  parent_step_id: number | null;
  step_order: number;
  payload_trigger: string | null;
  button_title: string | null;
  message_text: string;
  quick_replies: QuickReplyOption[] | null;
  is_end_step: boolean;
  child_steps?: ConversationStep[];
  created_at: string;
  updated_at: string;
}

export interface ConversationStepCreate {
  parent_step_id?: number | null;
  step_order?: number;
  payload_trigger?: string;
  button_title?: string;
  message_text: string;
  quick_replies?: QuickReplyOption[];
  is_end_step?: boolean;
}

export interface ConversationStepUpdate {
  step_order?: number;
  payload_trigger?: string;
  button_title?: string;
  message_text?: string;
  quick_replies?: QuickReplyOption[];
  is_end_step?: boolean;
}

export interface ConversationFlow {
  id: number;
  automation_id: number;
  name: string;
  description: string | null;
  initial_message: string;
  steps: ConversationStep[];
  created_at: string;
  updated_at: string;
}

export interface ConversationFlowCreate {
  automation_id: number;
  name: string;
  description?: string;
  initial_message: string;
  steps?: ConversationStepCreate[];
}

export interface ConversationFlowUpdate {
  name?: string;
  description?: string;
  initial_message?: string;
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

// Inbox types
export interface ConversationSummary {
  recipient_id: string;
  recipient_username: string;
  total_messages: number;
  last_message: string;
  last_action_type: string;
  last_status: string;
  last_timestamp: string;
}

export interface ConversationList {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface InboxMessage {
  id: number;
  action_type: string;
  status: string;
  message: string;
  comment_id: string | null;
  recipient_username: string;
  details: string | null;
  created_at: string;
}

export interface ConversationMessages {
  messages: InboxMessage[];
  total: number;
  page: number;
  page_size: number;
  recipient_id: string;
}
