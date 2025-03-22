// src/components/chat/components/MessageItem.tsx
import React from 'react';
import { VolumeX, Volume2, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { messageStyles } from '../utils/messageStyles';
import { formatMarkdown } from '../utils/markdownFormatter';

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
  return (
    <div
      className={`p-5 rounded-xl ${message.type === 'user' ? 'ml-12' : 'mr-12'} ${messageStyles[message.type as keyof typeof messageStyles]}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              {message.type === 'user' ? 'You' : message.type.charAt(0).toUpperCase() + message.type.slice(1)}
            </p>
            
            {/* Add TTS button for assistant messages */}
            {message.type === 'assistant' && (
              <div className="flex gap-2">
                {currentAudio && isSpeaking ? (
                  <button 
                    onClick={onStopAudio}
                    className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                    title="Stop speaking"
                  >
                    <VolumeX size={16} />
                  </button>
                ) : (
                  <button 
                    onClick={() => onPlayAudio(message.content, index)}
                    className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
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
                  className="max-w-full h-auto max-h-64 rounded-lg border border-gray-200 shadow-sm cursor-pointer" 
                  onClick={() => onOpenImageModal(message.imageUrl!)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className="p-2 bg-white bg-opacity-90 rounded-full shadow-md"
                      onClick={() => onOpenImageModal(message.imageUrl!)}
                    >
                      <Search size={16} className="text-gray-700" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="prose prose-sm max-w-none text-gray-800">
            {message.type === 'assistant' ? (
              <ReactMarkdown components={{
                img: ({node, ...props}) => (
                  <img 
                    {...props} 
                    className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm my-2"
                    onClick={() => props.src && onOpenImageModal(props.src)}
                    style={{cursor: 'pointer', maxHeight: '400px'}}
                  />
                )
              }}>
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