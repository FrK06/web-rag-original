// src/pages/verify-email.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/components/auth/authService';
import { useTheme } from '@/components/ThemeProvider';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!router.isReady) return;
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email again.');
      return;
    }

    const verifyEmail = async () => {
      try {
        await apiClient.post('/api/auth/verify-email', { token });
        setStatus('success');
        setMessage('Your email has been successfully verified!');
      } catch (error) {
        setStatus('error');
        setMessage('This verification link is invalid or has expired.');
      }
    };

    verifyEmail();
  }, [router.isReady, token]);

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}>
      <div className={`max-w-md w-full p-8 rounded-lg shadow-lg ${
        isDark ? 'bg-[#131520] border border-gray-800' : 'bg-white'
      }`}>
        {status === 'loading' && (
          <div className="text-center py-8">
            <Loader2 className={`animate-spin h-12 w-12 mx-auto mb-4 ${isDark ? 'text-indigo-500' : 'text-blue-600'}`} />
            <h2 className={`text-xl font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Verifying your email...
            </h2>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center py-8">
            <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 ${
              isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-600'
            }`}>
              <Check size={32} />
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Email Verified!
            </h2>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{message}</p>
            <Link 
              href="/login"
              className={`inline-block px-5 py-3 rounded-lg font-medium ${
                isDark ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Continue to Login
            </Link>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center py-8">
            <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 ${
              isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-600'
            }`}>
              <AlertCircle size={32} />
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Verification Failed
            </h2>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{message}</p>
            <Link 
              href="/login"
              className={`inline-block px-5 py-3 rounded-lg font-medium ${
                isDark ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Return to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}