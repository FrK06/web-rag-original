import { Geist } from 'next/font/google';
import ChatInterface from '@/components/ChatInterface';

const geist = Geist({
  subsets: ['latin'],
});

export default function Home() {
  return (
    <div className={`${geist.className} min-h-screen bg-white`}>
      <ChatInterface />
    </div>
  );
}