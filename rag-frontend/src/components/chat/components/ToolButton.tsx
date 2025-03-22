// src/components/chat/components/ToolButton.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ToolButtonProps } from '../types';

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon: Icon, active, color }) => {
  // Map for tool button styling based on color
  const colorStyles = {
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

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300 border ${
        active 
          ? colorStyles[color].active
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <Icon size={16} className={active ? colorStyles[color].icon : 'text-gray-500'} />
      <span className="font-medium">{label}</span>
      {active && <Loader2 size={14} className="animate-spin ml-1" />}
    </div>
  );
};

export default ToolButton;