// src/components/chat/components/MessageItem.tsx
import React from 'react';
import { VolumeX, Volume2, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { messageStyles } from '../utils/messageStyles';
import { formatMarkdown } from '../utils/markdownFormatter';
import { useTheme } from '@/components/ThemeProvider';

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  isSpeaking: boolean;
  currentAudio: HTMLAudioElement | null;
  onPlayAudio: (text: string, messageIndex: number) => Promise<void>;
  onStopAudio: () => void;
  onOpenImageModal: (imageUrl: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  messages,
  isSpeaking,
  currentAudio,
  onPlayAudio,
  onStopAudio,
  onOpenImageModal
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isAssistant = message.type === 'assistant';
  
  return (
    <div
      className={`p-5 rounded-xl border ${message.type === 'user' ? 'ml-12' : 'mr-12'} ${messageStyles[message.type as keyof typeof messageStyles]} ${isDark ? '' : ''} transition-all ${isDark ? 'hover:shadow-md hover:shadow-black/20' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <p className={`text-sm font-semibold uppercase tracking-wider ${
              isDark
                ? message.type === 'user' 
                  ? 'text-indigo-300' 
                  : 'text-blue-300'
                : message.type === 'user' 
                  ? 'text-blue-600' 
                  : 'text-gray-500'
            }`}>
              {message.type === 'user' ? 'You' : message.type.charAt(0).toUpperCase() + message.type.slice(1)}
            </p>
            
            {/* Add TTS button for assistant messages */}
            {isAssistant && (
              <div className="flex gap-2">
                {currentAudio && isSpeaking ? (
                  <button 
                    onClick={onStopAudio}
                    className={`p-1 rounded-full ${
                      isDark 
                        ? 'bg-red-900/50 text-red-300 hover:bg-red-800/60' 
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    } transition-colors`}
                    title="Stop speaking"
                  >
                    <VolumeX size={16} />
                  </button>
                ) : (
                  <button 
                    onClick={() => onPlayAudio(message.content, index)}
                    className={`p-1 rounded-full ${
                      isDark 
                        ? 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800/60' 
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    } transition-colors`}
                    title="Listen to this message"
                  >
                    <Volume2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Display image if present */}
          {message.imageUrl && (
            <div className="mb-3">
              <div className="relative group">
                <img 
                  src={message.imageUrl} 
                  alt={`Image in ${message.type} message`} 
                  className={`max-w-full h-auto max-h-64 rounded-lg border shadow-sm cursor-pointer ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}
                  onClick={() => onOpenImageModal(message.imageUrl!)}
                />
                <div className={`absolute inset-0 rounded-lg flex items-center justify-center ${
                  isDark 
                    ? 'bg-black bg-opacity-0 group-hover:bg-opacity-30' 
                    : 'bg-black bg-opacity-0 group-hover:bg-opacity-10'
                } transition-all`}>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className={`p-2 rounded-full shadow-md ${
                        isDark ? 'bg-black bg-opacity-60' : 'bg-white bg-opacity-90'
                      }`}
                      onClick={() => onOpenImageModal(message.imageUrl!)}
                    >
                      <Search size={16} className={isDark ? 'text-white' : 'text-gray-700'} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className={`prose prose-sm max-w-none ${
            isDark 
              ? 'text-gray-200 prose-headings:text-gray-100 prose-a:text-indigo-300' 
              : 'text-gray-800 prose-a:text-blue-600'
          }`}>
            {isAssistant ? (
              <ReactMarkdown 
                components={{
                  img: (props) => (
                    <img 
                      src={props.src} 
                      alt={props.alt || ""}
                      className={`max-w-full h-auto rounded-lg border shadow-md my-2 ${
                        isDark ? 'border-gray-700' : 'border-gray-200'
                      }`}
                      onClick={() => props.src && onOpenImageModal(props.src)}
                      style={{cursor: 'pointer', maxHeight: '400px'}}
                    />
                  ),
                  pre: (props) => (
                    <pre className={`rounded-md p-3 overflow-auto ${
                      isDark ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {props.children}
                    </pre>
                  ),
                  code: (props) => {
                    // @ts-ignore - TypeScript doesn't recognize inline prop
                    const isInline = props.inline;
                    
                    if (isInline) {
                      return (
                        <code className={`px-1 py-0.5 rounded-md ${
                          isDark ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {props.children}
                        </code>
                      );
                    }
                    return (
                      <code className={props.className}>
                        {props.children}
                      </code>
                    );
                  }
                }}
              >
                {formatMarkdown(message.content, messages)}
              </ReactMarkdown>
            ) : (
              <p>{message.content}</p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-3">{message.timestamp}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;