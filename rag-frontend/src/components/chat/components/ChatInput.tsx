// src/components/chat/components/ChatInput.tsx
import React, { useRef } from 'react';
import { Send, Loader2, Upload, X, Sparkles } from 'lucide-react';
import SpeechRecognitionButton from './SpeechRecognitionButton';
import { useTheme } from '@/components/ThemeProvider';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isListening: boolean;
  isProcessingSpeech: boolean;
  isImageLoading: boolean;
  speechSupported: boolean;
  attachedImages: string[];
  onSubmit: (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent) => Promise<void>;
  onStartListening: () => void;
  onStopListening: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveImage: (index: number) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  isLoading,
  isListening,
  isProcessingSpeech,
  isImageLoading,
  speechSupported,
  attachedImages,
  onSubmit,
  onStartListening,
  onStopListening,
  onFileUpload,
  onRemoveImage
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'} pt-2 pb-6 px-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className={`mb-4 flex flex-wrap gap-2 border p-3 rounded-lg ${isDark ? 'border-gray-700 bg-card-bg' : 'border-gray-200 bg-gray-50'}`}>
            {attachedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img 
                  src={image} 
                  alt={`Attached ${index+1}`} 
                  className={`w-20 h-20 object-cover rounded border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
                />
                <button
                  className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveImage(index)}
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex gap-3 items-start">
            <div className="relative flex-1">
              {isDark ? (
                <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize height
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 500)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                placeholder="Ask me anything or upload an image..."
                className="w-full p-4 pr-24 bg-input-bg border border-input-border focus:border-primary rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder-gray-500 shadow-sm futuristic-border resize-none overflow-y-auto custom-scrollbar"
                style={{ 
                  minHeight: '58px', 
                  maxHeight: '500px',
                  scrollbarWidth: 'thin', // Firefox
                  scrollbarColor: '#374151 #1a1c2e' // Firefox
                }}
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
                rows={1}
              />
              ) : (
                <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize height
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 500)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                placeholder="Ask me anything or upload an image..."
                className="w-full p-4 pr-24 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 bg-white placeholder-gray-400 shadow-md resize-none overflow-y-auto custom-scrollbar"
                style={{ 
                  minHeight: '58px', 
                  maxHeight: '500px',
                  scrollbarWidth: 'thin', // Firefox
                  scrollbarColor: '#d1d5db #f3f4f6' // Firefox
                }}
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
                rows={1}
              />
              )}
              
              {/* Speech recognition button */}
              <SpeechRecognitionButton 
                isListening={isListening}
                isLoading={isLoading}
                isProcessingSpeech={isProcessingSpeech}
                isImageLoading={isImageLoading}
                speechSupported={speechSupported}
                onStartListening={onStartListening}
                onStopListening={onStopListening}
              />
              
              {/* Add image upload button inside input */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute right-4 top-4 p-2 rounded-full ${
                  isDark 
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
                title="Upload image"
              >
                <Upload size={18} />
              </button>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onFileUpload}
                className="hidden"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || isListening || isProcessingSpeech || isImageLoading || (!input.trim() && attachedImages.length === 0)} 
              className={`flex items-center justify-center w-14 h-14 ${
                isDark 
                  ? 'tech-gradient text-white rounded-xl hover:opacity-90 futuristic-glow' 
                  : 'bg-blue-600 text-white rounded-xl hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-sm`}
            >
              {isLoading || isImageLoading ? 
                <Loader2 className="animate-spin" size={20} /> : 
                (input.trim().startsWith("Generate") || input.trim().startsWith("Create")) && isDark ? 
                  <Sparkles size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;