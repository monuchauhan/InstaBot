import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  InstagramAccount,
  InstagramPost,
  AutomationSettings,
  AutomationCreate,
  AutomationUpdate,
  ActionLogList,
  ConversationFlow,
  ConversationFlowCreate,
  ConversationFlowUpdate,
  ConversationStep,
  ConversationStepCreate,
  ConversationStepUpdate,
  DashboardAnalytics,
  ConversationList,
  ConversationMessages,
} from '../types';

// Use relative URL so requests go to the same host that served the page.
// Nginx proxies /api/* to the backend container - works in localhost,
// Codespaces, and production without any changes.
const API_URL = process.env.REACT_APP_API_URL || '/api/v1';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post<AuthTokens>(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (data: RegisterData): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },
  
  login: async (credentials: LoginCredentials): Promise<AuthTokens> => {
    const response = await api.post<AuthTokens>('/auth/login/json', credentials);
    return response.data;
  },
  
  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
  
  updateMe: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/auth/me', data);
    return response.data;
  },
};

// Instagram API
export const instagramApi = {
  getConnectUrl: async (): Promise<{ oauth_url: string }> => {
    const response = await api.get<{ oauth_url: string }>('/instagram/connect-url');
    return response.data;
  },
  
  callback: async (code: string, state?: string): Promise<InstagramAccount> => {
    const response = await api.post<InstagramAccount>('/instagram/callback', { code, state });
    return response.data;
  },
  
  getAccounts: async (): Promise<InstagramAccount[]> => {
    const response = await api.get<InstagramAccount[]>('/instagram/accounts');
    return response.data;
  },
  
  getAccount: async (accountId: number): Promise<InstagramAccount> => {
    const response = await api.get<InstagramAccount>(`/instagram/accounts/${accountId}`);
    return response.data;
  },
  
  disconnectAccount: async (accountId: number): Promise<void> => {
    await api.delete(`/instagram/accounts/${accountId}`);
  },
  
  getPosts: async (accountId: number, limit: number = 50): Promise<InstagramPost[]> => {
    const response = await api.get<InstagramPost[]>(`/instagram/accounts/${accountId}/posts`, {
      params: { limit },
    });
    return response.data;
  },
};

// Automation API
export const automationApi = {
  getAll: async (): Promise<AutomationSettings[]> => {
    const response = await api.get<AutomationSettings[]>('/automations');
    return response.data;
  },
  
  create: async (data: AutomationCreate): Promise<AutomationSettings> => {
    const response = await api.post<AutomationSettings>('/automations', data);
    return response.data;
  },
  
  get: async (automationId: number): Promise<AutomationSettings> => {
    const response = await api.get<AutomationSettings>(`/automations/${automationId}`);
    return response.data;
  },
  
  update: async (automationId: number, data: AutomationUpdate): Promise<AutomationSettings> => {
    const response = await api.put<AutomationSettings>(`/automations/${automationId}`, data);
    return response.data;
  },
  
  delete: async (automationId: number): Promise<void> => {
    await api.delete(`/automations/${automationId}`);
  },
  
  toggle: async (automationId: number): Promise<AutomationSettings> => {
    const response = await api.post<AutomationSettings>(`/automations/${automationId}/toggle`);
    return response.data;
  },
};

// Conversation Flow API
export const conversationFlowApi = {
  getAll: async (): Promise<ConversationFlow[]> => {
    const response = await api.get<ConversationFlow[]>('/conversation-flows');
    return response.data;
  },

  get: async (flowId: number): Promise<ConversationFlow> => {
    const response = await api.get<ConversationFlow>(`/conversation-flows/${flowId}`);
    return response.data;
  },

  getByAutomation: async (automationId: number): Promise<ConversationFlow> => {
    const response = await api.get<ConversationFlow>(`/conversation-flows/by-automation/${automationId}`);
    return response.data;
  },

  create: async (data: ConversationFlowCreate): Promise<ConversationFlow> => {
    const response = await api.post<ConversationFlow>('/conversation-flows', data);
    return response.data;
  },

  update: async (flowId: number, data: ConversationFlowUpdate): Promise<ConversationFlow> => {
    const response = await api.put<ConversationFlow>(`/conversation-flows/${flowId}`, data);
    return response.data;
  },

  delete: async (flowId: number): Promise<void> => {
    await api.delete(`/conversation-flows/${flowId}`);
  },

  // Steps
  addStep: async (flowId: number, data: ConversationStepCreate): Promise<ConversationStep> => {
    const response = await api.post<ConversationStep>(`/conversation-flows/${flowId}/steps`, data);
    return response.data;
  },

  updateStep: async (flowId: number, stepId: number, data: ConversationStepUpdate): Promise<ConversationStep> => {
    const response = await api.put<ConversationStep>(`/conversation-flows/${flowId}/steps/${stepId}`, data);
    return response.data;
  },

  deleteStep: async (flowId: number, stepId: number): Promise<void> => {
    await api.delete(`/conversation-flows/${flowId}/steps/${stepId}`);
  },
};

// Logs API
export const logsApi = {
  getAll: async (
    page: number = 1,
    pageSize: number = 20,
    actionType?: string,
    status?: string
  ): Promise<ActionLogList> => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    
    if (actionType) params.append('action_type', actionType);
    if (status) params.append('status', status);
    
    const response = await api.get<ActionLogList>(`/logs?${params.toString()}`);
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getDashboard: async (days: number = 30): Promise<DashboardAnalytics> => {
    const response = await api.get<DashboardAnalytics>('/analytics/dashboard', {
      params: { days },
    });
    return response.data;
  },
};

// Inbox API
export const inboxApi = {
  getConversations: async (
    page: number = 1,
    pageSize: number = 20,
    filterType?: string
  ): Promise<ConversationList> => {
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (filterType) params.filter_type = filterType;
    const response = await api.get<ConversationList>('/inbox/conversations', { params });
    return response.data;
  },

  getMessages: async (
    recipientId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ConversationMessages> => {
    const response = await api.get<ConversationMessages>(
      `/inbox/conversations/${encodeURIComponent(recipientId)}/messages`,
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },
};

export default api;
