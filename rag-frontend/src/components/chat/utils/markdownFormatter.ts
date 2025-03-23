// src/components/chat/utils/markdownFormatter.ts
import { Message } from '../types';

export const formatMarkdown = (content: string, messages: Message[]) => {
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