// src/components/chat/components/ChatHeader.tsx
import React from 'react';
import { Zap, Trash2 } from 'lucide-react';

interface ChatHeaderProps {
  mode: string;
  onModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onClearConversation: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  mode,
  onModeChange,
  onClearConversation
}) => {
  return (
    <div className="bg-white border-b px-6 py-4 shadow-sm z-10">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Multimodal RAG Assistant</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700">
            <span className="mr-2">Mode:</span>
            <select 
              value={mode} 
              onChange={onModeChange}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-blue-600 font-semibold"
            >
              <option value="explore">Explore</option>
              <option value="setup">Setup</option>
            </select>
          </div>
          
          <button 
            onClick={onClearConversation} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={18} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;