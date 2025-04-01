// src/components/auth/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  getCurrentUser,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  getCsrfToken
} from './authService';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPasswordRequest: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  refreshCsrfToken: () => Promise<string>;
}

// Create a safer default context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => { throw new Error('AuthContext not initialized'); },
  register: async () => { throw new Error('AuthContext not initialized'); },
  logout: async () => { throw new Error('AuthContext not initialized'); },
  resetPasswordRequest: async () => { throw new Error('AuthContext not initialized'); },
  confirmPasswordReset: async () => { throw new Error('AuthContext not initialized'); },
  refreshCsrfToken: async () => { throw new Error('AuthContext not initialized'); },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTimeout, setRefreshTimeout] = useState<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const AUTH_TIMEOUT = 5000; // 5 seconds timeout for auth requests
  const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes
  
  const router = useRouter();

  // Helper function to handle API timeouts
  const withTimeout = useCallback(async <T,>(
    promise: Promise<T>, 
    ms: number, 
    errorMessage: string
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  }, []);

  // Get a new CSRF token
  const refreshCsrfToken = useCallback(async (): Promise<string> => {
    try {
      const newToken = await getCsrfToken();
      return newToken;
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error);
      return '';
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      if (isLoading && retryCount >= MAX_RETRIES) {
        console.warn("Max authentication retries reached");
        setIsLoading(false);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        return;
      }

      try {
        // First get CSRF token
        await refreshCsrfToken();
        
        // Then check if we're already authenticated
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }
        
        // Try to get current user
        const currentUser = await withTimeout(
          getCurrentUser(),
          AUTH_TIMEOUT,
          "Authentication request timed out"
        );
        
        setUser(currentUser);
        setupRefreshTimer();
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error("Auth initialization error:", error);
        
        // Try refresh token if available
        try {
          const refreshTokenValue = localStorage.getItem('refresh_token');
          if (refreshTokenValue) {
            await withTimeout(
              refreshToken(),
              AUTH_TIMEOUT,
              "Token refresh timed out"
            );
            
            const currentUser = await withTimeout(
              getCurrentUser(),
              AUTH_TIMEOUT,
              "Authentication request timed out after refresh"
            );
            
            setUser(currentUser);
            setupRefreshTimer();
            setRetryCount(0);
          } else {
            throw new Error('No refresh token available');
          }
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
          setRetryCount(prev => prev + 1);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [refreshCsrfToken, withTimeout, retryCount, isLoading]);

  // Setup token refresh timer
  const setupRefreshTimer = useCallback(() => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        await refreshToken();
        setupRefreshTimer(); // Set up next refresh
      } catch (error) {
        console.error('Token refresh interval failed:', error);
        // Don't clear auth state on scheduled refresh failure
      }
    }, TOKEN_REFRESH_INTERVAL);
    
    setRefreshTimeout(timeout);
  }, [refreshTimeout]);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      // Get the user data and tokens
      const { user, token, refreshToken: refresh } = await withTimeout(
        loginUser(email, password),
        AUTH_TIMEOUT * 2, // Give login more time
        "Login request timed out"
      );
      
      // Store tokens securely
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refresh);
      
      // Debug log to confirm token is stored
      console.log("Token stored:", token.substring(0, 20) + "...");
      
      setUser(user);
      setupRefreshTimer();
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [withTimeout, setupRefreshTimer]);

  // Register function
  const register = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      // Get the user data and tokens
      const { user, token, refreshToken: refresh } = await withTimeout(
        registerUser(name, email, password),
        AUTH_TIMEOUT * 2,
        "Registration request timed out"
      );
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refresh);
      
      setUser(user);
      setupRefreshTimer();
      return user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [withTimeout, setupRefreshTimer]);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    // Immediately clear auth state
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    
    // Clear refresh timer
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
    
    // No server-side logout needed for now
    setIsLoading(false);
    router.push('/login');
  }, [refreshTimeout, router]);

  // Password reset request
  const resetPasswordRequest = useCallback(async (email: string): Promise<void> => {
    try {
      await withTimeout(
        requestPasswordReset(email),
        AUTH_TIMEOUT,
        "Password reset request timed out"
      );
    } catch (error) {
      console.error("Password reset request error:", error);
      // We intentionally don't re-throw the error here to avoid
      // disclosing whether an email exists in the system
    }
  }, [withTimeout]);

  // Confirm password reset
  const confirmPasswordReset = useCallback(async (token: string, newPassword: string): Promise<void> => {
    try {
      await withTimeout(
        resetPassword(token, newPassword),
        AUTH_TIMEOUT,
        "Password reset confirmation timed out"
      );
    } catch (error) {
      console.error("Password reset confirmation error:", error);
      throw error;
    }
  }, [withTimeout]);

  // Provide auth context
  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    resetPasswordRequest,
    confirmPasswordReset,
    refreshCsrfToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;