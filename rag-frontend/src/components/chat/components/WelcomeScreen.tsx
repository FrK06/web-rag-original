// src/components/chat/components/WelcomeScreen.tsx
import React from 'react';
import { Search, ImageIcon, Mic, ChevronRight } from 'lucide-react';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="text-center py-12 px-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-3 tracking-tight">Welcome to Multimodal RAG Assistant</h2>
      <p className="text-gray-600 mb-10 max-w-2xl mx-auto">
        Ask me anything about recent events, upload images for analysis, or request actions like web search, image generation, SMS, or calls.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow group">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-500 mb-4 group-hover:scale-110 transition-transform">
            <Search />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-gray-800">Search the web</h3>
          <p className="text-gray-600 mb-3">Get the latest information directly from the internet.</p>
          <div className="text-sm text-blue-600 font-medium flex items-center">
            <span>Try "What are the latest AI developments?"</span>
            <ChevronRight size={16} className="ml-1" />
          </div>
        </div>
        
        <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow group">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-500 mb-4 group-hover:scale-110 transition-transform">
            <ImageIcon />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-gray-800">Image Analysis</h3>
          <p className="text-gray-600 mb-3">Upload images for AI to analyze or generate new images.</p>
          <div className="text-sm text-indigo-600 font-medium flex items-center">
            <span>Upload an image or try "Generate an image of..."</span>
            <ChevronRight size={16} className="ml-1" />
          </div>
        </div>
        
        <div className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow group">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-500 mb-4 group-hover:scale-110 transition-transform">
            <Mic />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-gray-800">Speech Recognition</h3>
          <p className="text-gray-600 mb-3">Talk to the assistant and have messages read out loud.</p>
          <div className="text-sm text-orange-600 font-medium flex items-center">
            <span>Click the microphone icon to start speaking</span>
            <ChevronRight size={16} className="ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;