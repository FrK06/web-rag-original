// rag-frontend/src/pages/index.tsx
import { Geist } from 'next/font/google';
import { ChatInterface } from '@/components/chat';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthContext';

const geist = Geist({
  subsets: ['latin'],
});

export default function Home() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <main className={`${geist.className} min-h-screen`}>
        <ChatInterface userName={user?.name} />
      </main>
    </ProtectedRoute>
  );
}