from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import aiohttp
import redis.asyncio as redis
import os
import json
import logging
import base64
import io
from datetime import datetime
import uuid
from PIL import Image, ImageOps

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Multimedia Service")

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

# Redis connection
REDIS_URI = os.getenv("REDIS_URI", "redis://redis:6379/2")
redis_client = None

# Rate limiting settings
DEFAULT_CACHE_TTL = int(os.getenv("CACHE_TTL", "7200"))  # 2 hour default cache
API_REQUEST_LIMIT = {
    "dall-e": int(os.getenv("DALLE_REQUEST_LIMIT", "100")),  # Daily API quota for image generation
    "whisper": int(os.getenv("WHISPER_REQUEST_LIMIT", "100")),  # Daily API quota for speech-to-text
    "tts": int(os.getenv("TTS_REQUEST_LIMIT", "100")),  # Daily API quota for text-to-speech
    "vision": int(os.getenv("VISION_REQUEST_LIMIT", "100"))  # Daily API quota for image analysis
}

class AudioRequest(BaseModel):
    audio: str  # Base64 encoded audio data

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"

class ImageGenerationRequest(BaseModel):
    prompt: str
    size: Optional[str] = "1024x1024"
    style: Optional[str] = "vivid"
    quality: Optional[str] = "standard"

class ImageAnalysisRequest(BaseModel):
    image: str  # Base64 encoded image or URL

class ImageProcessingRequest(BaseModel):
    image: str  # Base64 encoded image or URL
    operation: str  # Operation type
    params: Optional[Dict[str, Any]] = None

class ImageBatchRequest(BaseModel):
    images: List[str]  # List of base64 encoded images

@app.on_event("startup")
async def startup_event():
    global redis_client
    try:
        redis_client = redis.Redis.from_url(REDIS_URI)
        await redis_client.ping()
        logger.info("Connected to Redis")
        
        # Initialize API quota counters if needed
        today = datetime.now().strftime('%Y-%m-%d')
        for service, limit in API_REQUEST_LIMIT.items():
            quota_key = f"multimedia_api_quota:{service}:{today}"
            if not await redis_client.exists(quota_key):
                await redis_client.set(quota_key, "0", ex=86400)  # Expires in 24 hours
            
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
    
    # Add API quota info
    try:
        if redis_client:
            today = datetime.now().strftime('%Y-%m-%d')
            quota_info = {}
            for service, limit in API_REQUEST_LIMIT.items():
                quota_key = f"multimedia_api_quota:{service}:{today}"
                quota_used = await redis_client.get(quota_key)
                quota_info[service] = {
                    "used": int(quota_used) if quota_used else 0,
                    "limit": limit
                }
            status["api_quota"] = quota_info
    except Exception as e:
        status["api_quota"] = f"error: {str(e)}"
    
    overall_health = all(v in ["connected", "configured"] for k, v in status.items() if k not in ["api_quota"])
    
    return {
        "status": "healthy" if overall_health else "unhealthy",
        "service": "multimedia",
        "details": status
    }

async def check_rate_limit(service: str) -> bool:
    """Check if rate limit is exceeded for a service"""
    if not redis_client:
        return True  # Proceed if Redis is not available
    
    today = datetime.now().strftime('%Y-%m-%d')
    quota_key = f"multimedia_api_quota:{service}:{today}"
    
    # Get current usage
    quota_used = await redis_client.get(quota_key)
    quota_used = int(quota_used) if quota_used else 0
    
    # Check if limit exceeded
    if quota_used >= API_REQUEST_LIMIT.get(service, 1000):
        logger.warning(f"API quota exceeded for {service}. Used: {quota_used}/{API_REQUEST_LIMIT.get(service)}")
        return False
    
    # Increment usage
    await redis_client.incr(quota_key)
    if not await redis_client.ttl(quota_key) > 0:
        # Reset expiry if needed
        await redis_client.expire(quota_key, 86400)  # 24 hours
    
    return True

def decode_base64_image(base64_string: str) -> bytes:
    """Decode base64 string to bytes"""
    if "base64," in base64_string:
        base64_string = base64_string.split("base64,")[1]
    return base64.b64decode(base64_string)

def encode_image_to_base64(image_bytes: bytes, format: str = "JPEG") -> str:
    """Encode image bytes to base64 string"""
    img_buffer = io.BytesIO()
    img = Image.open(io.BytesIO(image_bytes))
    img.save(img_buffer, format=format)
    img_bytes = img_buffer.getvalue()
    return f"data:image/{format.lower()};base64,{base64.b64encode(img_bytes).decode('utf-8')}"

@app.post("/speech-to-text")
async def speech_to_text(request: AudioRequest):
    """Convert speech to text using OpenAI's Whisper API"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    if not await check_rate_limit("whisper"):
        raise HTTPException(status_code=429, detail="API quota exceeded for speech-to-text")
    
    try:
        # Decode audio
        if "base64," in request.audio:
            base64_audio = request.audio.split("base64,")[1]
        else:
            base64_audio = request.audio
        
        audio_bytes = base64.b64decode(base64_audio)
        
        # Save to temporary file
        temp_file = f"/tmp/audio_{uuid.uuid4()}.webm"
        with open(temp_file, "wb") as f:
            f.write(audio_bytes)
        
        # Call OpenAI API
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        async with aiohttp.ClientSession() as session:
            with open(temp_file, "rb") as f:
                form_data = aiohttp.FormData()
                form_data.add_field(
                    "file", 
                    f, 
                    filename="audio.webm", 
                    content_type="audio/webm"
                )
                form_data.add_field("model", "whisper-1")
                form_data.add_field("language", "en")
                
                async with session.post(
                    f"{OPENAI_API_BASE}/audio/transcriptions",
                    headers=headers,
                    data=form_data
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(status_code=response.status, detail=f"API error: {error_text}")
                    
                    result = await response.json()
        
        # Clean up temp file
        os.remove(temp_file)
        
        return {
            "text": result.get("text", ""),
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in speech-to-text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text error: {str(e)}")

@app.post("/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using OpenAI's TTS API"""
    if not OPENAI_API_KEY:
        logger.error("OpenAI API key not configured")
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    # Add detailed logging
    logger.info(f"Processing TTS request for text: {request.text[:50]}...")
    
    if not await check_rate_limit("tts"):
        logger.error("TTS rate limit exceeded")
        raise HTTPException(status_code=429, detail="API quota exceeded for text-to-speech")
    
    # Create cache key
    cache_key = f"tts:{hash(request.text)}:{request.voice}"
    
    # Check cache
    if redis_client:
        cached_result = await redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for TTS")
            return json.loads(cached_result)
    
    try:
        # Call OpenAI API
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "tts-1",
            "voice": request.voice,
            "input": request.text
        }
        
        logger.info(f"Calling OpenAI TTS API with voice: {request.voice}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OPENAI_API_BASE}/audio/speech",
                headers=headers,
                json=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"OpenAI API error: {error_text}")
                    raise HTTPException(status_code=response.status, detail=f"API error: {error_text}")
                
                audio_bytes = await response.read()
                logger.info(f"Received audio response, size: {len(audio_bytes)} bytes")
        
        # Encode to base64
        audio_base64 = f"data:audio/mp3;base64,{base64.b64encode(audio_bytes).decode('utf-8')}"
        
        result = {
            "audio": audio_base64,
            "format": "mp3",
            "status": "success"
        }
        
        # Cache result
        if redis_client:
            await redis_client.set(
                cache_key,
                json.dumps(result),
                ex=DEFAULT_CACHE_TTL
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        # Return more detailed error for debugging
        raise HTTPException(status_code=500, detail=f"Text-to-speech error: {str(e)}")

@app.post("/generate-image")
async def generate_image(request: ImageGenerationRequest):
    """Generate image using DALL-E API"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    if not await check_rate_limit("dall-e"):
        raise HTTPException(status_code=429, detail="API quota exceeded for image generation")
    
    # Create cache key
    cache_key = f"image-gen:{hash(request.prompt)}:{request.size}:{request.style}:{request.quality}"
    
    # Check cache
    if redis_client:
        cached_result = await redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for image generation")
            return json.loads(cached_result)
    
    try:
        # Limit prompt length
        if len(request.prompt) > 1000:
            request.prompt = request.prompt[:997] + "..."
        
        # Call OpenAI API
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "dall-e-3",
            "prompt": request.prompt,
            "size": request.size,
            "quality": request.quality,
            "style": request.style,
            "response_format": "b64_json",
            "n": 1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OPENAI_API_BASE}/images/generations",
                headers=headers,
                json=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(status_code=response.status, detail=f"API error: {error_text}")
                
                result = await response.json()
        
        if not result.get("data"):
            raise HTTPException(status_code=500, detail="No image data in API response")
        
        image_b64 = result["data"][0].get("b64_json", "")
        image_url = f"data:image/png;base64,{image_b64}"
        
        api_result = {
            "image": image_url,
            "prompt": request.prompt,
            "status": "success"
        }
        
        # Cache result
        if redis_client:
            await redis_client.set(
                cache_key,
                json.dumps(api_result),
                ex=DEFAULT_CACHE_TTL
            )
        
        return api_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image generation error: {str(e)}")

@app.post("/analyze-image")
async def analyze_image(request: ImageAnalysisRequest):
    """Analyze image using OpenAI's Vision API"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    if not await check_rate_limit("vision"):
        raise HTTPException(status_code=429, detail="API quota exceeded for image analysis")
    
    try:
        # Handle different input types
        image_url = request.image
        
        # Handle base64 encoded images
        if image_url.startswith("data:"):
            # Already in the correct format for API
            pass
        elif "http" in image_url:
            # It's a URL - keep as is
            pass
        else:
            # Assume it's a direct base64 string, convert to data URL
            image_url = f"data:image/jpeg;base64,{image_url}"
        
        # Create cache key
        cache_key = f"image-analysis:{hash(image_url)}"
        
        # Check cache
        if redis_client:
            cached_result = await redis_client.get(cache_key)
            if cached_result:
                logger.info(f"Cache hit for image analysis")
                return json.loads(cached_result)
        
        # Call OpenAI API for image analysis
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": """You are a helpful assistant that analyzes images. 
                    Describe the image in detail including objects, people, text, and other relevant information.
                    
                    IMPORTANT FORMATTING INSTRUCTIONS:
                    
                    1. When you detect tables in images, ALWAYS format your response using proper markdown table syntax.
                    2. NEVER present table data as a single line with pipe separators.
                    3. Always use alignment and spacing for readability.
                    4. For spreadsheets or financial data, ensure all numbers are properly aligned and formatted.
                    5. Always explain what the table represents after presenting it."""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": "Analyze this image in detail. If it contains a table, format it properly as a markdown table."
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url}
                        }
                    ]
                }
            ],
            "max_tokens": 1500
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OPENAI_API_BASE}/chat/completions",
                headers=headers,
                json=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(status_code=response.status, detail=f"API error: {error_text}")
                
                result = await response.json()
        
        analysis = result["choices"][0]["message"]["content"]
        
        api_result = {
            "analysis": analysis,
            "status": "success"
        }
        
        # Cache result
        if redis_client:
            await redis_client.set(
                cache_key,
                json.dumps(api_result),
                ex=DEFAULT_CACHE_TTL
            )
        
        return api_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image analysis error: {str(e)}")

@app.post("/analyze_batch")
async def analyze_batch_images(request: ImageBatchRequest):
    """Analyze a batch of images and provide a summary"""
    if not request.images:
        return {"analysis": "", "status": "success"}
    
    try:
        # For large batches, analyze only the first image in detail
        # This is a simplification - in production you might want to analyze all
        # and aggregate results
        if len(request.images) > 1:
            primary_image = request.images[0]
            analysis_result = await analyze_image(ImageAnalysisRequest(image=primary_image))
            analysis = analysis_result.get("analysis", "")
            
            # Add note about additional images
            additional = f"\n\n*Note: {len(request.images)-1} additional images were submitted but not analyzed in detail.*"
            return {
                "analysis": analysis + additional,
                "status": "success",
                "count": len(request.images)
            }
        else:
            # Just one image
            analysis_result = await analyze_image(ImageAnalysisRequest(image=request.images[0]))
            return {
                "analysis": analysis_result.get("analysis", ""),
                "status": "success",
                "count": 1
            }
            
    except Exception as e:
        logger.error(f"Error in batch image analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch analysis error: {str(e)}")

@app.post("/process-image")
async def process_image(request: ImageProcessingRequest):
    """Process image using Pillow"""
    try:
        # Decode image
        image_bytes = decode_base64_image(request.image)
        
        # Process using Pillow
        img = Image.open(io.BytesIO(image_bytes))
        
        if request.operation == "grayscale":
            processed_img = ImageOps.grayscale(img)
            
        elif request.operation.startswith("resize_"):
            dimensions = request.operation.split("_")[1]
            width, height = map(int, dimensions.split("x"))
            processed_img = img.resize((width, height))
            
        elif request.operation.startswith("crop_"):
            coords = request.operation.split("_")[1]
            left, top, right, bottom = map(int, coords.split(","))
            processed_img = img.crop((left, top, right, bottom))
            
        elif request.operation == "thumbnail":
            img.thumbnail((256, 256))
            processed_img = img
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operation: {request.operation}")
        
        # Convert back to base64
        img_io = io.BytesIO()
        processed_img.save(img_io, format="PNG")
        img_base64 = base64.b64encode(img_io.getvalue()).decode("utf-8")
        
        return {
            "image": f"data:image/png;base64,{img_base64}",
            "operation": request.operation,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)