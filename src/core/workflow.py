from typing import List, Optional
from datetime import datetime
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

class RAGWorkflow:
    @staticmethod
    def create_system_prompt(latest_message: HumanMessage, conversation_history: List[str], image_content: Optional[List[str]] = None) -> str:
        # Detect if images are present in the conversation
        has_images = image_content is not None and len(image_content) > 0
        
        # Base system prompt
        base_prompt = f"""You are a helpful assistant that can search the web, extract information from websites, communicate via SMS/phone calls, and work with images.

When asked about date, time, or day of week:
1. DO NOT use tools - respond with the current system date/time
2. Today's date is {datetime.now().strftime('%B %d, %Y')} and it's {datetime.now().strftime('%A')}

When asked about recent events, news, or releases:
1. ALWAYS use the search_web tool first with a date-specific search (include "2025" or "this week" or "latest")
2. Then use scrape_webpage to get the full content from the most recent relevant results
3. Only provide information from what you find in the actual search results
4. If you can't find current information, say "I need to search for the most up-to-date information about this" and then search again
5. Never reference old information or make assumptions about dates
6. Always include the source and date of the information you found"""

        # Add image-specific instructions if images are present
        if has_images:
            image_prompt = """
When working with images:
1. If asked to describe or analyze an image, use the analyze_image tool to get detailed information about image contents
2. If asked to create an image, use the generate_image tool with a detailed prompt
3. If asked to modify an image, use the process_image tool with appropriate parameters
4. When describing images, be comprehensive and detailed
5. You can see attached images directly and provide your analysis"""
            base_prompt += image_prompt

        # Add tool usage guidance
        tools_prompt = """
For questions about:
- Recent AI/LLM releases: specifically search AI news websites and include "2025" in the search
- Current events: always include the current month and year in the search
- Technology updates: specifically look for news from this week or this month
- When users request notifications, use send_sms or make_call to follow up.
- When users want to hear information, use speak_text to convert your response to audio
- When users want images created, use generate_image to create visuals based on descriptions"""
        base_prompt += tools_prompt

        # Add conversation context
        context_prompt = f"""
Current question: {latest_message.content}

Previous conversation context:
{chr(10).join(conversation_history)}"""
        base_prompt += context_prompt

        return base_prompt

    @staticmethod
    def process_messages(messages: List) -> List[str]:
        conversation_history = []
        for msg in messages:
            if isinstance(msg, HumanMessage):
                # Get base content
                content = msg.content
                
                # Handle multimodal content
                if isinstance(content, list):
                    # Extract text parts only for the conversation history
                    text_parts = [item.get("text", "") for item in content if item.get("type") == "text"]
                    content = " ".join(text_parts) 
                
                conversation_history.append(f"Human: {content}")
            elif isinstance(msg, AIMessage):
                content = msg.content if hasattr(msg, "content") else str(msg)
                conversation_history.append(f"Assistant: {content}")
            elif isinstance(msg, ToolMessage):
                conversation_history.append(f"Tool: {msg.content}")
        return conversation_history