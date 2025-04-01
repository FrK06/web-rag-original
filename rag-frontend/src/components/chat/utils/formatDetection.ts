// src/components/chat/utils/formatDetection.ts
/**
 * Helper functions to detect and format code in user messages
 */

/**
 * Detects if a message may contain code blocks and adds markdown formatting if needed
 * @param content The message content to process
 * @returns Formatted content with markdown code blocks if needed
 */
export const detectAndFormatCode = (content: string): string => {
    // If content already has markdown code blocks, leave it as is
    if (content.includes('```')) {
      return content;
    }
  
    // Detect code block patterns
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    let formattedLines: string[] = [];
    let consecutiveIndentedLines = 0;
    
    // Common code file patterns
    const codeFilePatterns = [
      { regex: /\.(jsx?|tsx?)$/i, language: 'javascript' },
      { regex: /\.py$/i, language: 'python' },
      { regex: /\.html$/i, language: 'html' },
      { regex: /\.css$/i, language: 'css' },
      { regex: /\.(cs|java)$/i, language: 'csharp' },
      { regex: /\.php$/i, language: 'php' },
      { regex: /\.rb$/i, language: 'ruby' },
    ];
    
    // Check if first line looks like a filename with code extension
    if (lines.length > 0) {
      const fileMatch = lines[0].match(/\S+\.\w+/);
      if (fileMatch) {
        const potentialFilename = fileMatch[0];
        for (const pattern of codeFilePatterns) {
          if (pattern.regex.test(potentialFilename)) {
            codeBlockLanguage = pattern.language;
            inCodeBlock = true;
            formattedLines.push('```' + codeBlockLanguage);
            formattedLines.push(...lines);
            formattedLines.push('```');
            return formattedLines.join('\n');
          }
        }
      }
    }
  
    // Detect if content is import/require statements
    if (content.includes('import ') || content.includes('require(')) {
      if (content.includes('from ') || content.includes('import React')) {
        return '```javascript\n' + content + '\n```';
      }
    }
    
    // Detect function declarations
    if (content.match(/^(function|const|let|var|class)\s+\w+/m)) {
      if (content.includes('=>') || content.includes('return')) {
        return '```javascript\n' + content + '\n```';
      }
    }
  
    // Check for substantial indentation
    // Count lines that start with multiple spaces or tabs
    const indentedLines = lines.filter(line => line.match(/^(\s{2,}|\t+)/));
    if (indentedLines.length > 2 && indentedLines.length / lines.length > 0.3) {
      // Determine language if possible
      const languageHints = {
        'def ': 'python',
        'class ': 'python',
        'import ': 'python',
        'function': 'javascript',
        'public class': 'java',
        'private': 'java',
        'fun ': 'kotlin',
        '#include': 'cpp',
        'package ': 'java',
      };
  
      for (const [hint, lang] of Object.entries(languageHints)) {
        if (content.includes(hint)) {
          codeBlockLanguage = lang;
          break;
        }
      }
  
      return '```' + codeBlockLanguage + '\n' + content + '\n```';
    }
    
    // If we have consecutive indented lines, treat as code
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line looks like code
      const isCodeLike = line.match(/^(\s{2,}|\t+)/) || // Indented
                        line.match(/[{}\[\]();]$/) || // Ends with code symbols
                        line.match(/^\s*(if|else|for|while|switch|case)\s*\(/) || // Control structures
                        line.match(/^\s*(function|const|let|var|import|class)\s/); // Declarations
      
      if (isCodeLike) {
        consecutiveIndentedLines++;
      } else if (line.trim() === '') {
        // Don't reset count on empty lines
      } else {
        consecutiveIndentedLines = 0;
      }
      
      // If we have 3+ consecutive code-like lines, treat as code block
      if (consecutiveIndentedLines >= 3 && !inCodeBlock) {
        inCodeBlock = true;
        formattedLines.push('```');
        // Add back previous likely code lines
        const backtrack = Math.min(2, i-1);
        formattedLines = formattedLines.slice(0, formattedLines.length - backtrack);
        for (let j = i - backtrack; j <= i; j++) {
          formattedLines.push(lines[j]);
        }
      } else if (inCodeBlock && !isCodeLike && line.trim() !== '' && consecutiveIndentedLines === 0) {
        inCodeBlock = false;
        formattedLines.push('```');
        formattedLines.push(line);
      } else {
        formattedLines.push(line);
      }
    }
    
    if (inCodeBlock) {
      formattedLines.push('```');
    }
    
    // Only return formatted content if we actually found code blocks
    return formattedLines.join('\n') !== content ? formattedLines.join('\n') : content;
  };
  
  /**
   * Determines if text may contain formatted content like headers, lists or code
   * @param text Text to check
   * @returns True if the text likely needs formatting preservation
   */
  export const hasFormattedContent = (text: string): boolean => {
    if (!text) return false;
    
    // Check for markdown or formatted content
    return (
      text.includes('```') || // Code blocks
      text.includes('# ') || // Headers
      text.includes('- ') || // Lists
      text.includes('* ') || // Lists
      text.includes('1. ') || // Numbered lists
      text.match(/\n\s{2,}/) !== null || // Indented lines
      text.match(/\n\t+/) !== null || // Tab-indented lines
      text.split('\n').length > 3 // Multiple lines
    );
  };