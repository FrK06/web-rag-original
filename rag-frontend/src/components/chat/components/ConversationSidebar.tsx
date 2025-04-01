import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Plus, Clock } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { getConversations, deleteConversation, renameConversation } from '../services/apiService';
import ConversationContextMenu from './ConversationContextMenu';

interface ThreadPreview {
  thread_id: string;
  preview: string;
  last_updated: string;
}

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewConversation: () => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onClose,
  currentThreadId,
  onThreadSelect,
  onNewConversation
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      console.log("Loading conversations with token:", token ? token.substring(0, 15) + "..." : "none");
      
      try {
        // Pass auth token in request headers
        const conversationsData = await getConversations();
        setThreads(conversationsData.threads || []);
      } catch (err) {
        console.error('Error loading conversations:', err);
        setError('Failed to load conversations. Please try again later.');
        setThreads([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteConversation = async (threadId: string) => {
    try {
      // Call the API to delete the conversation
      await deleteConversation(threadId);
      
      // Remove the thread from the list
      setThreads(threads.filter(thread => thread.thread_id !== threadId));
      
      // If the deleted thread is the current one, start a new conversation
      if (threadId === currentThreadId) {
        onNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const handleRenameConversation = async (threadId: string, newName: string) => {
    try {
      // Call the API to rename the conversation
      await renameConversation(threadId, newName);
      
      // Update the thread in the list
      setThreads(threads.map(thread => 
        thread.thread_id === threadId 
          ? { ...thread, preview: newName } 
          : thread
      ));
    } catch (error) {
      console.error('Error renaming conversation:', error);
      setError('Failed to rename conversation');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 left-0 w-80 z-30 transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-[#0f111a] border-r border-gray-800' : 'bg-white border-r border-gray-200'} shadow-xl`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} flex justify-between items-center`}>
          <h2 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Conversations</h2>
          <button 
            onClick={onClose}
            className={`p-1 rounded-full ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* New Conversation Button */}
        <button 
          onClick={onNewConversation}
          className={`mx-4 mt-4 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
            isDark 
              ? 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/50 border border-indigo-700/50' 
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <Plus size={16} />
          <span>New Conversation</span>
        </button>
        
        {/* List of conversations */}
        <div className="flex-1 overflow-y-auto mt-2">
          {isLoading ? (
            <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Loading conversations...
            </div>
          ) : error ? (
            <div className={`p-4 text-center ${isDark ? 'text-red-400' : 'text-red-500'}`}>
              {error}
            </div>
          ) : threads.length === 0 ? (
            <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {threads.map((thread) => (
                <div
                  key={thread.thread_id}
                  className={`relative group rounded-lg ${
                    currentThreadId === thread.thread_id
                      ? isDark
                        ? 'bg-indigo-900/30'
                        : 'bg-blue-100'
                      : ''
                  }`}
                >
                  <button
                    onClick={() => onThreadSelect(thread.thread_id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                      currentThreadId === thread.thread_id
                        ? isDark
                          ? 'text-indigo-100'
                          : 'text-blue-800'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-800/50'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <MessageSquare size={18} className="mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className={`truncate font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {thread.preview.length > 0 ? thread.preview : "New Conversation"}
                        </div>
                        <div className={`ml-2 text-xs flex-shrink-0 flex items-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          <Clock size={12} className="mr-1" />
                          {formatDate(thread.last_updated)}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Context menu button - shown on hover */}
                  <div className={`absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <ConversationContextMenu 
                      threadId={thread.thread_id}
                      title={thread.preview || "New Conversation"}
                      onDelete={() => handleDeleteConversation(thread.thread_id)}
                      onRename={handleRenameConversation}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;