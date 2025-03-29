// src/components/auth/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  getCurrentUser,
  refreshToken
} from './authService';

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
}

// Create a dummy user for the default context
const dummyUser: User = {
  id: '',
  name: '',
  email: '',
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => dummyUser, // Return dummy user
  register: async () => dummyUser, // Return dummy user
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  const AUTH_TIMEOUT = 5000; // 5 seconds timeout
  const router = useRouter();

  // Helper function to handle API timeouts
  const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  };

  // Helper function to manage tokens
  const saveTokens = (token: string, refreshTokenValue: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshTokenValue);
  };

  const clearTokens = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      // Don't try too many times
      if (retryCount >= MAX_RETRIES) {
        console.warn("Max authentication retries reached, stopping attempts");
        setIsLoading(false);
        setUser(null);
        clearTokens();
        return;
      }

      // Only proceed if we have a token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Try to get current user with timeout
        const currentUser = await withTimeout(
          getCurrentUser(),
          AUTH_TIMEOUT,
          "Authentication request timed out"
        );
        
        setUser(currentUser);
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error("Auth error:", error);
        
        // Only try to refresh if we have a refresh token
        const refreshTokenValue = localStorage.getItem('refresh_token');
        if (refreshTokenValue) {
          try {
            await withTimeout(
              refreshToken(),
              AUTH_TIMEOUT,
              "Token refresh timed out"
            );
            
            // Try again with the new token
            const currentUser = await withTimeout(
              getCurrentUser(), 
              AUTH_TIMEOUT,
              "Authentication request timed out after refresh"
            );
            
            setUser(currentUser);
            setRetryCount(0); // Reset retry count on success
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            clearTokens();
            setUser(null);
            setRetryCount(prev => prev + 1);
          }
        } else {
          clearTokens();
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [retryCount]);

  // Setup token refresh interval
  useEffect(() => {
    // Only set up refresh if authenticated
    if (!user) return;
    
    // Refresh token every 25 minutes to prevent expiration
    const refreshInterval = setInterval(async () => {
      try {
        await withTimeout(
          refreshToken(),
          AUTH_TIMEOUT,
          "Token refresh interval timed out"
        );
        console.log("Token refreshed successfully");
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Don't clear tokens on refresh interval failures
        // Let the next init attempt handle it
      }
    }, 25 * 60 * 1000); // 25 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user, token, refreshToken: refresh } = await withTimeout(
        loginUser(email, password),
        AUTH_TIMEOUT * 2, // Give login a bit more time
        "Login request timed out"
      );
      
      // Store tokens
      saveTokens(token, refresh);
      setUser(user);
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error; // Rethrow to let the component handle it
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user, token, refreshToken: refresh } = await withTimeout(
        registerUser(name, email, password),
        AUTH_TIMEOUT * 2, // Give register a bit more time
        "Registration request timed out"
      );
      
      // Store tokens
      saveTokens(token, refresh);
      setUser(user);
      return user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error; // Rethrow to let the component handle it
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Try to inform the server, but don't wait too long
      await Promise.race([
        logoutUser(),
        new Promise(resolve => setTimeout(resolve, 2000)) // 2s max
      ]);
    } catch (error) {
      console.error("Logout API error:", error);
      // Continue with local logout even if API fails
    } finally {
      // Always clear local state
      clearTokens();
      setUser(null);
      setIsLoading(false);
      router.push('/login');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;