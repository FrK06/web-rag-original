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

// Chat API
export const sendMessage = async (
  content: string, 
  threadId: string | null, 
  mode: string,
  attachedImages: string[],
  messages: Message[]
): Promise<ChatResponse> => {
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
        const image = await generateImageDirectly(imagePrompt);
        
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
    console.log('Thread ID:', threadId);
    
    // Convert messages to a format that the backend can use
    const formattedMessages = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    const response = await axios.post('http://localhost:8000/api/chat/', {
      content,
      thread_id: threadId,
      mode,
      attached_images: attachedImages,
      // Include the full message history for context
      conversation_history: formattedMessages
    });

    console.log('Response from server:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Error sending message:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Server error: ${error.response.data.detail || error.message}`);
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to get response');
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
  }
};

export const getTextToSpeech = async (text: string): Promise<string> => {
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

// Image API
export const generateImageDirectly = async (prompt: string): Promise<string> => {
  try {
    const response = await axios.post<ImageGenerationResponse>('http://localhost:8000/api/generate-image/', {
      prompt,
      size: '1024x1024',
      style: 'vivid',
      quality: 'standard'
    });
    
    if (response.data.status === 'success') {
      return response.data.image;
    } else {
      throw new Error(response.data.detail || 'Failed to generate image');
    }
  } catch (error) {
    console.error('Error generating image directly:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image');
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  try {
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
  }
};

export const analyzeImage = async (imageData: string): Promise<string> => {
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

export const processImage = async (imageData: string, operation: string): Promise<string> => {
  try {
    const response = await axios.post<ImageProcessingResponse>('http://localhost:8000/api/process-image/', {
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

// Add these interfaces
interface ThreadPreview {
  thread_id: string;
  preview: string;
  last_updated: string;
}

interface ConversationsResponse {
  threads: ThreadPreview[];
  count: number;
  status: string;
}

interface ThreadHistoryResponse {
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
    const response = await axios.get<ConversationsResponse>('http://localhost:8000/api/conversations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw new Error('Failed to fetch conversations');
  }
};

/**
 * Fetches the full conversation history for a specific thread
 */
export const getConversationHistory = async (threadId: string): Promise<ThreadHistoryResponse> => {
  try {
    const response = await axios.get<ThreadHistoryResponse>(`http://localhost:8000/api/conversations/${threadId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    throw new Error('Failed to fetch conversation history');
  }
};

/**
 * Deletes a conversation thread
 */
export const deleteConversation = async (threadId: string): Promise<{status: string}> => {
  try {
    const response = await axios.delete(`http://localhost:8000/api/conversations/${threadId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw new Error('Failed to delete conversation');
  }
};