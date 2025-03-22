// src/components/chat/components/ChatInput.tsx
import React, { useRef } from 'react';
import { Send, Loader2, Upload, X } from 'lucide-react';
import SpeechRecognitionButton from './SpeechRecognitionButton';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isListening: boolean;
  isProcessingSpeech: boolean;
  isImageLoading: boolean;
  speechSupported: boolean;
  attachedImages: string[];
  onSubmit: (e: React.FormEvent) => Promise<void>;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t bg-white p-6 shadow-lg">
      <div className="max-w-5xl mx-auto">
        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 border border-gray-200 bg-gray-50 p-3 rounded-lg">
            {attachedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img 
                  src={image} 
                  alt={`Attached ${index+1}`} 
                  className="w-20 h-20 object-cover rounded border border-gray-300"
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
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything or upload an image..."
                className="w-full p-4 pr-24 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 bg-white placeholder-gray-400 shadow-sm"
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
              />
              
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
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              className="px-5 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading || isImageLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;