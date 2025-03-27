import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Copy, Share } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { deleteConversation } from '../services/apiService';

interface ConversationContextMenuProps {
  threadId: string;
  onDelete: () => void;
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  threadId,
  onDelete
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    
    try {
      await deleteConversation(threadId);
      onDelete();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    
    // Copy the thread ID to clipboard
    navigator.clipboard.writeText(threadId)
      .then(() => console.log('Thread ID copied to clipboard'))
      .catch(err => console.error('Failed to copy thread ID:', err));
  };

  return (
    <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded-full ${
          isDark 
            ? 'hover:bg-gray-700 text-gray-400' 
            : 'hover:bg-gray-200 text-gray-600'
        }`}
      >
        <MoreVertical size={14} />
      </button>
      
      {isOpen && (
        <div 
          className={`absolute right-0 mt-1 py-1 w-48 rounded-md shadow-lg z-50 ${
            isDark 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}
        >
          <button 
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
              isDark 
                ? 'text-gray-300 hover:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={handleCopy}
          >
            <Copy size={14} />
            <span>Copy Thread ID</span>
          </button>
          
          <button 
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
              isDark 
                ? 'text-red-400 hover:bg-gray-700' 
                : 'text-red-600 hover:bg-gray-100'
            }`}
            onClick={handleDelete}
          >
            <Trash2 size={14} />
            <span>Delete Conversation</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationContextMenu;