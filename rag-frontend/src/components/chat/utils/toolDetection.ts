// src/components/chat/utils/toolDetection.ts

export const detectToolsFromMessage = (content: string): string[] => {
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