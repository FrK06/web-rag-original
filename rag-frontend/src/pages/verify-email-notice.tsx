// src/pages/verify-email-notice.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Zap, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { useTheme } from '@/components/ThemeProvider';

const VerifyEmailNoticePage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { resendVerificationEmail } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  
  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }
    
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await resendVerificationEmail(email);
      setSuccessMessage('If your email exists and is not verified, a new verification email has been sent.');
    } catch (error) {
      // We don't show specific errors here to avoid disclosing whether an email exists
      console.error('Error resending verification:', error);
      setSuccessMessage('If your email exists and is not verified, a new verification email has been sent.');
    } finally {
      setIsSending(false);
    }
  };
  
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
        
        <div className={`p-4 mb-6 rounded-lg text-center ${
          isDark ? 'bg-indigo-900/30 border border-indigo-800/40' : 'bg-blue-50 border border-blue-100'
        }`}>
          <CheckCircle 
            className={`mx-auto mb-3 ${isDark ? 'text-indigo-400' : 'text-blue-500'}`} 
            size={40} 
          />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            Verify Your Email
          </h2>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
            We've sent a verification email to your inbox.
            Please check your email and click the verification link to activate your account.
          </p>
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-green-900/30 text-green-300 border border-green-800/50' : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            <CheckCircle size={18} />
            <span>{successMessage}</span>
          </div>
        )}
        
        {/* Error message */}
        {errorMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}
        
        {/* Resend verification form */}
        <div className="mt-6">
          <h3 className={`text-md font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Didn't receive the email?
          </h3>
          <form onSubmit={handleResendVerification} className="space-y-4">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Your Email Address
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
            
            <button
              type="submit"
              disabled={isSending}
              className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                isDark 
                  ? 'tech-gradient futuristic-glow hover:opacity-90' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70`}
            >
              {isSending ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Sending...
                </span>
              ) : (
                'Resend Verification Email'
              )}
            </button>
          </form>
        </div>
        
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className={`text-sm font-medium ${
              isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'
            }`}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailNoticePage;