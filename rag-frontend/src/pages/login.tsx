// rag-frontend/src/pages/login.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Zap, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { useTheme } from '@/components/ThemeProvider';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get the return URL from the query parameters
  const returnUrl = (router.query.returnUrl as string) || '/';

  // Check if user is already authenticated and redirect if needed
  useEffect(() => {
    // If already authenticated and not in the loading state, redirect to returnUrl or home
    if (isAuthenticated && !authLoading) {
      router.push(returnUrl);
    }
  }, [isAuthenticated, authLoading, router, returnUrl]);

  // If authentication is still being checked, show loading screen
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If user is authenticated, don't render the login form at all (prevent flicker)
  if (isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // The useEffect will handle the redirect after successful login
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
      <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${isDark ? 'bg-[#131520] border border-gray-800' : 'bg-white border border-gray-200'}`}>
        {/* Logo and title */}
        <div className="flex items-center justify-center mb-8">
          {isDark ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center tech-gradient futuristic-glow">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                  Multimodal RAG Assistant
                </h1>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Zap size={24} className="text-blue-500" />
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Multimodal RAG Assistant</h1>
            </div>
          )}
        </div>

        <h2 className={`text-2xl font-bold mb-6 text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Log in to your account</h2>

        {/* Error message */}
        {error && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Email
            </label>
            <div className={`relative rounded-md shadow-sm`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  isDark 
                    ? 'bg-gray-800/50 border-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500' 
                    : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Password
            </label>
            <div className={`relative rounded-md shadow-sm`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  isDark 
                    ? 'bg-gray-800/50 border-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500' 
                    : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end mt-1">
              <Link href="/forgot-password" className={`text-sm ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'}`}>
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`flex items-center justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
              isDark 
                ? 'tech-gradient futuristic-glow hover:opacity-90' 
                : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </span>
            ) : (
              <span className="flex items-center">
                <LogIn size={18} className="mr-2" />
                Sign In
              </span>
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p className={`mt-6 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Don't have an account?{' '}
          <Link href="/register" className={`font-medium ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'}`}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;