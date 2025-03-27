from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import json
import logging
import time
import uuid
from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG API Gateway")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs - configurable through environment variables
SERVICE_MAP = {
    "conversation": os.getenv("CONVERSATION_SERVICE_URL", "http://conversation-service:8001"),
    "search": os.getenv("SEARCH_SERVICE_URL", "http://search-service:8002"),
    "multimedia": os.getenv("MULTIMEDIA_SERVICE_URL", "http://multimedia-service:8003"),
    "notification": os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8004"),
    "llm": os.getenv("LLM_SERVICE_URL", "http://llm-service:8005"),
}

# Timeout settings
DEFAULT_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "30.0"))

# Request models
class ChatMessage(BaseModel):
    content: str
    conversation_history: List[Dict[str, str]] = []
    mode: str = "explore"
    thread_id: Optional[str] = None
    attached_images: List[str] = []

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

@app.get("/api/health")
async def health_check():
    """Health check endpoint that pings all services"""
    start_time = time.time()
    results = {}
    is_healthy = True
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for service_name, url in SERVICE_MAP.items():
            try:
                response = await client.get(f"{url}/health")
                if response.status_code == 200:
                    results[service_name] = "healthy"
                else:
                    results[service_name] = "unhealthy"
                    is_healthy = False
            except Exception as e:
                results[service_name] = f"error: {str(e)}"
                is_healthy = False
    
    response_time = time.time() - start_time
    
    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "services": results,
        "response_time": f"{response_time:.3f}s",
        "version": "1.0.0",
    }

@app.post("/api/chat/")
async def chat_endpoint(message: ChatMessage):
    """Main chat endpoint that orchestrates services"""
    request_id = str(uuid.uuid4())
    logger.info(f"Processing chat request {request_id}")
    
    try:
        # 1. Store/retrieve conversation context
        conversation_data = {
            "thread_id": message.thread_id,
            "message": message.content,
            "conversation_history": message.conversation_history
        }
        
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            conversation_resp = await client.post(
                f"{SERVICE_MAP['conversation']}/store",
                json=conversation_data
            )
            
            if conversation_resp.status_code != 200:
                logger.error(f"Conversation service error: {conversation_resp.text}")
                raise HTTPException(status_code=500, detail="Error processing conversation")
                
            conversation_result = conversation_resp.json()
            thread_id = conversation_result["thread_id"]
            
            # 2. Process multimedia if present
            image_context = None
            if message.attached_images:
                multimedia_resp = await client.post(
                    f"{SERVICE_MAP['multimedia']}/analyze_batch",
                    json={"images": message.attached_images}
                )
                
                if multimedia_resp.status_code == 200:
                    image_context = multimedia_resp.json().get("analysis")
            
            # 3. Send to LLM service for processing
            llm_data = {
                "query": message.content,
                "thread_id": thread_id,
                "mode": message.mode,
                "conversation_history": conversation_result.get("history", []),
                "image_context": image_context,
                "attached_images": message.attached_images
            }
            
            llm_resp = await client.post(
                f"{SERVICE_MAP['llm']}/process",
                json=llm_data,
                timeout=120.0  # Longer timeout for LLM processing
            )
            
            if llm_resp.status_code != 200:
                logger.error(f"LLM service error: {llm_resp.text}")
                raise HTTPException(status_code=500, detail="Error generating response")
                
            result = llm_resp.json()
            
            # 4. Store the result in conversation history
            await client.post(
                f"{SERVICE_MAP['conversation']}/update",
                json={
                    "thread_id": thread_id,
                    "assistant_message": result.get("message", ""),
                    "metadata": {
                        "tools_used": result.get("tools_used", []),
                        "image_urls": result.get("image_urls", [])
                    }
                }
            )
            
            logger.info(f"Completed chat request {request_id}")
            return result
            
    except httpx.RequestError as e:
        logger.error(f"Request error for {request_id}: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Service communication error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error for {request_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/api/speech-to-text/")
async def speech_to_text_endpoint(audio_data: AudioData):
    """Forward speech-to-text requests to multimedia service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['multimedia']}/speech-to-text",
            json={"audio": audio_data.audio}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/text-to-speech/")
async def text_to_speech_endpoint(request: TTSRequest):
    """Forward text-to-speech requests to multimedia service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['multimedia']}/text-to-speech",
            json={"text": request.text, "voice": request.voice}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/direct-image-generation/")
async def direct_image_generation_endpoint(request: Request):
    """Forward direct image generation requests to multimedia service"""
    data = await request.json()
    async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for image generation
        response = await client.post(
            f"{SERVICE_MAP['multimedia']}/generate-image",
            json=data
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/analyze-image/")
async def analyze_image_endpoint(request: ImageAnalysisRequest):
    """Forward image analysis requests to multimedia service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['multimedia']}/analyze-image",
            json={"image": request.image}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/process-image/")
async def process_image_endpoint(request: ImageProcessingRequest):
    """Forward image processing requests to multimedia service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['multimedia']}/process-image",
            json={"image": request.image, "operation": request.operation}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/send-sms/")
async def send_sms_endpoint(request: Request):
    """Forward SMS requests to notification service"""
    data = await request.json()
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['notification']}/send-sms",
            json=data
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.post("/api/make-call/")
async def make_call_endpoint(request: Request):
    """Forward call requests to notification service"""
    data = await request.json()
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['notification']}/make-call",
            json=data
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )
@app.get("/api/conversations/")
async def list_conversations_endpoint(limit: int = 20, skip: int = 0):
    """Forward conversation listing requests to conversation service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{SERVICE_MAP['conversation']}/threads",
            params={"limit": limit, "skip": skip}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.get("/api/conversations/{thread_id}")
async def get_conversation_endpoint(thread_id: str, limit: int = 100):
    """Forward conversation history requests to conversation service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{SERVICE_MAP['conversation']}/history/{thread_id}",
            params={"limit": limit}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.delete("/api/conversations/{thread_id}")
async def delete_conversation_endpoint(thread_id: str):
    """Forward conversation deletion requests to conversation service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.delete(
            f"{SERVICE_MAP['conversation']}/delete/{thread_id}"
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )
    
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)