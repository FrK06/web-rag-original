import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, Phone, MessageSquare, Globe, Loader2, Trash2, Settings, ChevronRight, Zap, Mic, VolumeX, Volume2, Image as ImageIcon, Upload, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

// Add Web Speech API type definitions
interface Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

// Extend the window interface
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  type: string;
  content: string;
  timestamp: string;
  audioUrl?: string; // Optional field for audio URL (for TTS)
  imageUrl?: string; // Optional field for image URL or base64
}

interface ChatResponse {
  message: string;
  tools_used: string[];
  timestamp: string;
  thread_id: string;
  source_url?: string;
  image_urls?: string[]; // Added to receive image URLs from server
}

interface SpeechToTextResponse {
  text: string;
  status: string;
}

interface TextToSpeechResponse {
  audio: string; // Base64 encoded audio
  format: string;
  status: string;
}

interface ImageGenerationResponse {
  image: string; // Base64 encoded image
  status: string;
  message: string;
  timestamp: string;
  detail?: string; // Add this optional property for error responses
}

interface ImageAnalysisResponse {
  analysis: string;
  status: string;
}

interface ToolButtonProps {
  label: string;
  icon: React.ComponentType<any>;
  active: boolean;
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'indigo';
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<string>('explore');
  const [error, setError] = useState<string | null>(null);
  
  // Speech recognition states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  
  // TTS states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  // Image states
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Media recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if speech recognition is supported
  useEffect(() => {
    const checkSpeechSupport = () => {
      const speechRecognitionAPI = 
        window.SpeechRecognition || 
        window.webkitSpeechRecognition;
      
      setSpeechSupported(!!speechRecognitionAPI);
    };
    
    checkSpeechSupport();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Debug active tools changes
  useEffect(() => {
    console.log("Active tools changed:", activeTools);
  }, [activeTools]);

  // Stop recording when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
      }
    };
  }, [currentAudio]);

  const messageStyles = {
    user: 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-sm',
    assistant: 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 shadow-sm',
    tool: 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200 shadow-sm',
    error: 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 shadow-sm',
    system: 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 shadow-sm'
  };

// Tool detection helper function
const detectToolsFromMessage = (content: string): string[] => {
  const detectedTools = [];
  const lowerContent = content.toLowerCase();
  
  // Check for search indicators
  if (lowerContent.includes('search') || 
      lowerContent.includes('found online') ||
      lowerContent.includes('according to')) {
    detectedTools.push('web-search');
  }
  
  // Check for scraping indicators
  if (lowerContent.includes('scrape') || 
      lowerContent.includes('extracted from') ||
      lowerContent.includes('from the website')) {
    detectedTools.push('web-scrape');
  }
  
  // Check for SMS indicators
  if (lowerContent.includes('sms sent') || 
      lowerContent.includes('message sent') ||
      lowerContent.includes('text message')) {
    detectedTools.push('sms');
  }
  
  // Check for call indicators
  if (lowerContent.includes('call initiated') || 
      lowerContent.includes('phone call')) {
    detectedTools.push('call');
  }
  
  // Check for speech indicators
  if (lowerContent.includes('speaking') || 
      lowerContent.includes('listen') ||
      lowerContent.includes('audio')) {
    detectedTools.push('speech');
  }
  
  // Check for image indicators
  if (lowerContent.includes('image generated') || 
      lowerContent.includes('created an image') ||
      lowerContent.includes('picture')) {
    detectedTools.push('image-generation');
  }
  
  // Check for image analysis indicators
  if (lowerContent.includes('analyzed image') || 
      lowerContent.includes('in this image') ||
      lowerContent.includes('the image shows')) {
    detectedTools.push('image-analysis');
  }
  
  return detectedTools;
};

const ToolButton = ({ label, icon: Icon, active, color }: ToolButtonProps) => {
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

// Direct image generation method
const generateImageDirectly = async (prompt: string): Promise<string> => {
  try {
    setIsImageLoading(true);
    
    // Call the direct image generation endpoint
    const response = await axios.post<ImageGenerationResponse>('http://localhost:8000/api/direct-image-generation/', {
      prompt
    });
    
    if (response.data.status === 'success') {
      // Add the generated image to the conversation
      const imageMessage = {
        type: 'assistant',
        content: `I've created an image of ${prompt}:`,
        imageUrl: response.data.image,
        timestamp: response.data.timestamp || new Date().toLocaleTimeString()
      };
      
      setMessages(prev => [...prev, imageMessage]);
      setActiveTools(['image-generation']);
      
      // Remove tool indicators after delay
      setTimeout(() => {
        setActiveTools([]);
      }, 5000);
      
      // Return success
      return response.data.image;
    } else {
      throw new Error(response.data.detail || 'Failed to generate image');
    }
  } catch (error) {
    console.error('Error generating image directly:', error);
    setError(error instanceof Error ? error.message : 'Failed to generate image');
    setMessages(prev => [...prev, {
      type: 'error',
      content: error instanceof Error ? error.message : 'An error occurred while generating the image.',
      timestamp: new Date().toLocaleTimeString()
    }]);
    return '';
  } finally {
    setIsImageLoading(false);
  }
};

const sendMessage = async (content: string): Promise<ChatResponse> => {
  try {
    // Check if this is an image generation request
    const imageGenPattern = /(generate|create|make|draw) .*image of/i;
    
    if (imageGenPattern.test(content)) {
      // Extract the image description
      const match = content.match(/image of (.+?)(?:\?|\.|\!|$)/i);
      
      if (match && match[1]) {
        const imagePrompt = match[1].trim();
        console.log('Detected image generation request:', imagePrompt);
        
        // Use direct image generation instead of the RAG pipeline
        await generateImageDirectly(imagePrompt);
        
        // Return minimal response since we've already added the image message
        return {
          message: '',
          tools_used: ['image-generation'],
          timestamp: new Date().toLocaleTimeString(),
          thread_id: threadId || ''
        };
      }
    }
    
    // Continue with normal message processing for non-image requests
    console.log('Sending message:', content);
    console.log('Attached images:', attachedImages);
    
    const response = await axios.post('http://localhost:8000/api/chat/', {
      content,
      thread_id: threadId,
      mode,
      attached_images: attachedImages,
      conversation_history: messages.map(msg => ({
        type: msg.type,
        content: msg.content
      }))
    });

    console.log('Response from server:', response.data);
    
    // Update thread ID if returned from server
    if (response.data.thread_id) {
      setThreadId(response.data.thread_id);
    }

    // Handle tool activation with better detection
    const toolsUsed = response.data.tools_used || [];
    console.log('Tools used from server:', toolsUsed);
    
    // Force tool activation when certain keywords appear in the response
    const messageContent = response.data.message.toLowerCase();
    if (messageContent.includes('search') || messageContent.includes('found') || messageContent.includes('according to')) {
      toolsUsed.push('web-search');
    }
    if (messageContent.includes('scrape') || messageContent.includes('from the website') || messageContent.includes('extracted')) {
      toolsUsed.push('web-scrape');
    }
    if (messageContent.includes('sms') || messageContent.includes('message sent')) {
      toolsUsed.push('sms');
    }
    if (messageContent.includes('call') || messageContent.includes('phone')) {
      toolsUsed.push('call');
    }
    if (messageContent.includes('speaking') || messageContent.includes('listen') || messageContent.includes('audio')) {
      toolsUsed.push('speech');
    }
    
    // Enhanced image tool detection
    if (messageContent.includes('image generated') || 
        messageContent.includes('created an image') || 
        messageContent.includes('picture generated') ||
        response.data.message.includes('![Generated Image]') ||
        (response.data.image_urls && response.data.image_urls.length > 0)) {
      toolsUsed.push('image-generation');
    }
    
    if (messageContent.includes('analyzed image') || messageContent.includes('in this image') || messageContent.includes('the image shows')) {
      toolsUsed.push('image-analysis');
    }
    
    // Set active tools with the augmented list
    if (toolsUsed.length > 0) {
      console.log('Activating tools:', toolsUsed);
      setActiveTools(toolsUsed);
      
      // Remove tool indicators after delay
      setTimeout(() => {
        console.log('Deactivating tools');
        setActiveTools([]);
      }, 5000);  // 5 seconds visibility
    }

    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Server error: ${error.response.data.detail || error.message}`);
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to get response');
  }
};

// Convert speech to text
const processSpeech = async (audioBlob: Blob): Promise<string> => {
  try {
    setIsProcessingSpeech(true);
    
    // Convert the blob to base64
    const reader = new FileReader();
    const audioBase64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
          resolve(base64Data);
        } else {
          resolve(''); // Fallback to empty string if conversion fails
        }
      };
    });
    reader.readAsDataURL(audioBlob);
    const base64Audio = await audioBase64Promise;
    
    // Send to server for processing
    const response = await axios.post<SpeechToTextResponse>('http://localhost:8000/api/speech-to-text/', {
      audio: base64Audio
    });
    
    if (response.data.status === 'success') {
      return response.data.text;
    } else {
      throw new Error('Failed to process speech');
    }
  } catch (error) {
    console.error('Error processing speech:', error);
    throw error;
  } finally {
    setIsProcessingSpeech(false);
  }
};

// Convert text to speech
const getTextToSpeech = async (text: string): Promise<string> => {
  try {
    const response = await axios.post<TextToSpeechResponse>('http://localhost:8000/api/text-to-speech/', {
      text,
      voice: 'alloy' // Can be customized later
    });
    
    if (response.data.status === 'success') {
      return response.data.audio; // Base64 encoded audio with data URL prefix
    } else {
      throw new Error('Failed to generate speech');
    }
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
};

// Generate image from prompt
const generateImage = async (prompt: string): Promise<string> => {
  try {
    setIsImageLoading(true);
    
    const response = await axios.post<ImageGenerationResponse>('http://localhost:8000/api/generate-image/', {
      prompt,
      size: '1024x1024',
      style: 'vivid',
      quality: 'standard'
    });
    
    if (response.data.status === 'success') {
      return response.data.image; // Base64 encoded image
    } else {
      throw new Error('Failed to generate image');
    }
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  } finally {
    setIsImageLoading(false);
  }
};

// Analyze image
const analyzeImage = async (imageData: string): Promise<string> => {
  try {
    const response = await axios.post<ImageAnalysisResponse>('http://localhost:8000/api/analyze-image/', {
      image: imageData
    });
    
    if (response.data.status === 'success') {
      return response.data.analysis;
    } else {
      throw new Error('Failed to analyze image');
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

// Process image with operations
const processImage = async (imageData: string, operation: string): Promise<string> => {
  try {
    const response = await axios.post('http://localhost:8000/api/process-image/', {
      image: imageData,
      operation: operation
    });
    
    if (response.data.status === 'success') {
      return response.data.image;
    } else {
      throw new Error('Failed to process image');
    }
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

// Handle file upload
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  try {
    setIsImageLoading(true);
    
    // Process each selected file
    const imagePromises = Array.from(files).map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          const result = event.target?.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Error reading file'));
        };
        
        reader.readAsDataURL(file);
      });
    });
    
    // Wait for all files to be processed
    const imageDataArray = await Promise.all(imagePromises);
    
    // Add all uploaded images to the attached images array
    setAttachedImages([...attachedImages, ...imageDataArray]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
  } catch (error) {
    console.error('Error uploading images:', error);
    setError('Failed to upload images. Please try again.');
  } finally {
    setIsImageLoading(false);
  }
};

// Remove attached image
const removeAttachedImage = (index: number) => {
  setAttachedImages(prev => prev.filter((_, i) => i !== index));
};

// Start speech recognition
const startListening = async () => {
  if (!speechSupported) {
    setError('Speech recognition is not supported in your browser');
    return;
  }
  
  try {
    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Reset audio chunks
    audioChunksRef.current = [];
    
    // Create a media recorder
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    // Handle data availability
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    // Handle recording stop
    mediaRecorder.onstop = async () => {
      try {
        // Create a blob from audio chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Process speech
        const transcript = await processSpeech(audioBlob);
        
        if (transcript) {
          // Set input with transcript and submit
          setInput(transcript);
          await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        setError('Failed to process speech. Please try again.');
      } finally {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    
    // Start recording
    mediaRecorder.start();
    setIsListening(true);
    
    // Automatically stop after 10 seconds
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsListening(false);
      }
    }, 10000);
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    setError('Failed to access microphone. Please check your permissions.');
  }
};

// Stop speech recognition
const stopListening = () => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
    mediaRecorderRef.current.stop();
  }
  setIsListening(false);
};

// Play text-to-speech audio
const playAudio = async (text: string, messageIndex?: number) => {
  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
    }
    
    setIsSpeaking(true);
    
    // Get audio data
    const audioUrl = await getTextToSpeech(text);
    
    // Create and play audio element
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    
    // Play audio
    await audio.play();
    
    // If messageIndex is provided, update the message with the audio URL
    if (messageIndex !== undefined) {
      setMessages(prev => 
        prev.map((msg, idx) => 
          idx === messageIndex ? { ...msg, audioUrl } : msg
        )
      );
    }
    
    // Handle audio end
    audio.onended = () => {
      setIsSpeaking(false);
      setCurrentAudio(null);
    };
    
  } catch (error) {
    console.error('Error playing audio:', error);
    setError('Failed to play audio. Please try again.');
    setIsSpeaking(false);
  }
};

// Stop text-to-speech audio
const stopAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    setCurrentAudio(null);
  }
  setIsSpeaking(false);
};

// Open image modal
const openImageModal = (imageUrl: string) => {
  setSelectedImage(imageUrl);
  setIsImageModalOpen(true);
};

// Close image modal
const closeImageModal = () => {
  setSelectedImage(null);
  setIsImageModalOpen(false);
};

// Enhanced formatMarkdown function with better image handling
const formatMarkdown = (content: string) => {
  // First, check for direct markdown image syntax - this is the new format
  // No replacement needed as ReactMarkdown will render this correctly
  
  // Then handle legacy format with IMAGE: tokens if needed
  const imageRegex = /\[IMAGE:(.*?)\.\.\.]/g;
  let formattedContent = content.replace(imageRegex, (match, prefix) => {
    // Try to find a matching image in the message history
    const foundImage = messages.find(msg => msg.imageUrl && msg.imageUrl.startsWith(prefix));
    if (foundImage && foundImage.imageUrl) {
      return `![Generated Image](${foundImage.imageUrl})`;
    }
    return match;
  });
  
  // Also look for direct base64 image references that might not be properly formatted
  const base64Regex = /(data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+)/g;
  formattedContent = formattedContent.replace(base64Regex, (match) => {
    if (!match.startsWith('![')) {
      return `![Generated Image](${match})`;
    }
    return match;
  });
  
  return formattedContent;
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() && attachedImages.length === 0) return;

  // Create message content
  let messageContent = input.trim();
  if (!messageContent && attachedImages.length > 0) {
    messageContent = "Here's an image for analysis"; // Default text if only image is attached
  }
  
  const newMessage: Message = {
    type: 'user',
    content: messageContent,
    timestamp: new Date().toLocaleTimeString()
  };
  
  // If there are attached images, add the first one to the message
  if (attachedImages.length > 0) {
    newMessage.imageUrl = attachedImages[0];
  }

  setMessages(prev => [...prev, newMessage]);
  setInput('');
  setIsLoading(true);
  setError(null);

  try {
    const response = await sendMessage(messageContent);
    
    // If response message is empty, it means we've already handled it (like direct image generation)
    if (response.message) {
      // Check if the response contains any image URLs
      const imageUrl = response.image_urls && response.image_urls.length > 0 
        ? response.image_urls[0] 
        : undefined;
      
      // Add assistant response
      const assistantResponse = {
        type: 'assistant',
        content: response.message,
        timestamp: response.timestamp || new Date().toLocaleTimeString(),
        imageUrl: imageUrl // Include the image URL if available
      };
      
      setMessages(prev => [...prev, assistantResponse]);
  
      // If there's a source URL, add it
      if (response.source_url) {
        setMessages(prev => [...prev, {
          type: 'tool',
          content: `Source: ${response.source_url}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    }
    
    // Clear attached images after sending
    setAttachedImages([]);

  } catch (error) {
    setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    setMessages(prev => [...prev, {
      type: 'error',
      content: error instanceof Error ? error.message : 'An error occurred while processing your request.',
      timestamp: new Date().toLocaleTimeString()
    }]);
  } finally {
    setIsLoading(false);
  }
};

const clearConversation = () => {
  // Stop any active speech processes
  stopListening();
  stopAudio();
  
  // Clear attached images
  setAttachedImages([]);
  
  setMessages([{
    type: 'system',
    content: 'Conversation cleared. Starting a new chat session.',
    timestamp: new Date().toLocaleTimeString()
  }]);
  setThreadId(null);
  setActiveTools([]);
  setError(null);
  inputRef.current?.focus();
};

const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newMode = e.target.value;
  setMode(newMode);
  setMessages(prev => [...prev, {
    type: 'system',
    content: `Mode changed to: ${newMode}`,
    timestamp: new Date().toLocaleTimeString()
  }]);
};

return (
  <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-gray-100">
    {/* Header */}
    <div className="bg-white border-b px-6 py-4 shadow-sm z-10">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Multimodal RAG Assistant</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700">
            <span className="mr-2">Mode:</span>
            <select 
              value={mode} 
              onChange={handleModeChange}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-blue-600 font-semibold"
            >
              <option value="explore">Explore</option>
              <option value="setup">Setup</option>
            </select>
          </div>
          
          <button 
            onClick={clearConversation} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={18} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>

    {/* Messages Area */}
    <div className="flex-1 overflow-y-auto py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-12 px-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-3 tracking-tight">Welcome to Multimodal RAG Assistant</h2>
            <p className="text-gray-600 mb-10 max-w-2xl mx-auto">Ask me anything about recent events, upload images for analysis, or request actions like web search, image generation, SMS, or calls.</p>
            
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
        )}
        
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-xl ${message.type === 'user' ? 'ml-12' : 'mr-12'} ${messageStyles[message.type as keyof typeof messageStyles]}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {message.type === 'user' ? 'You' : message.type.charAt(0).toUpperCase() + message.type.slice(1)}
                  </p>
                  
                  {/* Add TTS button for assistant messages */}
                  {message.type === 'assistant' && (
                    <div className="flex gap-2">
                      {currentAudio && isSpeaking ? (
                        <button 
                          onClick={stopAudio}
                          className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Stop speaking"
                        >
                          <VolumeX size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => playAudio(message.content, idx)}
                          className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                          title="Listen to this message"
                        >
                          <Volume2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Display image if present */}
                {message.imageUrl && (
                  <div className="mb-3">
                    <div className="relative group">
                      <img 
                        src={message.imageUrl} 
                        alt={`Image in ${message.type} message`} 
                        className="max-w-full h-auto max-h-64 rounded-lg border border-gray-200 shadow-sm cursor-pointer" 
                        onClick={() => openImageModal(message.imageUrl!)}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-2 bg-white bg-opacity-90 rounded-full shadow-md"
                            onClick={() => openImageModal(message.imageUrl!)}
                          >
                            <Search size={16} className="text-gray-700" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="prose prose-sm max-w-none text-gray-800">
                  {message.type === 'assistant' ? (
                    <ReactMarkdown components={{
                      img: ({node, ...props}) => (
                        <img 
                          {...props} 
                          className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm my-2"
                          onClick={() => props.src && openImageModal(props.src)}
                          style={{cursor: 'pointer', maxHeight: '400px'}}
                        />
                      )
                    }}>
                      {formatMarkdown(message.content)}
                    </ReactMarkdown>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3">{message.timestamp}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>

    {/* Image Modal */}
    {isImageModalOpen && selectedImage && (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-auto p-4 shadow-xl relative">
          <button 
            className="absolute top-4 right-4 p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
            onClick={closeImageModal}
          >
            <X size={20} className="text-gray-800" />
          </button>
          
          <div className="flex flex-col items-center pt-8">
            <img 
              src={selectedImage} 
              alt="Full size" 
              className="max-w-full h-auto rounded-lg" 
            />
            
            <div className="flex gap-3 mt-4">
              <button 
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-2"
                onClick={async () => {
                  try {
                    const analysis = await analyzeImage(selectedImage);
                    // Add analysis as a new assistant message
                    setMessages(prev => [...prev, {
                      type: 'assistant',
                      content: `Image Analysis: ${analysis}`,
                      timestamp: new Date().toLocaleTimeString()
                    }]);
                    closeImageModal();
                  } catch (error) {
                    setError('Failed to analyze image');
                  }
                }}
              >
                <Search size={16} />
                <span>Analyze Image</span>
              </button>
              
              <button 
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
                onClick={async () => {
                  try {
                    const processedImage = await processImage(selectedImage, 'grayscale');
                    // Add processed image as a new assistant message
                    setMessages(prev => [...prev, {
                      type: 'assistant',
                      content: 'I processed your image to grayscale:',
                      imageUrl: processedImage,
                      timestamp: new Date().toLocaleTimeString()
                    }]);
                    closeImageModal();
                  } catch (error) {
                    setError('Failed to process image');
                  }
                }}
              >
                <Settings size={16} />
                <span>Convert to Grayscale</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Input Area */}
    <div className="border-t bg-white p-6 shadow-lg">
      <div className="max-w-5xl mx-auto">
        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 border border-gray-200 bg-gray-50 p-3 rounded-lg">
            {attachedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img 
                  src={image} 
                  alt={`Attached ${index+1}`} 
                  className="w-20 h-20 object-cover rounded border border-gray-300"
                />
                <button
                  className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAttachedImage(index)}
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      
        <div className="flex flex-wrap gap-3 mb-4 justify-center">
          <ToolButton 
            label="Web Search" 
            icon={Search} 
            active={activeTools.includes('web-search')} 
            color="blue"
          />
          <ToolButton 
            label="Web Scraping" 
            icon={Globe} 
            active={activeTools.includes('web-scrape')} 
            color="green"
          />
          <ToolButton 
            label="SMS" 
            icon={MessageSquare} 
            active={activeTools.includes('sms')} 
            color="purple"
          />
          <ToolButton 
            label="Call" 
            icon={Phone} 
            active={activeTools.includes('call')} 
            color="red"
          />
          <ToolButton 
            label="Speech" 
            icon={Mic} 
            active={activeTools.includes('speech')} 
            color="orange"
          />
          <ToolButton 
            label="Images" 
            icon={ImageIcon} 
            active={activeTools.includes('image-generation') || activeTools.includes('image-analysis')} 
            color="indigo"
          />
          
          {threadId && (
            <div className="ml-auto text-xs text-gray-500 flex items-center bg-gray-100 rounded-full px-3 py-2">
              <span className="font-medium text-gray-600 mr-1">Session:</span> {threadId.substring(0, 8)}...
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything or upload an image..."
                className="w-full p-4 pr-24 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 bg-white placeholder-gray-400 shadow-sm"
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
              />
              
              {/* Add microphone button inside input */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`absolute right-14 top-1/2 transform -translate-y-1/2 p-2 rounded-full ${
                    isListening 
                      ? 'bg-red-100 text-red-600 animate-pulse' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  disabled={isLoading || isProcessingSpeech || isImageLoading}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  <Mic size={18} />
                </button>
              )}
              
              {/* Add image upload button inside input */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                disabled={isLoading || isListening || isProcessingSpeech || isImageLoading}
                title="Upload image"
              >
                <Upload size={18} />
              </button>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || isListening || isProcessingSpeech || isImageLoading || (!input.trim() && attachedImages.length === 0)} 
              className="px-5 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading || isImageLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
};

export default ChatInterface;