// src/components/auth/apiClient.ts (TypeScript-friendly version)

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Extend the AxiosRequestConfig interface
declare module 'axios' {
  export interface AxiosRequestConfig {
    startTime?: number;
  }
}

// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://loadant.com';
const API_TIMEOUT = 30000; // 30 seconds

console.log("API client initializing with URL:", API_URL);

// Create an axios instance with defaults
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for CSRF protection with cookies
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    
    // Log request details for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log("Token available:", token ? "Yes" : "No");
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (config.method !== 'get' && config.method !== 'options') {
      const csrfToken = localStorage.getItem('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    
    // Add request timestamp for debugging
    config.startTime = new Date().getTime();
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Calculate and log response time for performance monitoring
    if (response.config.startTime) {
      const requestTime = new Date().getTime() - response.config.startTime;
      console.log(`${response.config.url} - Response time: ${requestTime}ms`);
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Log detailed error information for debugging
    if (error.response) {
      console.error(`API Error ${error.response.status}: ${error.response.config.url}`, 
                   error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Request setup error:", error.message);
    }
    
    // Handle token expiration - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log("Attempting to refresh token...");
        
        // Try to refresh token using a separate axios call to avoid interceptor loop
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        // Get fresh CSRF token first
        await getCsrfToken();
        
        // Send the refresh token request
        const response = await axios.post(`${API_URL}/api/auth/refresh`, 
          { refresh_token: refreshToken },
          { 
            headers: { 
              'Content-Type': 'application/json',
              'X-CSRF-Token': localStorage.getItem('csrf_token') || ''
            },
            withCredentials: true
          }
        );
        
        if (response.data.access_token) {
          // Store the new tokens
          localStorage.setItem('auth_token', response.data.access_token);
          
          // Only update refresh token if provided
          if (response.data.refresh_token) {
            localStorage.setItem('refresh_token', response.data.refresh_token);
          }
          
          console.log("Token refreshed successfully");
          
          // Update the auth header with the new token
          originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
          
          // Retry the original request with new token
          return apiClient(originalRequest);
        } else {
          throw new Error('Token refresh failed: No access token returned');
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear tokens on certain errors
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session=expired';
        }
        
        return Promise.reject(refreshError);
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

// Fetch a CSRF token
export const getCsrfToken = async (): Promise<string> => {
  try {
    console.log("Fetching CSRF token from:", `${API_URL}/api/auth/csrf-token`);
    
    // Use basic axios to avoid interceptor loops
    const response = await axios.get(`${API_URL}/api/auth/csrf-token`, {
      withCredentials: true,
      timeout: 10000
    });
    
    if (!response.data || !response.data.token) {
      console.error("Invalid CSRF token response:", response.data);
      return '';
    }
    
    const token = response.data.token;
    
    // Store in localStorage for use in requests
    localStorage.setItem('csrf_token', token);
    
    // Update the default headers with the new CSRF token
    apiClient.defaults.headers.common['X-CSRF-Token'] = token;
    
    console.log("CSRF token fetched and stored:", token.substring(0, 10) + '...');
    
    return token;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return '';
  }
};

// Helper function for retrying failed requests
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`Retry attempt ${attempt}/${maxRetries}`);
      
      // Only wait if we're going to retry again
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError;
};

// Export the api client for use in other modules
export default apiClient;