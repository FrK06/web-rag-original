// //src/components/chat/components/ModeDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ModeDropdownProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const ModeDropdown: React.FC<ModeDropdownProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Simulate the onChange event from a select
  const handleOptionClick = (newValue: string) => {
    const event = {
      target: { value: newValue }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    
    onChange(event);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={isDark ? "text-gray-400" : "text-gray-700"}>Mode:</span>
        <div className="flex items-center gap-1">
          <span className={isDark ? "text-primary font-semibold" : "text-blue-600 font-semibold"}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
          <ChevronDown size={14} className={isDark ? "text-primary" : "text-blue-600"} />
        </div>
      </div>
      
      {isOpen && (
        <div 
          className={`absolute top-full mt-1 rounded-md shadow-lg py-1 z-50 w-32 ${
            isDark 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}
        >
          <div 
            className={`px-4 py-2 cursor-pointer ${
              value === 'explore' 
                ? isDark 
                  ? 'bg-indigo-900/30 text-indigo-300' 
                  : 'bg-blue-100 text-blue-800' 
                : isDark 
                  ? 'text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => handleOptionClick('explore')}
          >
            Explore
          </div>
          <div 
            className={`px-4 py-2 cursor-pointer ${
              value === 'setup' 
                ? isDark 
                  ? 'bg-indigo-900/30 text-indigo-300' 
                  : 'bg-blue-100 text-blue-800' 
                : isDark 
                  ? 'text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => handleOptionClick('setup')}
          >
            Setup
          </div>
        </div>
      )}
      
      {/* Hidden actual select for form compatibility */}
      <select 
        value={value} 
        onChange={onChange}
        className="sr-only" 
        aria-hidden="true"
      >
        <option value="explore">Explore</option>
        <option value="setup">Setup</option>
      </select>
    </div>
  );
};

export default ModeDropdown;