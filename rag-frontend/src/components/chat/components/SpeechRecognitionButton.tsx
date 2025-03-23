// // src/components/chat/components/SpeechRecognitionButton.tsx
import React from 'react';
import { Mic } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!speechSupported) return null;

  return (
    <button
      type="button"
      onClick={isListening ? onStopListening : onStartListening}
      className={`absolute right-14 top-4 p-2 rounded-full transition-all ${
        isListening 
          ? isDark 
            ? 'bg-red-900 text-red-200 pulse-effect' 
            : 'bg-red-100 text-red-600 animate-pulse'
          : isDark
            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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