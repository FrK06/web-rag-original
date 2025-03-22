// src/components/chat/components/ToolBar.tsx
import React from 'react';
import { Search, Globe, MessageSquare, Phone, Mic, ImageIcon } from 'lucide-react';
import ToolButton from './ToolButton';

interface ToolBarProps {
  activeTools: string[];
  threadId: string | null;
}

const ToolBar: React.FC<ToolBarProps> = ({ activeTools, threadId }) => {
  return (
    <div className="flex flex-wrap gap-3 mb-4 justify-center">
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
        <div className="ml-auto text-xs text-gray-500 flex items-center bg-gray-100 rounded-full px-3 py-2">
          <span className="font-medium text-gray-600 mr-1">Session:</span> {threadId.substring(0, 8)}...
        </div>
      )}
    </div>
  );
};

export default ToolBar;