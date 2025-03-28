import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Pencil, Check, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { deleteConversation } from '../services/apiService';

interface ConversationContextMenuProps {
  threadId: string;
  title: string;  // Current conversation title/preview
  onDelete: () => void;
  onRename: (threadId: string, newName: string) => void;
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  threadId,
  title,
  onDelete,
  onRename
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsRenaming(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus the input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

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

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Initialize with the current title
    setNewName(title);
    setIsRenaming(true);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (newName.trim()) {
      onRename(threadId, newName.trim());
    }
    setIsRenaming(false);
    setIsOpen(false);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (newName.trim()) {
        onRename(threadId, newName.trim());
      }
      setIsRenaming(false);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
    }
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
      
      {isOpen && !isRenaming && (
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
            onClick={handleStartRename}
          >
            <Pencil size={14} />
            <span>Rename</span>
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

      {isRenaming && (
        <div 
          className={`absolute right-0 mt-1 p-2 w-64 rounded-md shadow-lg z-50 ${
            isDark 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}
        >
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyPress}
              className={`w-full p-2 text-sm rounded ${
                isDark
                  ? 'bg-gray-700 text-gray-200 border border-gray-600'
                  : 'bg-white text-gray-800 border border-gray-300'
              }`}
              placeholder="Enter new name"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelRename}
                className={`p-1 rounded ${
                  isDark
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <X size={16} />
              </button>
              <button
                onClick={handleRename}
                className={`p-1 rounded ${
                  isDark
                    ? 'hover:bg-gray-700 text-green-400'
                    : 'hover:bg-gray-200 text-green-600'
                }`}
                disabled={!newName.trim()}
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationContextMenu;