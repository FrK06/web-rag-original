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
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
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
    console.log(`Attempting login for: ${email}`);
    
    // Send credentials as JSON (API Gateway will convert to form data)
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    console.log('Login response received:', response.status);
    return response.data;
  } catch (error) {
    console.error('Login error details:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('Server response:', error.response.status, error.response.data);
        
        // Extract meaningful error message
        const errorMessage = 
          error.response.data?.detail || 
          error.response.data?.message || 
          (error.response.status === 401 ? 'Invalid email or password' : 'Login failed');
        
        throw new Error(errorMessage);
      } else if (error.request) {
        console.error('No response received from server');
        throw new Error('Server not responding. Please try again later.');
      } else {
        console.error('Request setup error:', error.message);
        throw new Error(`Network error: ${error.message}`);
      }
    }
    
    throw new Error('Login failed. Please try again.');
  }
};

export const registerUser = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  try {
    console.log(`Attempting registration for: ${email}`);
    
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      name,
      email,
      password
    });
    
    console.log('Registration response received:', response.status);
    return response.data;
  } catch (error) {
    console.error('Registration error details:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('Server response:', error.response.status, error.response.data);
        
        // Check for common registration errors
        if (error.response.status === 400) {
          if (error.response.data?.detail?.includes('Email already registered')) {
            throw new Error('This email is already registered. Please use a different email.');
          }
        }
        
        const errorMessage = 
          error.response.data?.detail || 
          error.response.data?.message || 
          'Registration failed';
        
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('Server not responding. Please try again later.');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
    
    throw new Error('Registration failed. Please try again later.');
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;
    
    await authAxios.post(`${API_URL}/api/auth/logout`, { refresh_token: refreshToken });
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with local logout even if API call fails
  }
};

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await authAxios.get(`${API_URL}/api/auth/me`);
    return response.data.user || response.data;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
};

export const refreshToken = async (): Promise<void> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
      refresh_token: refreshToken
    });
    
    localStorage.setItem('auth_token', response.data.token || response.data.access_token);
    if (response.data.refreshToken || response.data.refresh_token) {
      localStorage.setItem('refresh_token', response.data.refreshToken || response.data.refresh_token);
    }
  } catch (error) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    throw error;
  }
};

export { authAxios };