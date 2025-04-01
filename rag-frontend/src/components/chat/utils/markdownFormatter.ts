// src/components/chat/utils/markdownFormatter.ts
import { Message } from '../types';

/**
 * Formats markdown content from messages, handling special cases
 * @param content The markdown content to format
 * @param messages The array of all messages for context
 * @returns Formatted markdown content
 */
export const formatMarkdown = (content: string, messages: Message[]) => {
  // First handle image references
  let formattedContent = handleImageReferences(content, messages);
  
  // Then fix any code formatting issues
  formattedContent = fixCodeFormatting(formattedContent);
  
  return formattedContent;
};

/**
 * Handles image references in markdown
 */
const handleImageReferences = (content: string, messages: Message[]) => {
  // Handle old format with IMAGE: tokens
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

/**
 * Fixes code formatting issues in markdown
 */
const fixCodeFormatting = (content: string) => {
  let formattedContent = content;
  
  // Fix single word/term code blocks that should be inline code
  formattedContent = formattedContent.replace(
    /```(javascript|typescript|jsx|js|ts)?\s*([a-zA-Z0-9_\-.$]+)\s*```/g, 
    (match, lang, term) => {
      // If it's a single word/identifier, make it inline code
      if (term && term.length < 30 && !term.includes('\n')) {
        return `\`${term}\``;
      }
      return match;
    }
  );
  
  // Fix code blocks with just single import statements or short expressions
  formattedContent = formattedContent.replace(
    /```(javascript|typescript|jsx|js|ts)?\s*(import .+ from ['"].+['"];?)\s*```/g,
    (match, lang, importStatement) => {
      if (importStatement && importStatement.length < 60) {
        return `\`${importStatement}\``;
      }
      return match;
    }
  );
  
  // Fix library/package name code blocks
  formattedContent = formattedContent.replace(
    /```(javascript|typescript|jsx|js|ts)?\s*([@a-zA-Z0-9_\-./]+)\s*```/g,
    (match, lang, packageName) => {
      // If it's a package name pattern, make it inline code
      if (packageName && packageName.length < 40 && !packageName.includes('\n')) {
        return `\`${packageName}\``;
      }
      return match;
    }
  );
  
  return formattedContent;
};