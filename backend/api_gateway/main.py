from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from fastapi.responses import JSONResponse
import logging
import time
import uuid
from pydantic import BaseModel
from typing import Dict, List, Optional

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
    "auth": os.getenv("AUTH_SERVICE_URL", "http://auth-service:8006"),
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

class ConversationRenameRequest(BaseModel):
    name: str  # New name for the conversation

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

# Chat endpoint to handle messages
@app.post("/api/chat/")
async def chat_endpoint(request: Request):
    """Main chat endpoint that orchestrates services"""
    try:
        data = await request.json()
        
        # First store the message in conversation
        conversation_data = {
            "thread_id": data.get("thread_id"),
            "message": data.get("content", ""),
            "conversation_history": data.get("conversation_history", [])
        }
        
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            # Store message
            conversation_response = await client.post(
                f"{SERVICE_MAP['conversation']}/store",
                json=conversation_data
            )
            
            if conversation_response.status_code != 200:
                logger.error(f"Conversation service error: {conversation_response.text}")
                return JSONResponse(
                    status_code=conversation_response.status_code,
                    content=conversation_response.json()
                )
            
            conversation_result = conversation_response.json()
            thread_id = conversation_result.get("thread_id")
            
            # Process with LLM
            llm_data = {
                "query": data.get("content", ""),
                "thread_id": thread_id,
                "mode": data.get("mode", "explore"),
                "conversation_history": conversation_result.get("history", []),
                "attached_images": data.get("attached_images", [])
            }
            
            llm_response = await client.post(
                f"{SERVICE_MAP['llm']}/process",
                json=llm_data,
                timeout=60.0  # Longer timeout for LLM
            )
            
            if llm_response.status_code != 200:
                logger.error(f"LLM service error: {llm_response.text}")
                return JSONResponse(
                    status_code=llm_response.status_code,
                    content=llm_response.json()
                )
            
            result = llm_response.json()
            
            # Store assistant response
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
            
            return JSONResponse(content=result)
            
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": "Error processing message", "error": str(e)}
        )

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

# Endpoint to get conversation list
@app.get("/api/conversations/")
async def get_conversations(limit: int = 20, skip: int = 0):
    """Get list of conversations from conversation service"""
    try:
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
    except Exception as e:
        logger.error(f"Error getting conversations: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": "Error fetching conversations", "error": str(e)}
        )


# Endpoint to get conversation history
@app.get("/api/conversations/{thread_id}")
async def get_conversation(thread_id: str, limit: int = 100):
    """Get conversation history from conversation service"""
    try:
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
    except Exception as e:
        logger.error(f"Error getting conversation history: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": "Error fetching conversation history", "error": str(e)}
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

# New endpoint for renaming conversations
@app.put("/api/conversations/{thread_id}/rename")
async def rename_conversation_endpoint(thread_id: str, request: ConversationRenameRequest):
    """Forward conversation renaming requests to conversation service"""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.put(
            f"{SERVICE_MAP['conversation']}/rename/{thread_id}",
            json={"name": request.name}
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )
    
# Authentication routes
@app.post("/api/auth/register")
async def auth_register(request: Request):
    """Forward registration requests to auth service"""
    try:
        data = await request.json()
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{SERVICE_MAP['auth']}/register",
                json=data
            )
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        logger.error(f"Auth register error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Error processing registration request"}
        )

@app.post("/api/auth/login")
async def auth_login(request: Request):
    """Forward login requests to auth service with proper formatting"""
    try:
        # Get request body
        body = await request.json()
        
        # Create form data expected by FastAPI's OAuth2 form
        form_data = {
            "username": body.get("email", ""),  # Use email as username
            "password": body.get("password", "")
        }
        
        # Forward as form data
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{SERVICE_MAP['auth']}/login",
                data=form_data  # Send as form data, not JSON
            )
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        logger.error(f"Auth login error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Error processing authentication request"}
        )

# Fix for token refresh issue
@app.post("/api/auth/refresh")
async def auth_refresh(request: Request):
    """Forward token refresh requests to auth service"""
    try:
        data = await request.json()
        
        # Format the data correctly - use refresh_token as the key
        refresh_data = {
            "refresh_token": data.get("refresh_token", "")
        }
        
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{SERVICE_MAP['auth']}/refresh",
                json=refresh_data
            )
            
            # Return the response directly
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        logger.error(f"Error in token refresh: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": "Error refreshing token", "error": str(e)}
        )

@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    """Forward logout requests to auth service"""
    data = await request.json()
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{SERVICE_MAP['auth']}/logout",
            json=data
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

@app.get("/api/auth/me")
async def auth_me(request: Request):
    """Forward user info requests to auth service"""
    # Extract token from header
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    # Prepare headers with token
    headers = {"Authorization": auth_header}
    
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{SERVICE_MAP['auth']}/me",
            headers=headers
        )
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json")
        )

# Add middleware to validate JWT for protected routes
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Skip auth for non-protected routes
    if request.url.path.startswith("/api/auth/") or request.url.path == "/api/health":
        return await call_next(request)
    
    # Check for auth header
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        # If it's OPTIONS request (preflight), let it pass
        if request.method == "OPTIONS":
            return await call_next(request)
        
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid authorization header"}
        )
    
    # Validate token with auth service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{SERVICE_MAP['auth']}/me",
                headers={"Authorization": auth_header}
            )
            
            if response.status_code != 200:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"}
                )
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        # Continue if auth service is unreachable
        # This prevents complete system lockout if auth service is down
        # In production, you might want to enforce stricter validation
    
    # Continue with the request
    return await call_next(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)