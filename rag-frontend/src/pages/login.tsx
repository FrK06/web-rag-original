// src/pages/login.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Zap, Mail, Lock, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { useTheme } from '@/components/ThemeProvider';

const LoginPage: React.FC = () => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  
  // Hooks
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get the return URL from query parameters
  const returnUrl = (router.query.returnUrl as string) || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push(returnUrl);
    }
  }, [isAuthenticated, authLoading, router, returnUrl]);

    // In src/pages/login.tsx

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        console.log("Attempting login with email:", email);
        await login(email, password);
        router.push(returnUrl);
      } catch (err) {
        console.error('Login error:', err);
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

  // Handle password reset request
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Implementation would connect to your password reset API
      // await requestPasswordReset(resetEmail);
      setResetSuccess('If an account exists with this email, you will receive password reset instructions shortly.');
      setShowResetForm(false);
    } catch (err) {
      // Don't disclose whether the email exists or not for security
      setResetSuccess('If an account exists with this email, you will receive password reset instructions shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  // If still checking auth status, show loading
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            Checking authentication status...
          </p>
        </div>
      </div>
    );
  }

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

        <h2 className={`text-2xl font-bold mb-6 text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {showResetForm ? 'Reset Password' : 'Log in to your account'}
        </h2>

        {/* Success message */}
        {resetSuccess && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-green-900/30 text-green-300 border border-green-800/50' : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            <span>{resetSuccess}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {showResetForm ? (
          // Password reset form
          <form onSubmit={handleResetRequest} className="space-y-6">
            <div>
              <label htmlFor="resetEmail" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Email
              </label>
              <div className={`relative rounded-md shadow-sm`}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                </div>
                <input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetForm(false)}
                className={`flex-1 py-3 px-4 border rounded-lg shadow-sm text-sm font-medium ${
                  isDark 
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors`}
                disabled={isLoading}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  isDark 
                    ? 'tech-gradient futuristic-glow hover:opacity-90' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </div>
          </form>
        ) : (
          // Login form
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
                  autoComplete="email"
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
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetForm(true)}
                  className={`text-sm ${
                    isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  Forgot password?
                </button>
              </div>
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
                  autoComplete="current-password"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                    isDark 
                      ? 'bg-gray-800/50 border-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500' 
                      : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`flex items-center justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                isDark 
                  ? 'tech-gradient futuristic-glow hover:opacity-90' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
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
        )}

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