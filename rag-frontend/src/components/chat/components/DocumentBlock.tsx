// src/components/chat/components/DocumentBlock.tsx
import React from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface DocumentBlockProps {
  content: string;
}

const DocumentBlock: React.FC<DocumentBlockProps> = ({ content }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="document-block my-2 w-full">
      <div className={`p-3 rounded-md text-sm whitespace-pre-line ${
        isDark 
          ? 'bg-gray-900/50 text-gray-200 border border-gray-800/50' 
          : 'bg-gray-50 text-gray-800 border border-gray-200/50'
      }`}>
        {content}
      </div>
    </div>
  );
};

export default DocumentBlock;