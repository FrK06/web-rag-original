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
from urllib.parse import parse_qsl
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG API Gateway")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.1.101:3000",  # Your computer's IP
    ],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.middleware("http")
async def add_cors_headers_to_error(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        # If an error occurs, create a JSON response
        response = JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )
    
    # Add CORS headers to all responses including errors
    origin = request.headers.get("origin", "http://localhost:3000")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRF-Token"
    
    return response
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
        
        # Debug log
        logger.info(f"Chat request received with include_reasoning: {data.get('include_reasoning', False)}")
        
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
                "attached_images": data.get("attached_images", []),
                "include_reasoning": data.get("include_reasoning", True)  # Pass along reasoning flag
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
            
            # Debug logging
            logger.info(f"LLM response received with keys: {list(result.keys())}")
            logger.info(f"Response has reasoning: {bool(result.get('reasoning'))}")
            if result.get('reasoning'):
                logger.info(f"Reasoning preview: {result.get('reasoning', '')[:100]}...")
                logger.info(f"Is reasoning same as message: {result.get('reasoning') == result.get('message')}")
            
            # Store assistant response with metadata
            metadata = {
                "tools_used": result.get("tools_used", []),
                "image_urls": result.get("image_urls", [])
            }
            
            # Add reasoning to metadata if available
            if result.get("reasoning"):
                metadata["reasoning"] = result.get("reasoning")
                metadata["reasoning_title"] = result.get("reasoning_title", "Reasoning Completed")
            
            # Log metadata
            logger.info(f"Storing assistant message with metadata keys: {list(metadata.keys())}")
            
            await client.post(
                f"{SERVICE_MAP['conversation']}/update",
                json={
                    "thread_id": thread_id,
                    "assistant_message": result.get("message", ""),
                    "metadata": metadata
                }
            )
            
            # Return the full result including reasoning
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
async def text_to_speech_endpoint(request: Request):
    """Forward text-to-speech requests to multimedia service"""
    try:
        # Parse the request body manually
        data = await request.json()
        text = data.get("text", "")
        voice = data.get("voice", "alloy")
        
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{SERVICE_MAP['multimedia']}/text-to-speech",
                json={"text": text, "voice": voice}
            )
            
            content = response.content
            status_code = response.status_code
            media_type = response.headers.get("content-type", "application/json")
    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        content = json.dumps({"error": str(e)}).encode()
        status_code = 500
        media_type = "application/json"
    
    # Create response with proper CORS headers
    resp = Response(
        content=content,
        status_code=status_code,
        media_type=media_type
    )
    
    # Add CORS headers directly to this response
    origin = request.headers.get("origin", "http://localhost:3000") 
    resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    
    return resp

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

@app.get("/api/auth/test")
async def auth_test():
    """Test connection to auth service"""
    auth_url = f"{SERVICE_MAP['auth']}/test"
    logger.info(f"Testing auth service at: {auth_url}")
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(auth_url)
            logger.info(f"Auth service test response: {response.status_code}")
            return response.json()
    except Exception as e:
        logger.error(f"Error connecting to auth service: {str(e)}")
        return {
            "status": "error", 
            "message": f"Could not connect to auth service: {str(e)}",
            "auth_url": auth_url
        }

@app.get("/api/auth/csrf-token")
async def get_csrf_token(response: Response):
    """Get CSRF token from auth service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Make sure this is sending to the correct endpoint
            auth_response = await client.get(f"{SERVICE_MAP['auth']}/csrf-token")
            
            # Debug output
            print(f"Auth service response headers: {auth_response.headers}")
            print(f"Auth service response status: {auth_response.status_code}")
            print(f"Auth service response body: {auth_response.text}")
            
            # Copy cookies from auth service response
            for header, value in auth_response.headers.items():
                if header.lower() == 'set-cookie':
                    response.headers[header] = value
                    print(f"Setting cookie header: {value}")
            
            # Return the token
            if auth_response.status_code == 200:
                data = auth_response.json()
                print(f"Returning CSRF token: {data.get('token')}")
                return data
            else:
                return {"token": "fallback-csrf-token", "error": f"Auth service returned {auth_response.status_code}"}
                
    except Exception as e:
        logger.error(f"Error getting CSRF token: {str(e)}")
        return {"token": "fallback-csrf-token", "error": str(e)}

@app.post("/api/auth/register")
async def auth_register(request: Request):
    """Forward registration requests to auth service"""
    try:
        # Get the raw body bytes
        body_bytes = await request.body()
        
        # Forward all headers, including CSRF token
        headers = dict(request.headers)
        
        # Forward to auth service
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            logger.info(f"Forwarding registration request to auth service")
            
            response = await client.post(
                f"{SERVICE_MAP['auth']}/register",
                content=body_bytes,  # Use raw bytes
                headers=headers,
                cookies=request.cookies
            )
            
            logger.info(f"Auth service response: {response.status_code}")
            
            # Return the response as-is
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json")
            )
    except Exception as e:
        logger.error(f"Auth register error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error processing registration request: {str(e)}"}
        )

@app.post("/api/auth/login")
async def auth_login(request: Request):
    """Forward login requests to auth service with proper formatting"""
    try:
        # Get form data
        form_data = await request.form()
        
        # Extract username and password
        username = form_data.get("username", "")
        password = form_data.get("password", "")
        
        logger.info(f"Login attempt for user: {username}")
        
        # Create payload to send to auth service
        login_data = {
            "username": username,
            "password": password
        }
        
        # Forward request to auth service
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{SERVICE_MAP['auth']}/login",
                data=login_data,  # Send as form data, not JSON
                cookies=request.cookies,
                headers={"X-CSRF-Token": request.headers.get("X-CSRF-Token", "")}
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
            content={"detail": f"Error processing authentication request: {str(e)}"}
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
    
@app.post("/api/auth/client-logout")
async def client_logout(request: Request):
    """Special endpoint for client-side logout that doesn't require authentication"""
    try:
        data = await request.json()
        
        # Try to revoke the token server-side but don't require success
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{SERVICE_MAP['auth']}/logout",
                    json=data
                )
        except Exception as e:
            logger.error(f"Error forwarding logout: {str(e)}")
            # Ignore errors from auth service
            pass
            
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Logged out successfully"}
        )
    except Exception as e:
        # Always return success
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Logged out successfully"}
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
    
    # Add debug logging
    logger.info(f"Request path: {request.url.path}")
    logger.info(f"Request headers: {request.headers}")
    
    # Check for auth header
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        # Debug log
        logger.error(f"Missing or invalid auth header: {auth_header}")
        
        # If it's OPTIONS request (preflight), let it pass
        if request.method == "OPTIONS":
            return await call_next(request)
        
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid authorization header"}
        )
    
    # Validate token with auth service
    try:
        logger.info(f"Validating token: {auth_header[:20]}...")
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{SERVICE_MAP['auth']}/me",
                headers={"Authorization": auth_header}
            )
            
            if response.status_code != 200:
                logger.error(f"Token validation failed: {response.status_code}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"}
                )
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        # Continue if auth service is unreachable
    
    # Continue with the request
    return await call_next(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)