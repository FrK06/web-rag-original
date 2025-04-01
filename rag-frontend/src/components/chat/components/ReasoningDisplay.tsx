// src/components/chat/components/ReasoningDisplay.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ReasoningDisplayProps {
  reasoning: string;
  isComplete?: boolean;
  stepTitle?: string;
}

// Define type for structured vs. unstructured reasoning data
type ReasoningData = 
  | { structured: false; preview: string; content: string; }
  | { structured: true; preview: string; phases: Array<{ name: string; icon: React.ReactNode; content: string; exists: boolean; }>; };

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

  // Extract reasoning phases for structured display
  const extractPhases = (text: string): ReasoningData => {
    const phases = [
      { name: "PROBLEM ANALYSIS", icon: <CheckCircle size={14} /> },
      { name: "SOLUTION PLANNING", icon: <Sparkles size={14} /> },
      { name: "SOLUTION EXECUTION", icon: <Sparkles size={14} /> },
      { name: "VERIFICATION", icon: <AlertTriangle size={14} /> },
      { name: "CONCLUSION", icon: <CheckCircle size={14} /> }
    ];

    // Check if we have a structured format or need to display as raw text
    const hasFramework = phases.some(phase => text.includes(phase.name));

    if (!hasFramework) {
      // Get the first sentence for unstructured preview
      const firstSentence = text.split('.')[0] + '.';
      return { 
        structured: false, 
        preview: firstSentence,
        content: text 
      };
    }

    // Extract content for each phase
    const structuredPhases = phases.map(phase => {
      const regex = new RegExp(`${phase.name}[\\s\\S]*?(?=(${phases.map(p => p.name).join('|')})|$)`, 'i');
      const match = text.match(regex);
      return {
        name: phase.name,
        icon: phase.icon,
        content: match ? match[0].replace(phase.name, '').trim() : '',
        exists: match !== null
      };
    }).filter(phase => phase.exists);

    // Get the first sentence for preview
    const preview = structuredPhases.length > 0
      ? (structuredPhases[0].content.split('.')[0] + '.')
      : 'Reasoning follows a structured framework.';

    return {
      structured: true,
      preview,
      phases: structuredPhases
    };
  };

  const reasoningData = extractPhases(reasoning);

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
        {!isExpanded && (
          <span className={`ml-2 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {reasoningData.preview}
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
          {reasoningData.structured ? (
            <div className="space-y-4">
              {reasoningData.phases.map((phase, index) => (
                <div key={index} className="mb-3">
                  <div className={`font-medium mb-2 flex items-center gap-2 ${
                    isDark ? 'text-indigo-300' : 'text-blue-600'
                  }`}>
                    {phase.icon}
                    <span>{phase.name}</span>
                  </div>
                  <div className={`text-sm whitespace-pre-wrap ml-5 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {phase.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-sm whitespace-pre-wrap ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {reasoningData.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReasoningDisplay;