from fastapi import FastAPI, HTTPException, File, UploadFile, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Union
import os
#import io
from dotenv import load_dotenv
from src.web_rag_system import WebRAGSystem
from src.tools.speech_tools import SpeechTools
from src.tools.image_tools import ImageTools  # Import ImageTools
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
#import base64
import re


# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the WebRAGSystem
openai_api_key = os.getenv('OPENAI_API_KEY')
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

rag_system = WebRAGSystem(openai_api_key)
speech_tools = SpeechTools()  # Initialize the speech tools
image_tools = ImageTools()  # Initialize the image tools
# ThreadPoolExecutor for running blocking functions
executor = ThreadPoolExecutor()


def format_table_response(text: str) -> str:
    """Format pipe-delimited text as proper markdown tables."""
    if '|' not in text:
        return text
    
    lines = text.split('\n')
    formatted_lines = []
    table_data = []
    in_table = False
    
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
                formatted_table = _format_as_markdown_table(table_data)
                formatted_lines.append(formatted_table)
                in_table = False
            formatted_lines.append(line)
    
    # Handle case where text ends with table
    if in_table:
        formatted_table = _format_as_markdown_table(table_data)
        formatted_lines.append(formatted_table)
    
    return '\n'.join(formatted_lines)

def _format_as_markdown_table(table_lines: List[str]) -> str:
    """Transform pipe-delimited lines into a properly formatted markdown table."""
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
    header_cells = len(cleaned_lines[0].split('|')) - 1
    separator = '|' + '|'.join(['---' for _ in range(header_cells)]) + '|'
    table.append(separator)
    
    # Add data rows
    if len(cleaned_lines) > 1:
        table.extend(cleaned_lines[1:])
    
    return '\n'.join(table)


class ChatMessage(BaseModel):
    content: str
    conversation_history: List[Dict[str, str]] = []
    mode: str = "explore"
    thread_id: Optional[str] = None
    attached_images: List[str] = []  # List of base64 encoded images

class AudioData(BaseModel):
    audio: str  # Base64 encoded audio data

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"

class ImageRequest(BaseModel):
    prompt: str
    size: Optional[str] = "1024x1024"
    style: Optional[str] = "vivid"
    quality: Optional[str] = "standard"

class ImageAnalysisRequest(BaseModel):
    image: str  # Base64 encoded image or URL

class ImageProcessingRequest(BaseModel):
    image: str  # Base64 encoded image or URL
    operation: str  # Operation to perform

async def run_in_threadpool(func, *args, **kwargs):
    """Run a blocking function in a thread pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        executor, lambda: func(*args, **kwargs)
    )

def extract_project_context(message: str) -> Optional[Dict[str, str]]:
    """Extract project-related context from the message"""
    context = {}
    
    # Check if message contains project context
    if "project context" in message.lower():
        lines = message.split('\n')
        for line in lines:
            if ':' in line:
                key, value = line.split(':', 1)
                context[key.strip()] = value.strip()
    
    return context if context else None

def detect_tools_used(response: str) -> List[str]:
    """Detect which tools were used based on response content"""
    tools_used = []
    
    # Detect tool usage based on response content
    if any(term in response.lower() for term in ["search result", "found information", "according to"]):
        tools_used.append("web-search")
    
    if any(term in response.lower() for term in ["scraped", "from the website", "page content"]):
        tools_used.append("web-scrape")
    
    if any(term in response.lower() for term in ["sms sent", "message sent", "texted"]):
        tools_used.append("sms")
    
    if any(term in response.lower() for term in ["call initiated", "called", "phone call"]):
        tools_used.append("call")
    
    if any(term in response.lower() for term in ["speaking", "audio response", "listen"]):
        tools_used.append("speech")
        
    if any(term in response.lower() for term in ["image generated", "created an image"]):
        tools_used.append("image-generation")
        
    if any(term in response.lower() for term in ["analyzed image", "image shows", "in this image"]):
        tools_used.append("image-analysis")
    
    return tools_used

# In app.py, find the chat_endpoint function and update it

@app.post("/api/chat/")
async def chat_endpoint(message: ChatMessage):
    try:
        # Generate thread_id if not provided
        thread_id = message.thread_id or f"api-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Extract project context if available
        project_context = extract_project_context(message.content)
        
        # Process attached images if any
        image_context = None
        if message.attached_images and len(message.attached_images) > 0:
            # Analyze the first image to provide context
            image_analysis, error = await run_in_threadpool(
                image_tools.analyze_image,
                message.attached_images[0]
            )
            if not error:
                image_context = image_analysis
        
        # Get response from the RAG system
        response = await run_in_threadpool(
            rag_system.get_answer,
            query=message.content,
            thread_id=thread_id,
            mode=message.mode,
            project_context=project_context,
            image_context=image_context,
            attached_images=message.attached_images
        )
        
        # Apply table formatting if needed
        if '|' in response and ('---' not in response or '|---|' not in response):
            response = format_table_response(response)
        
        # Detect which tools were used based on response content
        tools_used = detect_tools_used(response)
        
        # Check for images in the response
        image_urls = []
        base64_regex = r'(data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+)'
        for match in re.finditer(base64_regex, response):
            image_urls.append(match.group(1))
        
        return {
            "message": response,
            "tools_used": tools_used,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "thread_id": thread_id,
            "image_urls": image_urls
        }
    
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )

@app.post("/api/speech-to-text/")
async def speech_to_text_endpoint(audio_data: AudioData):
    """
    Convert speech to text using the SpeechTools.
    Expects base64 encoded audio data.
    """
    try:
        # Decode the base64 audio
        audio_bytes = await run_in_threadpool(
            speech_tools.decode_base64_audio, 
            audio_data.audio
        )
        
        # Convert speech to text
        transcript, error = await run_in_threadpool(
            speech_tools.speech_to_text,
            audio_bytes
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
            
        return {
            "text": transcript,
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in speech-to-text endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"STT processing error: {str(e)}"
        )

@app.post("/api/text-to-speech/")
async def text_to_speech_endpoint(request: TTSRequest):
    """
    Convert text to speech using the SpeechTools.
    Returns audio as a streaming response.
    """
    try:
        # Set voice if provided
        if request.voice:
            speech_tools.set_voice(request.voice)
        
        # Convert text to speech
        audio_data, error = await run_in_threadpool(
            speech_tools.text_to_speech,
            request.text
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        # Return the audio data as base64
        audio_base64 = await run_in_threadpool(
            speech_tools.encode_audio_to_base64,
            audio_data
        )
        
        return {
            "audio": audio_base64,
            "format": "mp3",
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in text-to-speech endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"TTS processing error: {str(e)}"
     
        )

# Add this to app.py to enable direct image generation without going through the RAG system

@app.post("/api/direct-image-generation/")
async def direct_image_generation(request: ImageRequest):
    """
    Generate an image directly without using the full RAG pipeline.
    This avoids token limit errors when generating complex images.
    """
    try:
        # Create a fresh instance of ImageTools to avoid state/context carryover
        fresh_image_tools = ImageTools()
        
        # Limit prompt length to avoid token limits
        max_prompt_length = 900  # Safety margin below DALL-E limit
        prompt = request.prompt
        if len(prompt) > max_prompt_length:
            prompt = prompt[:max_prompt_length] + "..."
        
        # Set image parameters
        fresh_image_tools.image_size = request.size
        fresh_image_tools.image_style = request.style
        fresh_image_tools.image_quality = request.quality
        
        # Generate the image with fresh context
        image_data, error = await run_in_threadpool(
            fresh_image_tools.generate_image,
            prompt
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        return {
            "message": f"Image generated successfully: {prompt}",
            "image": image_data,
            "status": "success",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    except Exception as e:
        print(f"Error in direct image generation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image generation error: {str(e)}"
        )

@app.post("/api/generate-image/")
async def generate_image_endpoint(request: ImageRequest):
    """
    Generate an image using DALL-E based on a text prompt.
    Returns base64 encoded image.
    """
    try:
        # Create a fresh instance to avoid token limit issues
        fresh_image_tools = ImageTools()
        
        # Limit prompt size
        max_prompt_length = 900  # Safety margin
        prompt = request.prompt
        if len(prompt) > max_prompt_length:
            prompt = prompt[:max_prompt_length] + "..."
        
        # Set image parameters
        fresh_image_tools.image_size = request.size
        fresh_image_tools.image_style = request.style
        fresh_image_tools.image_quality = request.quality
        
        # Generate the image
        image_data, error = await run_in_threadpool(
            fresh_image_tools.generate_image,
            prompt
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        return {
            "image": image_data,
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in generate-image endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image generation error: {str(e)}"
        )

@app.post("/api/analyze-image/")
async def analyze_image_endpoint(request: ImageAnalysisRequest):
    """
    Analyze an image using GPT-4 Vision.
    Returns a detailed description of the image.
    """
    try:
        # Analyze the image
        analysis, error = await run_in_threadpool(
            image_tools.analyze_image,
            request.image
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        return {
            "analysis": analysis,
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in analyze-image endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image analysis error: {str(e)}"
        )

@app.post("/api/process-image/")
async def process_image_endpoint(request: ImageProcessingRequest):
    """
    Process an image with operations like resize, crop, or grayscale.
    Returns the processed image as base64.
    """
    try:
        # Process the image
        processed_image, error = await run_in_threadpool(
            image_tools.process_image,
            request.image,
            request.operation
        )
        
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        return {
            "image": processed_image,
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in process-image endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image processing error: {str(e)}"
        )

@app.post("/api/upload-image/")
async def upload_image_endpoint(file: UploadFile = File(...)):
    """
    Upload an image file and return it as base64 for use in other endpoints.
    """
    try:
        # Read the uploaded file
        file_content = await file.read()
        
        # Convert to base64
        base64_image = await run_in_threadpool(
            image_tools.encode_image_to_base64,
            file_content
        )
        
        return {
            "image": base64_image,
            "filename": file.filename,
            "status": "success"
        }
    
    except Exception as e:
        print(f"Error in upload-image endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image upload error: {str(e)}"
        )

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Basic check that systems are initialized
        return {
            "status": "healthy", 
            "version": "0.2",
            "llm_model": rag_system.llm.model,
            "speech_enabled": True,
            "image_enabled": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)