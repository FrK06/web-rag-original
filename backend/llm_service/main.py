from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import aiohttp
import redis.asyncio as redis
import os
import json
import logging
from datetime import datetime
import httpx
import re
import uuid
from urllib.parse import urlparse
import hashlib

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LLM Orchestration Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI API settings
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o")

# Redis connection
REDIS_URI = os.getenv("REDIS_URI", "redis://redis:6379/4")
redis_client = None

# Service URLs
SERVICE_MAP = {
    "search": os.getenv("SEARCH_SERVICE_URL", "http://search-service:8002"),
    "multimedia": os.getenv("MULTIMEDIA_SERVICE_URL", "http://multimedia-service:8003"),
    "notification": os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8004"),
}

# Rate limiting settings
MAX_LLM_REQUESTS_PER_DAY = int(os.getenv("MAX_LLM_REQUESTS", "500"))
DEFAULT_CACHE_TTL = int(os.getenv("CACHE_TTL", "1800"))  # 30 minutes default cache

class ProcessRequest(BaseModel):
    query: str
    thread_id: str
    mode: str = "explore"
    conversation_history: List[Dict[str, Any]] = []
    image_context: Optional[str] = None
    attached_images: List[str] = []
    project_context: Optional[Dict[str, Any]] = None
    include_reasoning: bool = False  # Add this field

@app.on_event("startup")
async def startup_event():
    global redis_client
    try:
        redis_client = redis.Redis.from_url(REDIS_URI)
        await redis_client.ping()
        logger.info("Connected to Redis")
        
        # Initialize rate limit counter
        today = datetime.now().strftime('%Y-%m-%d')
        if not await redis_client.exists(f"llm_request_count:{today}"):
            await redis_client.set(f"llm_request_count:{today}", "0", ex=86400)  # Expires in 24 hours
            
    except Exception as e:
        logger.error(f"Error connecting to Redis: {str(e)}")
        redis_client = None

@app.on_event("shutdown")
async def shutdown_event():
    if redis_client:
        await redis_client.close()
        logger.info("Closed Redis connection")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    status = {}
    
    # Check Redis connection
    if redis_client:
        try:
            if await redis_client.ping():
                status["redis"] = "connected"
            else:
                status["redis"] = "disconnected"
        except Exception:
            status["redis"] = "error"
    else:
        status["redis"] = "not_initialized"
    
    # Check OpenAI API credentials
    if OPENAI_API_KEY:
        status["openai_api"] = "configured"
    else:
        status["openai_api"] = "missing_credentials"
    
    # Add rate limit info
    try:
        if redis_client:
            today = datetime.now().strftime('%Y-%m-%d')
            count = await redis_client.get(f"llm_request_count:{today}")
            status["request_count"] = int(count) if count else 0
            status["request_limit"] = MAX_LLM_REQUESTS_PER_DAY
    except Exception:
        status["request_count"] = "error"
    
    # Check dependent services
    status["services"] = {}
    async with httpx.AsyncClient(timeout=2.0) as client:
        for name, url in SERVICE_MAP.items():
            try:
                response = await client.get(f"{url}/health")
                if response.status_code == 200:
                    status["services"][name] = "healthy"
                else:
                    status["services"][name] = "unhealthy"
            except Exception:
                status["services"][name] = "unreachable"
    
    overall_health = (
        status.get("redis") == "connected" and
        status.get("openai_api") == "configured" and
        all(v == "healthy" for v in status.get("services", {}).values())
    )
    
    return {
        "status": "healthy" if overall_health else "unhealthy",
        "service": "llm",
        "details": status
    }

async def check_rate_limit() -> bool:
    """Check if rate limit is exceeded"""
    if not redis_client:
        return True  # Proceed if Redis is not available
    
    today = datetime.now().strftime('%Y-%m-%d')
    key = f"llm_request_count:{today}"
    
    # Get current count
    count = await redis_client.get(key)
    count = int(count) if count else 0
    
    # Check limit
    if count >= MAX_LLM_REQUESTS_PER_DAY:
        logger.warning(f"LLM request limit exceeded: {count}/{MAX_LLM_REQUESTS_PER_DAY}")
        return False
    
    # Increment counter
    await redis_client.incr(key)
    if not await redis_client.ttl(key) > 0:
        await redis_client.expire(key, 86400)  # 24 hours
    
    return True

def create_system_prompt(
    query: str, 
    mode: str,
    conversation_history: List[Dict[str, Any]],
    image_context: Optional[str] = None,
    project_context: Optional[Dict[str, Any]] = None,
    thread_id: Optional[str] = None,
    for_reasoning: bool = False  # Add this parameter to create different prompts for reasoning vs response
) -> str:
    """Create a comprehensive system prompt for the LLM with enhanced memory support
    
    Args:
        query: The current user query
        mode: The conversation mode (explore or setup)
        conversation_history: The full conversation history
        image_context: Optional context from analyzed images
        project_context: Optional project-specific context
        thread_id: Optional thread identifier for conversation tracking
        for_reasoning: Whether this prompt is for the reasoning step (vs. final response)
        
    Returns:
        A formatted system prompt with full context
    """
    # Base system prompt
    if for_reasoning:
        # Reasoning-specific prompt
        base_prompt = """You are an AI assistant tasked with thinking step-by-step before responding.

IMPORTANT REASONING INSTRUCTIONS:
1. Analyze the user's query thoroughly to understand what they're asking.
2. Break down your thought process in a structured way.
3. Consider different approaches or perspectives to answer the question.
4. Identify any assumptions you're making.
5. Think about what information you need to provide a complete answer.
6. DO NOT provide the final response yet - focus ONLY on your reasoning process.
7. Structure your reasoning as a step-by-step analysis.

When analyzing date or time queries:
1. The current date is {current_date} and it's {current_day_of_week}
2. Show your calculation process for any date-related reasoning

Your reasoning should be detailed enough that someone following along could understand your thinking process.
"""
    else:
        # Response-specific prompt
        base_prompt = """You are a helpful assistant that can search the web, extract information from websites, communicate via SMS/phone calls, and work with images.

When providing your final response:
1. Be clear, concise, and direct in answering the user's question.
2. Your answer should be straightforward and focused on what the user asked.
3. DO NOT repeat your reasoning process - the user has already seen that.
4. DO NOT say "Based on my reasoning" or reference your thinking process.
5. Just give the answer in a natural, conversational way.

When asked about date, time, or day of week:
1. The current date is {current_date} and it's {current_day_of_week}
2. Use this information directly - do not use tools for this

When asked about recent events, news, or releases:
1. Always use the search_web tool first with a date-specific search
2. Then use scrape_webpage to get the full content from the most recent relevant results
3. Only provide information from what you find in the actual search results

Conversation thread ID: {thread_id}
"""

    current_date = datetime.now().strftime("%B %d, %Y")
    current_day = datetime.now().strftime("%A")
    base_prompt = base_prompt.format(
        current_date=current_date, 
        current_day_of_week=current_day,
        thread_id=thread_id if thread_id else 'New conversation'
    )
    
    # Add image-specific instructions if image context is provided
    if image_context and not for_reasoning:
        image_prompt = """
When working with images:
1. If asked to describe or analyze an image, use the analyze_image tool to get detailed information about image contents
2. If asked to create an image, use the generate_image tool with a detailed prompt
3. If asked to modify an image, use the process_image tool with appropriate parameters
4. When describing images, be comprehensive and detailed
5. You can see attached images directly and provide your analysis

Image Context:
{image_context}"""
        base_prompt += image_prompt.format(image_context=image_context)

    # Add tool usage guidance for the response prompt
    if not for_reasoning:
        tools_prompt = """
For questions about:
- Recent AI/LLM releases: specifically search AI news websites and include "2025" in the search
- Current events: always include the current month and year in the search
- Technology updates: specifically look for news from this week or this month
- When users request notifications, use send_sms or make_call to follow up.
- When users want to hear information, use speak_text to convert your response to audio
- When users want images created, use generate_image to create visuals based on descriptions"""
        base_prompt += tools_prompt

    # Add memory-specific instructions to improve context retention
    memory_prompt = """
IMPORTANT MEMORY INSTRUCTIONS:
You have access to the FULL conversation history between you and the user.
When responding, always:
1. Reference and acknowledge previous parts of the conversation when appropriate
2. Maintain continuity by connecting to earlier topics and questions
3. Use the user's previously stated preferences or concerns in your responses
4. Show that you remember details the user has shared before
5. Don't act surprised by information that was previously discussed
6. If the user previously shared images, remember what they showed and refer back to them if relevant
7. Keep track of what visual information you've already seen and analyzed
"""
    base_prompt += memory_prompt

    # Add multimodal context handling
    multimodal_context = """
In this conversation, you may encounter:
- Text messages
- Images shared by the user
- Voice transcripts
- Results from web searches

Maintain a coherent thread across all these modalities.
"""
    base_prompt += multimodal_context

    # Add mode-specific instructions
    if mode == "explore":
        mode_prompt = """
You are in EXPLORE mode. Focus on providing comprehensive information and educational content.
When users ask about topics, provide in-depth explanations and context.
Use search tools proactively to find the most up-to-date information."""
        base_prompt += mode_prompt
    elif mode == "setup":
        mode_prompt = """
You are in SETUP mode. Focus on helping users configure systems and solve technical problems.
Provide step-by-step instructions and ask clarifying questions when needed.
When providing configuration instructions, be specific and detailed."""
        base_prompt += mode_prompt

    # Add project context if provided
    if project_context:
        project_prompt = """
Project Context:
"""
        for key, value in project_context.items():
            project_prompt += f"{key}: {value}\n"
        base_prompt += project_prompt

    # Add conversation context with formatted history
    context_prompt = f"""
Current question: {query}

IMPORTANT - Previous conversation history:
You must use this conversation history to maintain context when replying.
Reference prior exchanges when answering and maintain continuity of thought.
"""
    
    # Add a better-formatted conversation history with clear delineation
    if conversation_history and len(conversation_history) > 0:
        # Format the conversation history for readability
        formatted_history = []
        for msg in conversation_history:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            
            if isinstance(content, list):
                # Handle multimodal content
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                content = " ".join(text_parts)
            
            # Format based on role
            if role == "user":
                formatted_history.append(f"Human: {content}")
            elif role == "assistant":
                formatted_history.append(f"Assistant: {content}")
            elif role == "system":
                formatted_history.append(f"System: {content}")
            else:
                formatted_history.append(f"{role.capitalize()}: {content}")
        
        context_prompt += "\n--- CONVERSATION HISTORY START ---\n"
        context_prompt += "\n".join(formatted_history)
        context_prompt += "\n--- CONVERSATION HISTORY END ---\n"
        
        # Add explicit reminder to use the history
        context_prompt += "\nRemember to reference and build upon this conversation history in your response."
    else:
        context_prompt += "\nThis is the start of a new conversation."
    
    base_prompt += context_prompt

    # Add explicit message structure instructions for the final response
    if not for_reasoning:
        message_prompt = """
IMPORTANT FORMATTING INSTRUCTIONS:
1. When presenting search results, always format them in a structured way:
   - Start with a comprehensive summary of your findings
   - Present 5 sources in a clear list format at the end
   - Use markdown formatting for readability

2. When showing tables, use proper markdown table syntax:
   | Header1 | Header2 | Header3 |
   |---------|---------|---------|
   | Data1   | Data2   | Data3   |

3. Format code blocks with language-specific syntax highlighting.
"""
        base_prompt += message_prompt
    else:
        # Extra instruction for reasoning prompt
        base_prompt += """
IMPORTANT: This is ONLY your reasoning step. The user will see this before your final answer.
Focus on explaining your thought process clearly and breaking down how you're approaching their question.
DO NOT provide the final answer here - you'll give that separately.
"""

    return base_prompt

def format_conversation_history(history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format conversation history for the LLM with full context preservation"""
    formatted_history = []
    
    # Process all messages in history - don't limit to a specific number
    for message in history:
        role = message.get("role", "")
        content = message.get("content", "")
        
        # Skip empty messages
        if not content:
            continue
            
        if role == "user":
            formatted_history.append({
                "role": "user",
                "content": content
            })
        elif role == "assistant":
            formatted_history.append({
                "role": "assistant",
                "content": content
            })
        # Could add handling for system/tool messages if needed
    
    return formatted_history

def detect_tools_from_response(response: str) -> List[str]:
    """Detect which tools were used based on the response content"""
    tools_used = []
    
    # Search detection
    if any(term in response.lower() for term in [
        "search result", "found information", "according to", "sources:"
    ]):
        tools_used.append("web-search")
    
    # Web scraping detection
    if any(term in response.lower() for term in [
        "scraped", "from the website", "page content"
    ]):
        tools_used.append("web-scrape")
    
    # SMS detection
    if any(term in response.lower() for term in [
        "sms sent", "message sent", "texted"
    ]):
        tools_used.append("sms")
    
    # Call detection
    if any(term in response.lower() for term in [
        "call initiated", "called", "phone call"
    ]):
        tools_used.append("call")
    
    # Speech detection
    if any(term in response.lower() for term in [
        "speaking", "audio response", "listen"
    ]):
        tools_used.append("speech")
    
    # Image generation detection
    if any(term in response.lower() for term in [
        "image generated", "created an image", "dall-e"
    ]) or "![Generated Image]" in response:
        tools_used.append("image-generation")
    
    # Image analysis detection
    if any(term in response.lower() for term in [
        "analyzed image", "image shows", "in this image"
    ]):
        tools_used.append("image-analysis")
    
    return tools_used

def format_table_response(text: str) -> str:
    """Format pipe-delimited text as proper markdown tables"""
    if '|' not in text:
        return text
    
    lines = text.split('\n')
    formatted_lines = []
    in_table = False
    table_data = []
    
    for line in lines:
        # Check if line has multiple pipe characters and doesn't look like it's already in a markdown table
        if line.count('|') > 2 and '---' not in line:
            if not in_table:
                in_table = True
                table_data = []
            table_data.append(line)
        else:
            # If we were processing a table and now hit non-table content
            if in_table:
                # Format the collected table
                formatted_table = format_as_markdown_table(table_data)
                formatted_lines.append(formatted_table)
                in_table = False
            formatted_lines.append(line)
    
    # Handle case where text ends with table
    if in_table:
        formatted_table = format_as_markdown_table(table_data)
        formatted_lines.append(formatted_table)
    
    return '\n'.join(formatted_lines)

def format_as_markdown_table(table_lines: List[str]) -> str:
    """Transform pipe-delimited lines into a properly formatted markdown table"""
    if not table_lines:
        return ""
    
    # Clean up the lines
    cleaned_lines = []
    for line in table_lines:
        # Strip leading/trailing pipes and whitespace
        line = line.strip()
        if line.startswith('|'): line = line[1:]
        if line.endswith('|'): line = line[:-1]
        
        # Split by pipe and clean cells
        cells = [cell.strip() for cell in line.split('|')]
        cleaned_lines.append('| ' + ' | '.join(cells) + ' |')
    
    # Build the table with header and separator row
    table = [cleaned_lines[0]]
    
    # Add separator row
    cell_count = len(cleaned_lines[0].split('|')) - 1
    separator = '|' + '|'.join(['---' for _ in range(cell_count)]) + '|'
    table.append(separator)
    
    # Add data rows
    if len(cleaned_lines) > 1:
        table.extend(cleaned_lines[1:])
    
    return '\n'.join(table)

def enhance_search_results_formatting(content: str) -> str:
    """Enhance the formatting of search results"""
    # Identify if this is a search response
    if not any(term in content.lower() for term in [
        "search results",
        "found online",
        "according to",
        "sources:"
    ]):
        return content
    
    # Split into summary and sources
    parts = re.split(r'(?i)(sources:|references:|from these sources:)', content, 1)
    
    if len(parts) < 2:
        # No clear separation, just return the original
        return content
    
    summary_part = parts[0].strip()
    sources_part = ''.join(parts[1:]).strip()
    
    # Enhance the summary
    summary_enhanced = extract_and_format_key_points(summary_part)
    
    # Format the sources section
    sources_enhanced = format_sources_section(sources_part)
    
    # Combine enhanced sections
    return f"{summary_enhanced}\n\n**Sources:**\n{sources_enhanced}"

def extract_and_format_key_points(summary: str) -> str:
    """Extract and format key points from summary"""
    # First, check if the summary is already well-structured
    if "**" in summary or summary.strip().startswith("1."):
        return summary
    
    # Try to break into paragraphs
    paragraphs = [p.strip() for p in summary.split('\n') if p.strip()]
    
    if len(paragraphs) >= 3:
        # Good structure, format as key points
        formatted = "**Summary of Key Findings:**\n\n"
        for i, para in enumerate(paragraphs, 1):
            if len(para) > 20:  # Only include substantial paragraphs
                formatted += f"{i}. {para}\n\n"
        return formatted
    else:
        # Not enough paragraphs, return as is with a header
        return f"**Summary:**\n\n{summary}"

def format_sources_section(sources: str) -> str:
    """Format the sources section to clearly show sources"""
    # Extract source URLs and titles
    source_matches = re.findall(r'(?i)(?:(?:\d+\.|\-|\*)\s*)?(?:\[?([^\]]+)\]?)?\s*(?:\()?(https?://[^\s\)]+)(?:\))?', sources)
    
    formatted_sources = ""
    sources_seen = set()
    source_count = 0
    
    # Format each source
    for i, (title, url) in enumerate(source_matches, 1):
        if url in sources_seen:
            continue
            
        sources_seen.add(url)
        domain = urlparse(url).netloc
        
        # Clean up the title or use domain if missing
        if not title or len(title) < 3:
            title = domain
            
        formatted_sources += f"{i}. [{title}]({url})\n"
        source_count += 1
        
        if source_count >= 5:
            break
    
    # If we don't have enough sources, add placeholders
    while source_count < 5:
        source_count += 1
        formatted_sources += f"{source_count}. [Additional information not available]\n"
    
    return formatted_sources

def extract_image_urls(text: str) -> List[str]:
    """Extract image URLs from markdown text"""
    # Match markdown image syntax
    pattern = r'!\[.*?\]\((.*?)\)'
    matches = re.findall(pattern, text)
    
    # Also match base64 data URLs
    base64_pattern = r'data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+'
    base64_matches = re.findall(base64_pattern, text)
    
    # Combine matches
    urls = matches + base64_matches
    
    return urls

@app.post("/process")
async def process_query(request: ProcessRequest):
    """Process a query using OpenAI LLM and coordinate with other services"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    if not await check_rate_limit():
        raise HTTPException(status_code=429, detail="LLM request limit exceeded")
    
    # Create cache key based on query and conversation
    # Using stable input hash for caching
    hasher = hashlib.md5()
    hasher.update(request.query.encode())
    if request.conversation_history:
        # Only include last 3 messages in the cache key to prevent excessive uniqueness
        recent_messages = request.conversation_history[-3:]
        hasher.update(json.dumps(recent_messages).encode())
    hasher.update(request.mode.encode())
    if request.image_context:
        hasher.update(request.image_context.encode())
    cache_key = f"llm_response:{hasher.hexdigest()}"
    
    # Check cache
    if redis_client:
        cached_result = await redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for query: {request.query[:30]}...")
            return json.loads(cached_result)
    
    # Create a request ID for tracing
    request_id = str(uuid.uuid4())
    logger.info(f"Processing query {request_id}: {request.query[:50]}...")
    
    # Special case handlers
    
    # Check for direct image generation request
    image_gen_match = re.search(r"(generate|create|make|draw) .*image (?:of|showing|with) (.*?)(?:\.|\?|$)", request.query.lower())
    if image_gen_match:
        image_description = image_gen_match.group(2).strip()
        if image_description:
            try:
                logger.info(f"Detected image generation request: {image_description}")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    image_response = await client.post(
                        f"{SERVICE_MAP['multimedia']}/generate-image",
                        json={
                            "prompt": image_description,
                            "size": "1024x1024",
                            "style": "vivid",
                            "quality": "standard"
                        }
                    )
                    
                    if image_response.status_code == 200:
                        result = image_response.json()
                        image_url = result.get("image", "")
                        
                        # Create a response
                        response = {
                            "message": f"I've created an image of {image_description}:\n\n![Generated Image]({image_url})",
                            "tools_used": ["image-generation"],
                            "image_urls": [image_url],
                            "status": "success",
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Cache result
                        if redis_client:
                            await redis_client.set(
                                cache_key,
                                json.dumps(response),
                                ex=DEFAULT_CACHE_TTL
                            )
                        
                        return response
            except Exception as e:
                logger.error(f"Error in direct image generation: {str(e)}")
                # Continue with regular processing if direct handling fails
    
    # Check for SMS request
    sms_match = re.search(r"(send|text|sms) .*(message|sms|text) (?:to|for) (.*?)(?::|\.|\?|$)", request.query.lower())
    if sms_match:
        recipient = sms_match.group(3).strip()
        # Extract message content - look for content in quotes
        message_match = re.search(r'"([^"]*)"', request.query)
        if message_match:
            message = message_match.group(1)
            try:
                logger.info(f"Detected SMS request to: {recipient}")
                async with httpx.AsyncClient() as client:
                    sms_response = await client.post(
                        f"{SERVICE_MAP['notification']}/send-sms",
                        json={
                            "recipient": recipient,
                            "message": message
                        }
                    )
                    
                    if sms_response.status_code == 200:
                        result = sms_response.json()
                        
                        # Create a response
                        response = {
                            "message": f"✅ SMS sent to {recipient} with message: '{message}'.",
                            "tools_used": ["sms"],
                            "status": "success",
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Cache result
                        if redis_client:
                            await redis_client.set(
                                cache_key,
                                json.dumps(response),
                                ex=DEFAULT_CACHE_TTL
                            )
                        
                        return response
            except Exception as e:
                logger.error(f"Error handling SMS request: {str(e)}")
                # Continue with regular processing if direct handling fails
    
    # Check for call request - similar special cases
    
    try:
        # Format full conversation history - don't truncate it
        formatted_history = format_conversation_history(request.conversation_history)
        
        # Check if reasoning is requested
        include_reasoning = getattr(request, 'include_reasoning', False)
        
        # Initialize reasoning variables
        reasoning_output = ""
        reasoning_title = "Reasoning Completed"
        
        # First: Get reasoning step (if requested)
        if include_reasoning:
            # Create a separate system prompt for reasoning
            reasoning_system_prompt = create_system_prompt(
                query=request.query,
                mode=request.mode,
                conversation_history=request.conversation_history,
                image_context=request.image_context,
                project_context=request.project_context,
                thread_id=request.thread_id,
                for_reasoning=True  # This will use the reasoning-specific prompt
            )
            
            # Use the reasoning-specific system prompt
            think_messages = [{"role": "system", "content": reasoning_system_prompt}]
            
            # Add conversation history
            if formatted_history:
                think_messages.extend(formatted_history)
            
            # Add current user query
            user_content = []
            user_content.append({"type": "text", "text": request.query})
            if request.attached_images:
                for img in request.attached_images:
                    user_content.append({
                        "type": "image_url", 
                        "image_url": {"url": img}
                    })
            
            think_messages.append({"role": "user", "content": user_content})
            
            # Call OpenAI API for reasoning
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            think_data = {
                "model": DEFAULT_MODEL,
                "messages": think_messages,
                "temperature": 0.7,
                "max_tokens": 1000,
                "response_format": { "type": "text" }
            }
            
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=30.0, read=120.0, write=30.0, pool=30.0)) as client:
                reasoning_response = await client.post(
                    f"{OPENAI_API_BASE}/chat/completions",
                    headers=headers,
                    json=think_data
                )
                
                if reasoning_response.status_code != 200:
                    logger.warning(f"Reasoning step failed: {reasoning_response.text}")
                else:
                    reasoning_result = reasoning_response.json()
                    reasoning_output = reasoning_result["choices"][0]["message"]["content"]
                    reasoning_title = "Reasoning Completed"
                    
                    # Log the reasoning output
                    logger.info(f"Reasoning generated: {reasoning_output[:100]}...")
        
        # Now make the final API call for the actual response
        # Use the regular system prompt (not for reasoning)
        system_prompt = create_system_prompt(
            query=request.query,
            mode=request.mode,
            conversation_history=request.conversation_history,
            image_context=request.image_context,
            project_context=request.project_context,
            thread_id=request.thread_id,
            for_reasoning=False  # This will use the standard response prompt
        )
        
        # Prepare messages for OpenAI API
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add all conversation history - don't limit to last 10 messages
        if formatted_history:
            messages.extend(formatted_history)
        
        # Add current user query
        user_content = []
        
        # Add text content
        user_content.append({"type": "text", "text": request.query})
        
        # Add image content if available
        if request.attached_images:
            for img in request.attached_images:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
        
        messages.append({"role": "user", "content": user_content})
        
        # Call OpenAI API
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": DEFAULT_MODEL,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2000,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "search_web",
                        "description": "Search the web for current information",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "The search query"
                                },
                                "max_results": {
                                    "type": "integer",
                                    "description": "Maximum number of results to return",
                                    "default": 5
                                }
                            },
                            "required": ["query"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "scrape_webpage",
                        "description": "Extract content from a webpage",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "url": {
                                    "type": "string",
                                    "description": "The URL to scrape"
                                }
                            },
                            "required": ["url"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "send_sms",
                        "description": "Send an SMS message",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "recipient": {
                                    "type": "string",
                                    "description": "The phone number to send the SMS to"
                                },
                                "message": {
                                    "type": "string",
                                    "description": "The message to send"
                                }
                            },
                            "required": ["recipient", "message"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "make_call",
                        "description": "Initiate a phone call",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "recipient": {
                                    "type": "string",
                                    "description": "The phone number to call"
                                },
                                "message": {
                                    "type": "string",
                                    "description": "The message to convey in the call",
                                    "default": "This is an automated call."
                                }
                            },
                            "required": ["recipient"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "generate_image",
                        "description": "Generate an image based on a description",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "prompt": {
                                    "type": "string",
                                    "description": "Detailed description of the image to generate"
                                },
                                "size": {
                                    "type": "string",
                                    "description": "Image size",
                                    "enum": ["1024x1024", "1024x1792", "1792x1024"],
                                    "default": "1024x1024"
                                },
                                "style": {
                                    "type": "string",
                                    "description": "Image style",
                                    "enum": ["vivid", "natural"],
                                    "default": "vivid"
                                }
                            },
                            "required": ["prompt"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "analyze_image",
                        "description": "Analyze an image and describe its contents",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "image_url": {
                                    "type": "string",
                                    "description": "URL or base64 data of the image to analyze"
                                }
                            },
                            "required": ["image_url"]
                        }
                    }
                }
            ]
        }
        
        timeout = httpx.Timeout(connect=30.0, read=120.0, write=30.0, pool=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OPENAI_API_BASE}/chat/completions",
                headers=headers,
                json=data
            )
            
            if response.status_code != 200:
                error_text = await response.text()
                logger.error(f"OpenAI API error: {error_text}")
                raise HTTPException(status_code=response.status, detail=f"LLM API error: {error_text}")
            
            result = response.json()
        
        # Handle tool calls
        message = result["choices"][0]["message"]
        content = message.get("content", "")
        tool_calls = message.get("tool_calls", [])
        tools_used = []
        
        # Process tool calls if any
        if tool_calls:
            for tool_call in tool_calls:
                function = tool_call.get("function", {})
                name = function.get("name")
                arguments_json = function.get("arguments", "{}")
                
                try:
                    arguments = json.loads(arguments_json)
                    
                    if name == "search_web":
                        # Call search service
                        tools_used.append("web-search")
                        async with httpx.AsyncClient() as client:
                            search_response = await client.post(
                                f"{SERVICE_MAP['search']}/search",
                                json=arguments
                            )
                            
                            if search_response.status_code == 200:
                                search_results = search_response.json()
                                
                                # Format search results
                                results_text = "**Search Results:**\n\n"
                                if search_results.get("results"):
                                    for i, result in enumerate(search_results["results"], 1):
                                        results_text += f"{i}. [{result.get('title', 'Untitled')}]({result.get('link', '')})\n"
                                        results_text += f"   {result.get('snippet', '')}\n\n"
                                else:
                                    results_text += "No relevant results found.\n"
                                
                                # Append to content
                                if content:
                                    content += f"\n\n{results_text}"
                                else:
                                    content = results_text
                    
                    elif name == "scrape_webpage":
                        # Call scrape service
                        tools_used.append("web-scrape")
                        async with httpx.AsyncClient() as client:
                            scrape_response = await client.post(
                                f"{SERVICE_MAP['search']}/scrape",
                                json=arguments
                            )
                            
                            if scrape_response.status_code == 200:
                                scrape_result = scrape_response.json()
                                
                                # Append to content
                                if scrape_result.get("success"):
                                    if content:
                                        content += f"\n\nExtracted from {arguments.get('url')}:\n"
                                        content += f"{scrape_result.get('content', '')[:500]}...\n"
                                    else:
                                        content = f"Extracted from {arguments.get('url')}:\n"
                                        content += f"{scrape_result.get('content', '')[:500]}...\n"
                    
                    elif name == "send_sms":
                        # Call notification service
                        tools_used.append("sms")
                        async with httpx.AsyncClient() as client:
                            sms_response = await client.post(
                                f"{SERVICE_MAP['notification']}/send-sms",
                                json=arguments
                            )
                            
                            if sms_response.status_code == 200:
                                sms_result = sms_response.json()
                                
                                # Append to content
                                recipient = arguments.get("recipient", "the recipient")
                                message_text = arguments.get("message", "")
                                if content:
                                    content += f"\n\n✅ SMS sent to {recipient} with message: '{message_text}'."
                                else:
                                    content = f"✅ SMS sent to {recipient} with message: '{message_text}'."
                    
                    elif name == "make_call":
                        # Call notification service
                        tools_used.append("call")
                        async with httpx.AsyncClient() as client:
                            call_response = await client.post(
                                f"{SERVICE_MAP['notification']}/make-call",
                                json=arguments
                            )
                            
                            if call_response.status_code == 200:
                                call_result = call_response.json()
                                
                                # Append to content
                                recipient = arguments.get("recipient", "the recipient")
                                message_text = arguments.get("message", "")
                                if content:
                                    content += f"\n\n✅ Call initiated to {recipient} with message: '{message_text}'."
                                else:
                                    content = f"✅ Call initiated to {recipient} with message: '{message_text}'."
                    
                    elif name == "generate_image":
                        # Call multimedia service
                        tools_used.append("image-generation")
                        async with httpx.AsyncClient(timeout=60.0) as client:
                            image_response = await client.post(
                                f"{SERVICE_MAP['multimedia']}/generate-image",
                                json={
                                    "prompt": arguments.get("prompt", ""),
                                    "size": arguments.get("size", "1024x1024"),
                                    "style": arguments.get("style", "vivid"),
                                    "quality": "standard"
                                }
                            )
                            
                            if image_response.status_code == 200:
                                image_result = image_response.json()
                                image_url = image_result.get("image", "")
                                
                                # Append to content
                                prompt = arguments.get("prompt", "the requested image")
                                if content:
                                    content += f"\n\nI've created an image based on your description:\n\n![Generated Image of {prompt}]({image_url})"
                                else:
                                    content = f"I've created an image based on your description:\n\n![Generated Image of {prompt}]({image_url})"
                    
                    elif name == "analyze_image":
                        # Call multimedia service
                        tools_used.append("image-analysis")
                        async with httpx.AsyncClient() as client:
                            analysis_response = await client.post(
                                f"{SERVICE_MAP['multimedia']}/analyze-image",
                                json={"image": arguments.get("image_url", "")}
                            )
                            
                            if analysis_response.status_code == 200:
                                analysis_result = analysis_response.json()
                                
                                # Append to content
                                analysis_text = analysis_result.get("analysis", "")
                                if content:
                                    content += f"\n\nImage Analysis:\n{analysis_text}"
                                else:
                                    content = f"Image Analysis:\n{analysis_text}"
                
                except Exception as e:
                    logger.error(f"Error processing tool call {name}: {str(e)}")
                    if content:
                        content += f"\n\nError processing {name}: {str(e)}"
                    else:
                        content = f"Error processing {name}: {str(e)}"
        
        # Apply post-processing
        if "web-search" in tools_used:
            content = enhance_search_results_formatting(content)
        
        # Apply table formatting
        content = format_table_response(content)
        
        # Extract image URLs if any
        image_urls = extract_image_urls(content)
        
        # If no tools explicitly used, try to infer from content
        if not tools_used:
            tools_used = detect_tools_from_response(content)
        
        # Create final response
        api_response = {
            "message": content,
            "tools_used": tools_used,
            "image_urls": image_urls,
            "timestamp": datetime.now().isoformat(),
            "thread_id": request.thread_id
        }
        
        # Add reasoning if it was generated
        if reasoning_output:
            api_response["reasoning"] = reasoning_output
            api_response["reasoning_title"] = reasoning_title
        
        # Cache response
        if redis_client and content:
            await redis_client.set(
                cache_key,
                json.dumps(api_response),
                ex=DEFAULT_CACHE_TTL
            )
        
        logger.info(f"Completed processing {request_id} with {len(tools_used)} tools")
        return api_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query {request_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)