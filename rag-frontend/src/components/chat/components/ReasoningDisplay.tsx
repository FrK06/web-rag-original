// src/components/chat/components/ReasoningDisplay.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ReasoningDisplayProps {
  reasoning: string;
  isComplete?: boolean;
  stepTitle?: string;
}

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  isComplete = true,
  stepTitle = "Reasoning Completed"
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Get a short preview of the reasoning (first sentence)
  const getReasoningPreview = () => {
    if (!reasoning) return '';
    
    // Try to extract the first sentence
    const firstSentenceMatch = reasoning.match(/^([^.!?\n]+[.!?])/);
    if (firstSentenceMatch) {
      const firstSentence = firstSentenceMatch[0].trim();
      if (firstSentence.length > 60) {
        return firstSentence.substring(0, 57) + '...';
      }
      return firstSentence;
    }
    
    // If no sentence ending found, just take the first 60 chars
    if (reasoning.length > 60) {
      return reasoning.substring(0, 57) + '...';
    }
    
    return reasoning;
  };

  const reasoningPreview = getReasoningPreview();

  return (
    <div className={`w-full rounded-md overflow-hidden mb-4 ${
      isDark ? 'bg-gray-800/40 border border-gray-700/40' : 'bg-gray-50 border border-gray-200'
    }`}>
      {/* Header with indicator */}
      <div className="px-4 py-3 flex items-center gap-2">
        <CheckCircle 
          size={16} 
          className={isDark ? 'text-indigo-400' : 'text-blue-600'} 
        />
        <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {stepTitle}
        </span>
        
        {/* Show preview when collapsed */}
        {!isExpanded && reasoningPreview && (
          <span className={`ml-2 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {reasoningPreview}
          </span>
        )}
        
        <div className="flex-1"></div>
        <button
          onClick={toggleExpand}
          className={`p-1 rounded-full ${
            isDark 
              ? 'hover:bg-gray-700 text-gray-400' 
              : 'hover:bg-gray-200 text-gray-600'
          }`}
          aria-label={isExpanded ? "Collapse reasoning" : "Expand reasoning"}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Reasoning content (expandable) */}
      {isExpanded && (
        <div className={`p-4 border-t ${
          isDark ? 'border-gray-700/40 bg-gray-800/20' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className={`text-sm whitespace-pre-wrap ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {reasoning}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReasoningDisplay;