// src/components/chat/components/MessageItem.tsx
import React from 'react';
import { VolumeX, Volume2, Search, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Message } from '../types';
import { messageStyles } from '../utils/messageStyles';
import { formatMarkdown } from '../utils/markdownFormatter';
import { useTheme } from '@/components/ThemeProvider';
import ReasoningDisplay from './ReasoningDisplay';

// Import languages you want to use
import jsx from 'react-syntax-highlighter/dist/cjs/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/cjs/languages/prism/java';

// Register language support
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('java', java);

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
  
  // Debug logs for reasoning data
  if (isAssistant) {
    console.log(`Message ${index} has reasoning:`, Boolean(message.reasoning));
    if (message.reasoning) {
      console.log(`Reasoning preview:`, message.reasoning.substring(0, 50) + "...");
    }
  }
  
  // Use appropriate syntax highlighting theme based on the current theme
  const codeStyle = isDark ? vscDarkPlus : vs;
  
  return (
    <div
      className={`p-5 rounded-xl border message-container ${message.type === 'user' ? 'ml-12' : 'mr-12'} ${messageStyles[message.type as keyof typeof messageStyles]} ${isDark ? '' : ''} transition-all ${isDark ? 'hover:shadow-md hover:shadow-black/20' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 overflow-hidden">
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
          
          {/* Show reasoning if available and this is an assistant message */}
          {isAssistant && message.reasoning && (
            <ReasoningDisplay 
              reasoning={message.reasoning} 
              stepTitle={message.reasoningTitle || "Reasoning Completed"}
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
                  code: ({ node, inline, className, children, ...props }: CodeProps) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match ? match[1] : '';
                    
                    if (!inline) {
                      return (
                        <div className="max-w-full overflow-hidden rounded-md code-block-container">
                          {lang && (
                            <div className={`code-language-indicator px-3 py-1 text-xs font-mono text-right ${
                              isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {lang}
                            </div>
                          )}
                          <SyntaxHighlighter
                            language={lang || 'text'}
                            style={codeStyle}
                            customStyle={{
                              margin: 0,
                              borderRadius: lang ? '0 0 0.375rem 0.375rem' : '0.375rem',
                              fontSize: '0.9rem',
                            }}
                            showLineNumbers={true}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      );
                    }
                    
                    return (
                      <code 
                        className={`px-1 py-0.5 rounded-md ${
                          isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-800'
                        }`}
                        {...props}
                      >
                        {children}
                      </code>
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
                  )
                }}
              >
                {formatMarkdown(formatContent(message.content, message.reasoning), messages)}
              </ReactMarkdown>
            ) : (
              <p className="break-words">{message.content}</p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-3">{message.timestamp}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;