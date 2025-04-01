// src/components/chat/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Message } from './types';
import { detectToolsFromMessage } from './utils/toolDetection';
import { 
  sendMessage, 
  processSpeech, 
  getTextToSpeech,
  analyzeImage,
  processImage,
  getConversationHistory
} from './services/apiService';
import { useTheme } from '@/components/ThemeProvider';
import { hasFormattedContent, detectAndFormatCode } from './utils/formatDetection';

// Components
import ChatHeader from './components/ChatHeader';
import MessagesContainer from './components/MessagesContainer';
import ToolBar from './components/ToolBar';
import ChatInput from './components/ChatInput';
import ImageModal from './components/ImageModal';
import ConversationSidebar from './components/ConversationSidebar';
import ReasoningTest from './components/ReasoningTest';

interface ChatInterfaceProps {
  userName?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userName }) => {
  // Theme state
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
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
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Media recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Refs
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

  // Handle thread selection from sidebar
  const handleThreadSelect = async (selectedThreadId: string) => {
    setIsLoading(true);
    try {
      const history = await getConversationHistory(selectedThreadId);
      
      // Convert messages to the format used by the UI
      const formattedMessages = history.messages.map(msg => {
        const message: Message = {
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp).toLocaleTimeString()
        };
        
        // Add imageUrl if present in metadata
        if (msg.metadata?.imageUrl) {
          message.imageUrl = msg.metadata.imageUrl;
        }
        
        return message;
      });
      
      setMessages(formattedMessages);
      setThreadId(selectedThreadId);
      setSidebarOpen(false);
      
      // Show a system message to indicate thread selection
      // This helps provide visual feedback that we're in a different conversation
      setMessages(prev => [
        ...formattedMessages,
        {
          type: 'system',
          content: 'Loaded previous conversation',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } catch (error) {
      setError('Failed to load conversation history');
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setThreadId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
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
      e.target.value = '';
      
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
          setIsProcessingSpeech(true);
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
          setIsProcessingSpeech(false);
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
  const cleanupAudio = (audio: HTMLAudioElement | null) => {
    if (!audio) return;
    
    try {
      // Remove all event listeners first
      audio.onended = null;
      audio.onerror = null;
      audio.oncanplay = null;
      audio.oncanplaythrough = null;
      
      // Pause and reset
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      
      // Force browser to forget about this element
      audio.load();
    } catch (e) {
      console.log("Cleanup error:", e);
    }
  };

  // Add this function to ChatInterface.tsx
  const playAudioFallback = (text: string): boolean => {
    try {
      // Check if browser supports speech synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Cancel any current speech
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Browser TTS fallback error:", error);
      return false;
    }
  };

  const playAudio = async (text: string, messageIndex?: number) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        setCurrentAudio(null);
      }
      
      setIsSpeaking(true);
      setError(null); // Clear any previous errors
      
      // Get audio data from API
      let audioUrl: string | undefined;
      try {
        audioUrl = await getTextToSpeech(text);
        console.log("Raw audio response:", audioUrl ? audioUrl.substring(0, 30) + "..." : "none");
        
        if (!audioUrl) {
          throw new Error("No audio data received");
        }
        
        // Create audio element with more robust error handling
        const audio = new Audio();
        
        // Create a promise to handle the audio loading
        const audioLoadPromise = new Promise<boolean>((resolve) => {
          // Add success handler
          audio.oncanplaythrough = () => {
            resolve(true);
          };
          
          // Add error handler that doesn't throw
          audio.onerror = (e) => {
            console.error("Audio error:", e);
            // Don't reject, just log - this prevents the error from bubbling up
            resolve(false); // Resolve with false to indicate there was an error
          };
        });
        
        // Set the source
        audio.src = audioUrl;
        audio.load(); // Explicitly load
        setCurrentAudio(audio);
        
        // Wait for audio to be ready
        await audioLoadPromise;
        
        // Try to play (this might still work even if the above had an error)
        try {
          await audio.play();
        } catch (playError) {
          // Ignore play errors - the audio might still play
          console.log("Audio play error (can be ignored if audio works):", playError);
        }
        
        // If messageIndex is provided, update the message with audio URL
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
        
      } catch (apiError) {
        console.error('API TTS error:', apiError);
        
        // Try browser TTS fallback
        if (!playAudioFallback(text)) {
          throw new Error('Both API and browser TTS failed');
        }
      }
      
    } catch (error) {
      console.error('All audio playback methods failed:', error);
      setError('Audio playback unavailable');
      setIsSpeaking(false);
    }
  };

  // Also update the stopAudio function
  const stopAudio = () => {
    cleanupAudio(currentAudio);
    setCurrentAudio(null);
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

  // Analyze image from modal
  const handleAnalyzeImage = async (imageUrl: string) => {
    try {
      const analysis = await analyzeImage(imageUrl);
      
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
  };

  // Process image from modal
  const handleProcessImage = async (imageUrl: string, operation: string) => {
    try {
      const processedImage = await processImage(imageUrl, operation);
      
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
  };

  // Submit the message
  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    if (e && e.preventDefault) e.preventDefault();
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
      const response = await sendMessage(messageContent, threadId, mode, attachedImages, messages);
      console.log("API Response:", {
        message: response.message?.substring(0, 50) + "...",
        hasReasoning: Boolean(response.reasoning),
        reasoningPreview: response.reasoning?.substring(0, 50) + "...",
        isReasoningSameAsMessage: response.reasoning === response.message
      });
      
      // Set thread ID if returned
      if (response.thread_id) {
        setThreadId(response.thread_id);
      }
      
      // Detect which tools were used
      const toolsUsed = response.tools_used.length > 0 
        ? response.tools_used 
        : detectToolsFromMessage(response.message);
      
      // Set active tools
      if (toolsUsed.length > 0) {
        setActiveTools(toolsUsed);
        
        // Remove tool indicators after delay
        setTimeout(() => {
          setActiveTools([]);
        }, 5000);
      }
      
      // If response message is empty, it means we've already handled it (like direct image generation)
      if (response.message) {
        // Check if the response contains any image URLs
        const imageUrl = response.image_urls && response.image_urls.length > 0 
          ? response.image_urls[0] 
          : undefined;
        
        // Add assistant response with reasoning if available
        const assistantResponse: Message = {
          type: 'assistant',
          content: response.message,
          timestamp: response.timestamp || new Date().toLocaleTimeString(),
          imageUrl: imageUrl, // Include the image URL if available
          reasoning: response.reasoning, // Include reasoning from backend
          reasoningTitle: response.reasoning_title || "Reasoning Completed",
          isReasoningComplete: true
        };
        
        console.log("Adding assistant response:", {
          content: assistantResponse.content?.substring(0, 50) + "...",
          hasReasoning: Boolean(assistantResponse.reasoning),
          reasoningPreview: assistantResponse.reasoning?.substring(0, 50) + "..."
        });
        
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
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0a0a14]' : 'bg-gray-300'}`}>
      {/* Sidebar */}
      <ConversationSidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentThreadId={threadId}
        onThreadSelect={handleThreadSelect}
        onNewConversation={startNewConversation}
      />
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Header */}
      <ChatHeader 
        mode={mode}
        onModeChange={handleModeChange}
        onShowSidebar={() => setSidebarOpen(true)}
        userName={userName}
      />

      {/* Add the test component right here */}
      <ReasoningTest />

      {/* Messages Area */}
      <MessagesContainer 
        messages={messages}
        isSpeaking={isSpeaking}
        currentAudio={currentAudio}
        onPlayAudio={playAudio}
        onStopAudio={stopAudio}
        onOpenImageModal={openImageModal}
      />

      {/* Image Modal */}
      <ImageModal 
        isOpen={isImageModalOpen}
        imageUrl={selectedImage}
        onClose={closeImageModal}
        onAnalyze={handleAnalyzeImage}
        onProcess={handleProcessImage}
      />

      {/* Tool Bar */}
      <div className={`py-1 px-6 ${
        isDark ? 'bg-[#0a0a14]' : 'bg-gray-200'
      }`}>
        <div className="max-w-5xl mx-auto">
          <ToolBar 
            activeTools={activeTools}
            threadId={threadId}
          />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput 
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        isListening={isListening}
        isProcessingSpeech={isProcessingSpeech}
        isImageLoading={isImageLoading}
        speechSupported={speechSupported}
        attachedImages={attachedImages}
        onSubmit={handleSubmit}
        onStartListening={startListening}
        onStopListening={stopListening}
        onFileUpload={handleFileUpload}
        onRemoveImage={removeAttachedImage}
      />
    </div>
  );
};

export default ChatInterface;