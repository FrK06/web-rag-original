// src/components/chat/utils/contentDetection.ts
/**
 * Helper functions to detect and format different types of content
 */

/**
 * Detects if content appears to be a text document (like an essay, report, etc.)
 * @param content The content to analyze
 * @returns Boolean indicating if the content appears to be a document
 */
export const isTextDocument = (content: string): boolean => {
    if (!content || content.length < 50) return false;
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 3) return false;
    
    // Check for document indicators
    const hasChapters = content.match(/Chapter \d+:|Section \d+:/i) !== null;
    const hasTitle = lines[0].length < 100 && lines[0].match(/[A-Z]/) !== null && !lines[0].includes('{') && !lines[0].includes('(');
    const hasStructuredParagraphs = lines.filter(line => line.length > 100).length >= 2;
    
    // Check for absence of code indicators
    const hasCodeIndicators = content.includes('{') && content.includes('}') ||
                             content.includes('const ') ||
                             content.includes('function') ||
                             content.includes('import ') ||
                             content.includes('class ') ||
                             content.includes('return ') ||
                             content.includes(' = ') && content.includes(';');
    
    return (hasChapters || (hasTitle && hasStructuredParagraphs)) && !hasCodeIndicators;
  };
  
  /**
   * Detects if content appears to be code
   * @param content The content to analyze
   * @returns Boolean indicating if the content appears to be code
   */
  export const isCodeContent = (content: string): boolean => {
    if (!content || content.length < 20) return false;
    
    // Count programming indicators
    let codeIndicators = 0;
    
    if (content.includes('{') && content.includes('}')) codeIndicators++;
    if (content.includes('(') && content.includes(')') && content.includes(';')) codeIndicators++;
    if (content.match(/\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bclass\b|\bimport\b|\breturn\b/g) !== null) codeIndicators++;
    if (content.includes(' = ') && content.includes(';')) codeIndicators++;
    if (content.includes('=>')) codeIndicators++;
    if (content.match(/<[a-zA-Z]+[^>]*>/) !== null) codeIndicators++; // HTML/JSX tags
    if (content.includes('className=')) codeIndicators++; 
    
    return codeIndicators >= 2;
  };
  
  /**
   * Determines the appropriate content display mode
   * @param content The content to analyze
   * @returns The display mode: 'document', 'code', or 'standard'
   */
  export const determineContentType = (content: string): 'document' | 'code' | 'standard' => {
    if (isTextDocument(content)) return 'document';
    if (isCodeContent(content)) return 'code';
    return 'standard';
  };