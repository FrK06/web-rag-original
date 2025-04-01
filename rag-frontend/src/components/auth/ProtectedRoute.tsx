import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect if not loading, not authenticated, and hasn't already redirected
    if (!isLoading && !isAuthenticated && !hasRedirected) {
      setHasRedirected(true); // Prevent multiple redirects
      router.push({
        pathname: '/login',
        query: { returnUrl: router.asPath !== '/login' ? router.asPath : '/' }
      });
    }
  }, [isAuthenticated, isLoading, router, hasRedirected]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Only render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;