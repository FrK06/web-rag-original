// // src/components/chat/components/ToolButton.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ToolButtonProps } from '../types';
import { useTheme } from '@/components/ThemeProvider';

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: Icon, active, color }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Color style maps for light and dark modes
  const lightColorStyles = {
    blue: {
      active: 'bg-blue-100 text-blue-800 border-blue-300 shadow-md scale-105',
      icon: 'text-blue-500'
    },
    green: {
      active: 'bg-green-100 text-green-800 border-green-300 shadow-md scale-105',
      icon: 'text-green-500'
    },
    purple: {
      active: 'bg-purple-100 text-purple-800 border-purple-300 shadow-md scale-105',
      icon: 'text-purple-500'
    },
    red: {
      active: 'bg-red-100 text-red-800 border-red-300 shadow-md scale-105',
      icon: 'text-red-500'
    },
    orange: {
      active: 'bg-orange-100 text-orange-800 border-orange-300 shadow-md scale-105',
      icon: 'text-orange-500'
    },
    indigo: {
      active: 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-md scale-105',
      icon: 'text-indigo-500'
    }
  };

  const darkColorStyles = {
    blue: {
      active: 'bg-blue-900/30 text-blue-300 border-blue-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-blue-400'
    },
    green: {
      active: 'bg-green-900/30 text-green-300 border-green-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-green-400'
    },
    purple: {
      active: 'bg-purple-900/30 text-purple-300 border-purple-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-purple-400'
    },
    red: {
      active: 'bg-red-900/30 text-red-300 border-red-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-red-400'
    },
    orange: {
      active: 'bg-orange-900/30 text-orange-300 border-orange-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-orange-400'
    },
    indigo: {
      active: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/50 shadow-md scale-105 futuristic-glow',
      icon: 'text-indigo-400'
    }
  };

  // Choose the appropriate color styles based on theme
  const colorStyles = isDark ? darkColorStyles : lightColorStyles;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300 border ${
        active 
          ? colorStyles[color].active
          : isDark
            ? 'bg-gray-900/30 text-gray-400 border-gray-700/40 hover:bg-gray-800/40'
            : 'bg-white text-gray-600 border-gray-300 shadow-sm hover:bg-gray-50'
      }`}
    >
      <Icon size={16} className={active ? colorStyles[color].icon : isDark ? 'text-gray-400' : 'text-gray-500'} />
      <span className="font-medium">{label}</span>
      {active && <Loader2 size={14} className="animate-spin ml-1" />}
    </div>
  );
};

export default ToolButton;