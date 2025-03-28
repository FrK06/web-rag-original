// rag-frontend/src/components/auth/AuthContext.tsx
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
  const router = useRouter();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to get current user from stored token
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        // Handle token refresh if needed
        try {
          await refreshToken();
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch (refreshError) {
          // Clear invalid tokens
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Setup token refresh interval
  useEffect(() => {
    // Refresh token every 25 minutes to prevent expiration
    const refreshInterval = setInterval(async () => {
      if (user) {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    }, 25 * 60 * 1000); // 25 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user, token, refreshToken: refresh } = await loginUser(email, password);
      
      // Store tokens
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refresh);
      
      setUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user, token, refreshToken: refresh } = await registerUser(name, email, password);
      
      // Store tokens
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refresh);
      
      setUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      
      // Clear tokens
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      
      setUser(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
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