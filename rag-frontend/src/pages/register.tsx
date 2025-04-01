// rag-frontend/src/pages/register.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Zap, Mail, Lock, User, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { useTheme } from '@/components/ThemeProvider';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await register(name, email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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

        <h2 className={`text-2xl font-bold mb-6 text-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Create an account</h2>

        {/* Error message */}
        {error && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Full Name
            </label>
            <div className={`relative rounded-md shadow-sm`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
              </div>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  isDark 
                    ? 'bg-gray-800/50 border-gray-700 text-gray-200 focus:ring-indigo-500 focus:border-indigo-500' 
                    : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="John Doe"
              />
            </div>
          </div>

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
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Password must be at least 8 characters long
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
                required
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
            className={`mt-6 flex items-center justify-center w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
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
                Creating account...
              </span>
            ) : (
              <span className="flex items-center">
                <UserPlus size={18} className="mr-2" />
                Create Account
              </span>
            )}
          </button>
        </form>

        {/* Sign in link */}
        <p className={`mt-6 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Already have an account?{' '}
          <Link href="/login" className={`font-medium ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-blue-600 hover:text-blue-500'}`}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;