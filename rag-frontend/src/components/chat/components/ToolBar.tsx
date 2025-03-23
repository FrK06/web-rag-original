// // src/components/chat/components/ToolBar.tsx
import React from 'react';
import { Search, Globe, MessageSquare, Phone, Mic, ImageIcon } from 'lucide-react';
import ToolButton from './ToolButton';
import { useTheme } from '@/components/ThemeProvider';

interface ToolBarProps {
  activeTools: string[];
  threadId: string | null;
}

const ToolBar: React.FC<ToolBarProps> = ({ activeTools, threadId }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <ToolButton 
        label="Web Search" 
        icon={Search} 
        active={activeTools.includes('web-search')} 
        color="blue"
      />
      <ToolButton 
        label="Web Scraping" 
        icon={Globe} 
        active={activeTools.includes('web-scrape')} 
        color="green"
      />
      <ToolButton 
        label="SMS" 
        icon={MessageSquare} 
        active={activeTools.includes('sms')} 
        color="purple"
      />
      <ToolButton 
        label="Call" 
        icon={Phone} 
        active={activeTools.includes('call')} 
        color="red"
      />
      <ToolButton 
        label="Speech" 
        icon={Mic} 
        active={activeTools.includes('speech')} 
        color="orange"
      />
      <ToolButton 
        label="Images" 
        icon={ImageIcon} 
        active={activeTools.includes('image-generation') || activeTools.includes('image-analysis')} 
        color="indigo"
      />
      
      {threadId && (
        <div className={`ml-auto text-xs flex items-center rounded-full px-3 py-2 ${
          isDark 
            ? 'text-gray-400 bg-gray-900/50 border border-gray-700/50' 
            : 'text-gray-500 bg-gray-100 border border-gray-300 shadow-sm'
        }`}>
          <span className={`font-medium mr-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Session:</span> {threadId.substring(0, 8)}...
        </div>
      )}
    </div>
  );
};

export default ToolBar;