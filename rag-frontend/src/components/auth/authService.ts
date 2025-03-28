// rag-frontend/src/components/auth/authService.ts
import axios from 'axios';
import { User } from './AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Axios instance with authentication header
const authAxios = axios.create({
  baseURL: API_URL
});

// Add auth token to requests if available
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Try to refresh token
        await refreshToken();
        // Retry the original request
        const token = localStorage.getItem('auth_token');
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return authAxios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API calls
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Login failed');
    }
    throw new Error('Network error. Please try again.');
  }
};

export const registerUser = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      name,
      email,
      password
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Registration failed');
    }
    throw new Error('Network error. Please try again.');
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await authAxios.post(`${API_URL}/api/auth/logout`);
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with local logout even if API call fails
  }
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await authAxios.get(`${API_URL}/api/auth/me`);
  return response.data.user;
};

export const refreshToken = async (): Promise<void> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
      refreshToken
    });
    
    localStorage.setItem('auth_token', response.data.token);
    // Some implementations also refresh the refresh token
    if (response.data.refreshToken) {
      localStorage.setItem('refresh_token', response.data.refreshToken);
    }
  } catch (error) {
    // Clear tokens on refresh failure
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    throw error;
  }
};

// Export the authenticated axios instance for use in other services
export { authAxios };