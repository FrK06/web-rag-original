// src/components/chat/services/apiService.ts
import axios from 'axios';
import { 
  ChatResponse, 
  Message, 
  SpeechToTextResponse, 
  TextToSpeechResponse,
  ImageGenerationResponse,
  ImageAnalysisResponse,
  ImageProcessingResponse
} from '../types';

// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'X-CSRF-Token': localStorage.getItem('csrf_token') || ''
  };
};

// Helper function to implement retry logic
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`Retry attempt ${attempt}/${maxRetries}`);
      
      // Only wait if we're going to retry again
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError;
}

// Format error messages for user display
function formatErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const serverMessage = error.response.data?.detail || 
                           error.response.data?.message ||
                           `Server error: ${error.response.status}`;
      console.error('Server response:', error.response.data);
      return serverMessage;
    } else if (error.request) {
      console.error('No response received:', error.request);
      return 'Cannot reach the server. Please check your network connection.';
    } else {
      console.error('Request setup error:', error.message);
      return `Request error: ${error.message}`;
    }
  }
  
  return error?.message || 'An unknown error occurred';
}

// Chat API
export const sendMessage = async (
  content: string, 
  threadId: string | null, 
  mode: string,
  attachedImages: string[],
  messages: Message[]
): Promise<ChatResponse> => {
  try {
    console.log('Sending message with auth token:', localStorage.getItem('auth_token') ? 'present' : 'missing');
    
    // Format conversation history
    const formattedMessages = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    return await withRetry(async () => {
      const response = await axios.post<ChatResponse>(`${API_URL}/api/chat/`, {
        content,
        thread_id: threadId,
        mode,
        attached_images: attachedImages,
        conversation_history: formattedMessages,
        include_reasoning: true  // Add this flag to request reasoning from backend
      }, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      return response.data;
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error(formatErrorMessage(error));
  }
};

// Speech API
export const processSpeech = async (audioBlob: Blob): Promise<string> => {
  try {
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
    
    return await withRetry(async () => {
      // Send to server for processing
      const response = await axios.post<SpeechToTextResponse>(`${API_URL}/api/speech-to-text/`, {
        audio: base64Audio
      }, {
        timeout: 60000, // Speech processing might take longer
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        return response.data.text;
      } else {
        throw new Error('Failed to process speech');
      }
    });
  } catch (error) {
    console.error('Error processing speech:', error);
    throw new Error(formatErrorMessage(error));
  }
};

// In apiService.ts
export const getTextToSpeech = async (text: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await axios.post<TextToSpeechResponse>(`${API_URL}/api/text-to-speech/`, {
        text,
        voice: 'alloy'
      }, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        // Fix the base64 format
        const audioData = response.data.audio;
        console.log("Raw audio response:", audioData?.substring(0, 30));
        
        // Properly format the data URL
        if (audioData) {
          // If it already has correct data URL prefix, return as is
          if (audioData.startsWith('data:audio/mp3;base64,')) {
            return audioData;
          }
          
          // If it has incorrect double slash format, fix it
          if (audioData.startsWith('data:audio/mp3;base64//')) {
            return audioData.replace('data:audio/mp3;base64//', 'data:audio/mp3;base64,');
          }
          
          // If it's just raw base64, add the prefix
          return `data:audio/mp3;base64,${audioData}`;
        }
        
        throw new Error('No audio data in response');
      } else {
        throw new Error('Failed to generate speech');
      }
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    throw new Error(formatErrorMessage(error));
  }
};

// Image API
export const generateImageDirectly = async (prompt: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await axios.post<ImageGenerationResponse>(`${API_URL}/api/generate-image/`, {
        prompt,
        size: '1024x1024',
        style: 'vivid',
        quality: 'standard'
      }, {
        timeout: 60000, // Image generation can take longer
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        return response.data.image;
      } else {
        throw new Error(response.data.detail || 'Failed to generate image');
      }
    });
  } catch (error) {
    console.error('Error generating image directly:', error);
    throw new Error(formatErrorMessage(error));
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await axios.post<ImageGenerationResponse>(`${API_URL}/api/generate-image/`, {
        prompt,
        size: '1024x1024',
        style: 'vivid',
        quality: 'standard'
      }, {
        timeout: 60000,
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        return response.data.image; // Base64 encoded image
      } else {
        throw new Error('Failed to generate image');
      }
    });
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(formatErrorMessage(error));
  }
};

export const analyzeImage = async (imageData: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await axios.post<ImageAnalysisResponse>(`${API_URL}/api/analyze-image/`, {
        image: imageData
      }, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        return response.data.analysis;
      } else {
        throw new Error('Failed to analyze image');
      }
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw new Error(formatErrorMessage(error));
  }
};

export const processImage = async (imageData: string, operation: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const response = await axios.post<ImageProcessingResponse>(`${API_URL}/api/process-image/`, {
        image: imageData,
        operation: operation
      }, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        return response.data.image;
      } else {
        throw new Error('Failed to process image');
      }
    });
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error(formatErrorMessage(error));
  }
};

// Conversation management
export interface ThreadPreview {
  thread_id: string;
  preview: string;
  last_updated: string;
}

export interface ConversationsResponse {
  threads: ThreadPreview[];
  count: number;
  status: string;
}

export interface ThreadHistoryResponse {
  thread_id: string;
  messages: {
    role: string;
    content: string;
    timestamp: string;
    metadata?: {
      imageUrl?: string;
      tools_used?: string[];
    };
  }[];
  count: number;
}

/**
 * Fetches a list of all conversation threads
 */
export const getConversations = async (): Promise<ConversationsResponse> => {
  try {
    console.log("Fetching conversations with auth token:", localStorage.getItem('auth_token') ? 'present' : 'missing');
    
    return await withRetry(async () => {
      const response = await axios.get<ConversationsResponse>(`${API_URL}/api/conversations/`, {
        timeout: 10000,
        headers: getAuthHeaders(),
        withCredentials: true
      });
      return response.data;
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    // Return empty threads array instead of throwing to prevent UI crashes
    return { threads: [], count: 0, status: 'error' };
  }
};

/**
 * Fetches the full conversation history for a specific thread
 */
export const getConversationHistory = async (threadId: string): Promise<ThreadHistoryResponse> => {
  try {
    return await withRetry(async () => {
      const response = await axios.get<ThreadHistoryResponse>(`${API_URL}/api/conversations/${threadId}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      return response.data;
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    throw new Error(formatErrorMessage(error));
  }
};

/**
 * Deletes a conversation thread
 */
export const deleteConversation = async (threadId: string): Promise<{status: string}> => {
  try {
    return await withRetry(async () => {
      const response = await axios.delete(`${API_URL}/api/conversations/${threadId}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      return response.data;
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw new Error(formatErrorMessage(error));
  }
};

/**
 * Renames a conversation thread
 */
export const renameConversation = async (threadId: string, newName: string): Promise<{status: string}> => {
  try {
    return await withRetry(async () => {
      const response = await axios.put(`${API_URL}/api/conversations/${threadId}/rename`, {
        name: newName
      }, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      return response.data;
    });
  } catch (error) {
    console.error('Error renaming conversation:', error);
    throw new Error(formatErrorMessage(error));
  }
};