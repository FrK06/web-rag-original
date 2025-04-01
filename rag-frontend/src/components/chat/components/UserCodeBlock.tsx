// src/components/chat/components/UserCodeBlock.tsx
import React from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface UserCodeBlockProps {
  content: string;
}

const UserCodeBlock: React.FC<UserCodeBlockProps> = ({ content }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="user-code-block my-2 w-full">
      <pre className={`p-3 rounded-md font-mono text-sm whitespace-pre overflow-x-auto ${
        isDark 
          ? 'bg-gray-800/80 text-gray-200 border border-gray-700/50' 
          : 'bg-gray-100 text-gray-800 border border-gray-300/50'
      }`}>
        <code>{content}</code>
      </pre>
    </div>
  );
};

export default UserCodeBlock;