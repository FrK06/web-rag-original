// src/components/auth/social-login.tsx
import { useState } from 'react';
import { Mail, Code, MessageSquare, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

// OAuth configuration
const OAUTH_CONFIG = {
  google: {
    url: '/api/auth/oauth/google',
    name: 'Google',
    icon: Mail,
    color: 'bg-white hover:bg-gray-100',
    textColor: 'text-gray-800',
    iconColor: 'text-red-500',
  },
  github: {
    url: '/api/auth/oauth/github',
    name: 'GitHub',
    icon: Code,
    color: 'bg-gray-900 hover:bg-gray-800',
    textColor: 'text-white',
    iconColor: 'text-white',
  },
  facebook: {
    url: '/api/auth/oauth/facebook',
    name: 'Facebook',
    icon: MessageSquare,
    color: 'bg-blue-600 hover:bg-blue-700',
    textColor: 'text-white',
    iconColor: 'text-white',
  }
};

export type OAuthProvider = keyof typeof OAUTH_CONFIG;

export function SocialLogin() {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const handleOAuth = (provider: OAuthProvider) => {
    setLoading(provider);
    
    // Create state param to prevent CSRF
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem('oauth_state', state);
    
    // Redirect to OAuth endpoint
    window.location.href = `${OAUTH_CONFIG[provider].url}?state=${state}`;
  };
  
  return (
    <div className="space-y-3">
      {Object.entries(OAUTH_CONFIG).map(([key, config]) => {
        const provider = key as OAuthProvider;
        const Icon = config.icon;
        
        return (
          <button
            key={provider}
            onClick={() => handleOAuth(provider)}
            disabled={loading !== null}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg ${
              isDark && provider !== 'github' ? 'border border-gray-700' : ''
            } ${config.color} ${config.textColor} transition-colors`}
          >
            {loading === provider ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            )}
            <span>Continue with {config.name}</span>
          </button>
        );
      })}
      
      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <div className={`w-full border-t ${isDark ? 'border-gray-800' : 'border-gray-300'}`} />
        </div>
        <div className="relative flex justify-center">
          <span className={`px-2 ${isDark ? 'bg-[#131520] text-gray-500' : 'bg-white text-gray-500'}`}>
            or continue with email
          </span>
        </div>
      </div>
    </div>
  );
}