// src/components/chat/components/MessagesContainer.tsx
import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import MessageItem from './MessageItem';
import WelcomeScreen from './WelcomeScreen';
import { useTheme } from '@/components/ThemeProvider';

interface MessagesContainerProps {
  messages: Message[];
  isSpeaking: boolean;
  currentAudio: HTMLAudioElement | null;
  onPlayAudio: (text: string, messageIndex: number) => Promise<void>;
  onStopAudio: () => void;
  onOpenImageModal: (imageUrl: string) => void;
}

const MessagesContainer: React.FC<MessagesContainerProps> = ({
  messages,
  isSpeaking,
  currentAudio,
  onPlayAudio,
  onStopAudio,
  onOpenImageModal
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div 
      className={`flex-1 overflow-y-auto py-6 px-4 ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'}`}
      style={{
        scrollbarColor: isDark ? '#374151 #131520' : '#cbd5e1 #f1f5f9',
        scrollbarWidth: 'thin'
      }}
    >
      <div className="max-w-5xl mx-auto space-y-5 overflow-hidden">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          messages.map((message, idx) => (
            <MessageItem
              key={idx}
              message={message}
              index={idx}
              messages={messages}
              isSpeaking={isSpeaking}
              currentAudio={currentAudio}
              onPlayAudio={onPlayAudio}
              onStopAudio={onStopAudio}
              onOpenImageModal={onOpenImageModal}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessagesContainer;