// src/components/chat/components/MessageItem.tsx
import React from 'react';
import { VolumeX, Volume2, Search, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { messageStyles } from '../utils/messageStyles';
import { formatMarkdown } from '../utils/markdownFormatter';
import { useTheme } from '@/components/ThemeProvider';
import ReasoningDisplay from './ReasoningDisplay';
import { hasFormattedContent, detectAndFormatCode } from '../utils/formatDetection';
import { determineContentType } from '../utils/contentDetection';
import CodeBlock from './CodeBlock';
import UserCodeBlock from './UserCodeBlock';
import DocumentBlock from './DocumentBlock';

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

// Type for ReactMarkdown code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
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
  const isUser = message.type === 'user';
  
  // Helper function to format content to avoid duplication with reasoning
  const formatContent = (content: string, reasoning?: string) => {
    if (!reasoning || !content) return content;
    
    // Simple case: If content is completely contained in reasoning, and reasoning has more content
    if (reasoning.includes(content) && reasoning.length > content.length * 1.5) {
      // Don't need to show duplicated content
      return content;
    }
    
    // If the first 10 words of content and reasoning are identical, it might be duplication
    const contentStart = content.split(' ').slice(0, 10).join(' ');
    const reasoningStart = reasoning.split(' ').slice(0, 10).join(' ');
    
    if (contentStart === reasoningStart && contentStart.length > 20) {
      // Try to find where reasoning ends and unique content begins
      const words = content.split(' ');
      let uniqueStartIndex = 0;
      
      for (let i = 10; i < words.length; i++) {
        const checkPhrase = words.slice(0, i).join(' ');
        if (!reasoning.includes(checkPhrase)) {
          uniqueStartIndex = i - 1;
          break;
        }
      }
      
      if (uniqueStartIndex > 10) {
        // Return only the unique part of the content
        return words.slice(uniqueStartIndex).join(' ');
      }
    }
    
    return content;
  };
  
  // Check if content needs special formatting
  const needsFormatting = hasFormattedContent(message.content);
  
  // Determine content type for appropriate display
  const contentType = isUser ? determineContentType(message.content) : 'standard';
  
  // Determine if we're dealing with a code-heavy message
  const isCodeHeavy = contentType === 'code';
  
  // Process content for code detection if this is a user message
  const processedContent = isUser && needsFormatting && !isCodeHeavy
    ? detectAndFormatCode(message.content) 
    : message.content;
  
  return (
    <div
      className={`${
        isUser 
          ? isCodeHeavy
            ? 'p-4 rounded-lg ml-auto mr-3 max-w-[95%] md:max-w-[85%] lg:max-w-[75%]'
            : needsFormatting
              ? 'p-4 rounded-lg ml-auto mr-3 max-w-[90%] md:max-w-[80%] lg:max-w-[70%]'
              : 'p-3 rounded-lg ml-auto mr-3 max-w-[85%] md:max-w-[75%] lg:max-w-[65%]' 
          : 'p-5 rounded-xl mr-12'
      } border message-container ${messageStyles[message.type as keyof typeof messageStyles]} ${isDark ? '' : ''} transition-all ${isDark ? 'hover:shadow-md hover:shadow-black/20' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 overflow-hidden">
          {!isUser && (
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
          )}
          
          {/* Show reasoning if available and this is an assistant message */}
          {isAssistant && message.reasoning && (
            <ReasoningDisplay 
              reasoning={message.reasoning} 
              stepTitle={message.reasoningTitle || "Reasoning Completed"}
              isComplete={message.isReasoningComplete}
            />
          )}
          
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
          
          <div className={`${isUser ? 'prose-sm' : 'prose prose-sm'} max-w-none ${
            isDark 
              ? 'text-gray-200 prose-headings:text-gray-100 prose-a:text-indigo-300' 
              : 'text-gray-800 prose-a:text-blue-600'
          }`}>
            {isUser && contentType === 'code' ? (
              // For user messages with code content
              <UserCodeBlock content={message.content} />
            ) : isUser && contentType === 'document' ? (
              // For user messages with document/essay content
              <DocumentBlock content={message.content} />
            ) : (
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
                  code: ({ node, inline, className, children, ...props }: CodeProps) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match ? match[1] : '';
                    const content = String(children).replace(/\n$/, '');
                    
                    // Handle inline code differently - this is critical to fix the issue
                    if (inline) {
                      return (
                        <code 
                          className={`px-1.5 py-0.5 rounded-md font-mono text-sm ${
                            isDark 
                              ? isAssistant 
                                ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/30' 
                                : 'bg-gray-800 text-gray-300'
                              : isAssistant
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                                : 'bg-gray-200 text-gray-800'
                          }`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    
                    // For assistant messages, handle certain short code blocks as inline code
                    if (isAssistant && content.split('\n').length === 1 && content.length < 30) {
                      return (
                        <code 
                          className={`px-1.5 py-0.5 rounded-md font-mono text-sm ${
                            isDark 
                              ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/30' 
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                          }`}
                        >
                          {content}
                        </code>
                      );
                    }
                    
                    // Normal code blocks
                    return (
                      <CodeBlock 
                        language={lang || 'javascript'} 
                        value={content}
                      />
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  // Add proper table handling
                  table: (props) => (
                    <div className="overflow-x-auto">
                      <table>
                        {props.children}
                      </table>
                    </div>
                  ),
                  // Ensure paragraphs preserve whitespace
                  p: (props) => (
                    <p className={`whitespace-pre-wrap ${isUser ? 'mb-2 last:mb-0' : ''}`} {...props}>
                      {props.children}
                    </p>
                  )
                }}
              >
                {isAssistant 
                  ? formatMarkdown(formatContent(message.content, message.reasoning), messages)
                  : processedContent
                }
              </ReactMarkdown>
            )}
          </div>
          {/* Only show timestamp for assistant messages or when needed */}
          {(!isUser || message.timestamp) && (
            <p className="text-xs text-gray-500 mt-3">{message.timestamp}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;