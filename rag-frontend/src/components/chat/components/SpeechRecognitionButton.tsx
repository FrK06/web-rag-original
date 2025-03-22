// src/components/chat/components/SpeechRecognitionButton.tsx
import React from 'react';
import { Mic } from 'lucide-react';

interface SpeechRecognitionButtonProps {
  isListening: boolean;
  isLoading: boolean;
  isProcessingSpeech: boolean;
  isImageLoading: boolean;
  speechSupported: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

const SpeechRecognitionButton: React.FC<SpeechRecognitionButtonProps> = ({
  isListening,
  isLoading,
  isProcessingSpeech,
  isImageLoading,
  speechSupported,
  onStartListening,
  onStopListening
}) => {
  if (!speechSupported) return null;

  return (
    <button
      type="button"
      onClick={isListening ? onStopListening : onStartListening}
      className={`absolute right-14 top-1/2 transform -translate-y-1/2 p-2 rounded-full ${
        isListening 
          ? 'bg-red-100 text-red-600 animate-pulse' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      disabled={isLoading || isProcessingSpeech || isImageLoading}
      title={isListening ? "Stop listening" : "Start voice input"}
    >
      <Mic size={18} />
    </button>
  );
};

export default SpeechRecognitionButton;