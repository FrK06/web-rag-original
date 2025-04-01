// src/components/auth/authService.ts
import axios from 'axios';
import { User } from './AuthContext';

// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30 seconds

// Create an axios instance with defaults
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for CSRF protection with cookies
});

// Add auth token to requests if available
// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Also add CSRF token
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        await refreshToken();
        
        // Update the auth header with the new token
        const newToken = localStorage.getItem('auth_token');
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, clear token and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Enhance security errors with useful messages
    if (error.response?.status === 403) {
      error.message = 'Access denied. Please check your permissions.';
    } else if (error.response?.status === 429) {
      error.message = 'Too many requests. Please try again later.';
    }
    
    return Promise.reject(error);
  }
);

// Response types
export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Fetch a CSRF token
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await apiClient.get('/api/auth/csrf-token');
    const token = response.data.token;
    
    // Store in localStorage for use in requests
    localStorage.setItem('csrf_token', token);
    
    // Update the default headers with the new CSRF token
    apiClient.defaults.headers.common['X-CSRF-Token'] = token;
    
    console.log("CSRF token fetched and stored:", token);
    
    return token;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return '';
  }
};

// Login function with proper form data
export const loginUser = async (
  email: string, 
  password: string
): Promise<{ user: User; token: string; refreshToken: string }> => {
  try {
    // Step 1: Get CSRF token explicitly
    await getCsrfToken();
    
    console.log("Sending login request with credentials:", { email });
    
    // Step 2: Create form data
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    // Step 3: Make login request with proper content type
    const response = await apiClient.post('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-Token': localStorage.getItem('csrf_token') || ''
      }
    });
    
    console.log("Login successful, storing tokens");
    
    // Step 4: Return the response data
    return {
      user: response.data.user,
      token: response.data.access_token,
      refreshToken: response.data.refresh_token
    };
  } catch (error) {
    console.error('Login error details:', error);
    
    // Throw a more user-friendly error
    throw new Error(
      error instanceof Error ? 
        error.message : 
        'Login failed. Please check your credentials and try again.'
    );
  }
};

// Registration function with CSRF token
export const registerUser = async (
  name: string, 
  email: string, 
  password: string
): Promise<{ user: User; token: string; refreshToken: string }> => {
  try {
    // Step 1: Get CSRF token first
    await getCsrfToken();
    
    // Step 2: Make the registration request
    const response = await apiClient.post<AuthResponse>('/api/auth/register', {
      name,
      email,
      password
    });
    
    return {
      user: response.data.user,
      token: response.data.access_token,
      refreshToken: response.data.refresh_token
    };
  } catch (error) {
    console.error('Registration error details:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      
      // Return specific error messages for common registration issues
      if (error.response.status === 400 && errorData?.detail?.includes('already registered')) {
        throw new Error('This email is already registered');
      } else if (errorData?.detail) {
        throw new Error(errorData.detail);
      }
    }
    
    throw new Error('Registration failed. Please try again later');
  }
};

// Token refresh function
export const refreshToken = async (): Promise<{ accessToken: string }> => {
  const refreshTokenValue = localStorage.getItem('refresh_token');
  
  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }
  
  try {
    // First, get a fresh CSRF token
    await getCsrfToken();
    
    // Send the refresh token request
    const response = await apiClient.post<TokenResponse>('/api/auth/refresh', {
      refresh_token: refreshTokenValue
    });
    
    // Store the new tokens
    localStorage.setItem('auth_token', response.data.access_token);
    
    // Only update refresh token if provided
    if (response.data.refresh_token) {
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    
    return {
      accessToken: response.data.access_token
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    
    // Clear tokens on certain errors
    if (axios.isAxiosError(error) && error.response && 
        (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
    
    throw error;
  }
};

// Logout function
export const logoutUser = async (refreshToken: string): Promise<void> => {
  try {
    // Use the special client-logout endpoint that doesn't require auth
    await apiClient.post('/api/auth/client-logout', { 
      refresh_token: refreshToken 
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Continue even if API call fails
  }
};

// Get current user info
export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
};

// Password reset request
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    // Get fresh CSRF token
    await getCsrfToken();
    
    await apiClient.post('/api/auth/request-reset', { email });
  } catch (error) {
    console.error('Password reset request error:', error);
    // Don't expose whether email exists or not
    throw new Error('Error processing request');
  }
};

// Confirm password reset
export const resetPassword = async (
  token: string, 
  newPassword: string
): Promise<void> => {
  try {
    // Get fresh CSRF token
    await getCsrfToken();
    
    await apiClient.post('/api/auth/reset-password', {
      token,
      new_password: newPassword
    });
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 400) {
        throw new Error('Invalid or expired token');
      } else if (error.response.data?.detail) {
        throw new Error(error.response.data.detail);
      }
    }
    
    throw new Error('Failed to reset password');
  }
};

// Export the api client for use in other modules
export { apiClient };