import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  InstagramAccount,
  AutomationSettings,
  AutomationCreate,
  AutomationUpdate,
  ActionLogList,
} from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

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

export default api;
