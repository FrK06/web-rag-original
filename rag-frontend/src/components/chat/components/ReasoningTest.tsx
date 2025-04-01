// src/components/chat/components/ReasoningTest.tsx
import React, { useState } from 'react';
import ReasoningDisplay from './ReasoningDisplay';

const ReasoningTest: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  // Sample reasoning text
  const sampleReasoning = `I need to respond to the user's query about the current date and the previous day.

Today's date:
1. The current date is April 1, 2025
2. This is a Tuesday
3. I know this from my knowledge cutoff information

Yesterday's date:
1. If today is April 1, 2025, then yesterday was March 31, 2025
2. March 31, 2025 was a Monday
3. This is a factual calculation based on the calendar system

I'll now provide a clear response including both dates.`;

  if (!isVisible) return null;

  return (
    <div className="p-4 border border-gray-300 rounded-lg mb-4">
      <h2 className="text-lg font-bold mb-2">Reasoning Display Test</h2>
      <p className="mb-4">This is a test of the ReasoningDisplay component. It should show a collapsible reasoning section below:</p>
      
      <ReasoningDisplay 
        reasoning={sampleReasoning} 
        isComplete={true}
        stepTitle="Reasoning Completed"
      />
      
      <button 
        onClick={() => setIsVisible(false)}
        className="px-4 py-2 bg-red-500 text-white rounded-lg mt-4"
      >
        Dismiss Test
      </button>
    </div>
  );
};

export default ReasoningTest;