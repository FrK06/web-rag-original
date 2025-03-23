// // src/components/chat/components/ImageModal.tsx
import React from 'react';
import { X, Search, Settings } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onAnalyze: (imageUrl: string) => Promise<void>;
  onProcess: (imageUrl: string, operation: string) => Promise<void>;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  imageUrl, 
  onClose, 
  onAnalyze, 
  onProcess 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen || !imageUrl) return null;

  return (
    <div className={`fixed inset-0 ${isDark ? 'bg-black bg-opacity-80 backdrop-blur-sm' : 'bg-black bg-opacity-70'} flex items-center justify-center z-50 p-4`}>
      <div className={`${isDark ? 'bg-card-bg border border-gray-700' : 'bg-white'} rounded-xl max-w-4xl max-h-[90vh] overflow-auto p-6 shadow-xl relative`}>
        <button 
          className={`absolute top-4 right-4 p-2 rounded-full ${
            isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          } transition-colors`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        
        <div className="flex flex-col items-center pt-8">
          <div className={isDark ? "relative" : ""}>
            <img 
              src={imageUrl} 
              alt="Full size" 
              className={`max-w-full h-auto rounded-lg ${
                isDark ? 'border border-gray-700 shadow-lg' : 'border border-gray-200'
              }`}
            />
            {isDark && <div className="absolute inset-0 rounded-lg border border-gray-600 shadow-inner"></div>}
          </div>
          
          <div className="flex gap-4 mt-6">
            {isDark ? (
              <>
                <button 
                  className="px-5 py-3 bg-indigo-900/40 text-indigo-300 rounded-xl hover:bg-indigo-800/50 transition-colors flex items-center gap-2 border border-indigo-700/50 shadow-md"
                  onClick={() => onAnalyze(imageUrl)}
                >
                  <Search size={18} />
                  <span>Analyze Image</span>
                </button>
                
                <button 
                  className="px-5 py-3 bg-gray-800/40 text-gray-300 rounded-xl hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-gray-600/50 shadow-md"
                  onClick={() => onProcess(imageUrl, 'grayscale')}
                >
                  <Settings size={18} />
                  <span>Convert to Grayscale</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-2"
                  onClick={() => onAnalyze(imageUrl)}
                >
                  <Search size={16} />
                  <span>Analyze Image</span>
                </button>
                
                <button 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
                  onClick={() => onProcess(imageUrl, 'grayscale')}
                >
                  <Settings size={16} />
                  <span>Convert to Grayscale</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;