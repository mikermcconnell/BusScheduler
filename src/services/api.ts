/**
 * API Service
 * Centralized API client for communicating with the backend
 */

import { sanitizeErrorMessage } from '../utils/inputSanitizer';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
const TOKEN_KEY = 'scheduler2_access_token';
const REFRESH_TOKEN_KEY = 'scheduler2_refresh_token';

// Types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  role: 'admin' | 'scheduler' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Custom error class
export class ApiError extends Error {
  public statusCode: number;
  public errors?: any[];

  constructor(message: string, statusCode: number = 500, errors?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// Token management
class TokenManager {
  static getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  static setTokens(tokens: AuthTokens): void {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  static clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch {
      return true;
    }
  }
}

// API Client
class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = TokenManager.getAccessToken();

    // Default headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add auth header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized
      if (response.status === 401 && token) {
        // Try to refresh token
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          this.refreshPromise = this.refreshAccessToken();
        }

        // Wait for refresh to complete
        if (this.refreshPromise) {
          await this.refreshPromise;
          this.isRefreshing = false;
          this.refreshPromise = null;

          // Retry original request with new token
          const newToken = TokenManager.getAccessToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            });
            return this.handleResponse<T>(retryResponse);
          }
        }

        // If refresh failed, clear tokens and throw error
        TokenManager.clearTokens();
        throw new ApiError('Session expired. Please login again.', 401);
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      const message = error instanceof Error ? error.message : 'Network error occurred';
      throw new ApiError(sanitizeErrorMessage(message), 0);
    }
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errors: any[] = [];

      if (isJson) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
          errors = errorData.error?.errors || errorData.errors || [];
        } catch {
          // If JSON parsing fails, use default message
        }
      }

      throw new ApiError(sanitizeErrorMessage(errorMessage), response.status, errors);
    }

    if (isJson) {
      return response.json();
    }

    return response.text() as any;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    const refreshToken = TokenManager.getRefreshToken();
    
    if (!refreshToken) {
      throw new ApiError('No refresh token available', 401);
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new ApiError('Failed to refresh token', response.status);
      }

      const data = await response.json();
      TokenManager.setTokens(data.tokens);
    } catch (error) {
      TokenManager.clearTokens();
      throw error;
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Upload file
   */
  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const token = TokenManager.getAccessToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Auth API
export const authApi = {
  async register(data: {
    email: string;
    username: string;
    password: string;
    fullName?: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<any>('/auth/register', data);
    TokenManager.setTokens(response.tokens);
    return response;
  },

  async login(emailOrUsername: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<any>('/auth/login', {
      emailOrUsername,
      password,
    });
    TokenManager.setTokens(response.tokens);
    return response;
  },

  async logout(): Promise<void> {
    const refreshToken = TokenManager.getRefreshToken();
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      TokenManager.clearTokens();
    }
  },

  async getProfile(): Promise<{ user: User }> {
    return apiClient.get('/auth/profile');
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
    TokenManager.clearTokens();
  },

  isAuthenticated(): boolean {
    const token = TokenManager.getAccessToken();
    return !!token && !TokenManager.isTokenExpired(token);
  },
};

// Schedule API
export const scheduleApi = {
  async list(params?: {
    routeId?: string;
    status?: string;
    dayType?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    const response = await apiClient.get<any>('/schedules', params);
    return {
      data: response.schedules,
      pagination: response.pagination,
    };
  },

  async get(id: string): Promise<any> {
    const response = await apiClient.get<any>(`/schedules/${id}`);
    return response.schedule;
  },

  async create(data: any): Promise<any> {
    const response = await apiClient.post<any>('/schedules', data);
    return response.schedule;
  },

  async update(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/schedules/${id}`, data);
    return response.schedule;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/schedules/${id}`);
  },

  async publish(id: string): Promise<any> {
    const response = await apiClient.post<any>(`/schedules/${id}/publish`);
    return response.schedule;
  },

  async uploadFile(file: File, scheduleId?: string): Promise<any> {
    return apiClient.upload('/schedules/upload', file, { scheduleId });
  },
};

// Route API
export const routeApi = {
  async list(): Promise<any[]> {
    const response = await apiClient.get<any>('/routes');
    return response.routes;
  },

  async get(id: string): Promise<any> {
    const response = await apiClient.get<any>(`/routes/${id}`);
    return response.route;
  },

  async create(data: {
    routeNumber: string;
    routeName: string;
    direction?: string;
    description?: string;
    color?: string;
  }): Promise<any> {
    const response = await apiClient.post<any>('/routes', data);
    return response.route;
  },

  async update(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/routes/${id}`, data);
    return response.route;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/routes/${id}`);
  },
};

export default apiClient;