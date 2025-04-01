// src/components/chat/types.ts
import { ReactNode } from 'react';

export interface Message {
  type: string;
  content: string;
  timestamp: string;
  audioUrl?: string;
  imageUrl?: string;
  reasoning?: string;         // Added: LLM reasoning text
  reasoningTitle?: string;    // Added: Title for reasoning step
  isReasoningComplete?: boolean; // Added: Whether reasoning is complete
}

export interface ChatResponse {
  message: string;
  tools_used: string[];
  timestamp: string;
  thread_id: string;
  source_url?: string;
  image_urls?: string[];
  reasoning?: string;         // Added: LLM reasoning text
  reasoning_title?: string;   // Added: Title for reasoning step
}

export interface SpeechToTextResponse {
  text: string;
  status: string;
}

export interface TextToSpeechResponse {
  audio: string;
  format: string;
  status: string;
}

export interface ImageGenerationResponse {
  image: string;
  status: string;
  message: string;
  timestamp: string;
  detail?: string;
}

export interface ImageAnalysisResponse {
  analysis: string;
  status: string;
}

export interface ImageProcessingResponse {
  image: string;
  status: string;
}

export interface ToolButtonProps {
  label: string;
  icon: React.ComponentType<any>;
  active: boolean;
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'indigo';
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}