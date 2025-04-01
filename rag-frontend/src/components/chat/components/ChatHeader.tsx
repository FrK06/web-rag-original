// rag-frontend/src/components/chat/components/ChatHeader.tsx
import React, { useState } from 'react';
import { Zap, Trash2, Moon, Sun, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/auth/AuthContext';
import ModeDropdown from './ModeDropdown';

interface ChatHeaderProps {
  mode: string;
  onModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onShowSidebar: () => void;
  userName?: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  mode,
  onModeChange,
  onShowSidebar,
  userName
}) => {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const isDark = theme === 'dark';
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className={`${isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'} px-6 py-4 z-10`}>
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Add sidebar toggle button */}
          <button 
            onClick={onShowSidebar}
            className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'} transition-colors mr-2`}
            title="Show conversations"
          >
            <Menu size={18} />
          </button>
          {isDark ? (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center tech-gradient futuristic-glow">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                  Multimodal RAG Assistant
                </h1>
                <p className="text-xs text-gray-400">Powered by advanced AI</p>
              </div>
            </>
          ) : (
            <>
              <Zap size={24} className="text-blue-500" />
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Multimodal RAG Assistant</h1>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center rounded-full px-4 py-2 text-sm ${
            isDark 
              ? 'bg-secondary-bg border border-gray-700' 
              : 'bg-gray-100 border border-gray-300'
          }`}>
            <ModeDropdown value={mode} onChange={onModeChange} />
          </div>
          
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'} transition-colors`}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {/* User menu */}
          {userName && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                <User size={16} />
                <span className="text-sm font-medium">{userName}</span>
                <ChevronDown size={14} />
              </button>

              {showUserMenu && (
                <div
                  className={`absolute right-0 mt-2 py-2 w-48 rounded-lg shadow-lg z-50 ${
                    isDark
                      ? 'bg-gray-800 border border-gray-700'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => logout()}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                      isDark
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;