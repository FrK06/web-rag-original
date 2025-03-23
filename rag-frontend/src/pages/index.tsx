import { Geist } from 'next/font/google';
import { ChatInterface } from '@/components/chat';

const geist = Geist({
  subsets: ['latin'],
});

export default function Home() {
  return (
    <main className={`${geist.className} min-h-screen`}>
      <ChatInterface />
    </main>
  );
}