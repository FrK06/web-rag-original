// src/components/chat/components/ImageModal.tsx
import React from 'react';
import { X, Search, Settings } from 'lucide-react';

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
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-auto p-4 shadow-xl relative">
        <button 
          className="absolute top-4 right-4 p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
          onClick={onClose}
        >
          <X size={20} className="text-gray-800" />
        </button>
        
        <div className="flex flex-col items-center pt-8">
          <img 
            src={imageUrl} 
            alt="Full size" 
            className="max-w-full h-auto rounded-lg" 
          />
          
          <div className="flex gap-3 mt-4">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;