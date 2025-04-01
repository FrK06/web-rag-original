// src/pages/reset-password.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Check, Zap, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { useTheme } from '@/components/ThemeProvider';

const PasswordResetPage: React.FC = () => {
  const router = useRouter();
  const { token } = router.query;
  const { confirmPasswordReset, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  
  // Check if token is available
  useEffect(() => {
    if (router.isReady && !token) {
      setError('Invalid or missing reset token');
    }
  }, [router.isReady, token]);
  
  // Check password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(null);
      return;
    }
    
    // Simple password strength check
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    
    const score = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecialChars, isLongEnough]
      .filter(Boolean).length;
    
    if (score <= 2) setPasswordStrength('weak');
    else if (score <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [password]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError(null);
    
    // Validate input
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (passwordStrength === 'weak') {
      setError('Please use a stronger password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call the password reset API
      await confirmPasswordReset(token as string, password);
      setSuccess(true);
    } catch (err) {
      console.error('Reset error:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const getPasswordStrengthClasses = () => {
    if (!passwordStrength) return '';
    
    switch (passwordStrength) {
      case 'weak':
        return isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700';
      case 'medium':
        return isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700';
      case 'strong':
        return isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700';
    }
  };
  
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
      <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${isDark ? 'bg-[#131520] border border-gray-800' : 'bg-white border border-gray-200'}`}>
        {/* Logo */}
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
          Reset Your Password
        </h2>
        
        {success ? (
          <div className="text-center space-y-6">
            <div className={`p-4 rounded-lg flex flex-col items-center ${
              isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
            }`}>
              <Check size={48} className="mb-2" />
              <p className="font-medium">Password reset successful!</p>
              <p className="text-sm mt-2">
                Your password has been updated. You can now log in with your new password.
              </p>
            </div>
            
            <Link 
              href="/login" 
              className={`block w-full py-3 px-4 text-center rounded-lg font-medium ${
                isDark 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Error message */}
            {error && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                isDark ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-red-100 text-red-700 border border-red-200'
              }`}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  New Password
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
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                      isDark 
                        ? 'bg-gray-800/50 border-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500' 
                        : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="••••••••"
                  />
                </div>
                
                {passwordStrength && (
                  <div className={`mt-2 text-xs px-3 py-1 rounded-full inline-block ${getPasswordStrengthClasses()}`}>
                    Password strength: {passwordStrength}
                  </div>
                )}
                
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Password must be at least 8 characters and include letters, numbers, and special characters.
                </p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Confirm Password
                </label>
                <div className={`relative rounded-md shadow-sm`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Resetting Password...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
              
              <p className={`text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Remember your password?{' '}
                <Link href="/login" className={`font-medium ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'}`}>
                  Sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordResetPage;