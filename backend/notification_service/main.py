from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import aiohttp
import redis.asyncio as redis
import os
import logging
from datetime import datetime
import re
import urllib.parse

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Notification Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Twilio API settings
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
TWIML_URL = os.getenv("TWIML_URL")

# Redis connection
REDIS_URI = os.getenv("REDIS_URI", "redis://redis:6379/3")
redis_client = None

# Rate limiting settings
MAX_SMS_PER_DAY = int(os.getenv("MAX_SMS_PER_DAY", "50"))
MAX_CALLS_PER_DAY = int(os.getenv("MAX_CALLS_PER_DAY", "20"))
RECIPIENT_SMS_LIMIT = int(os.getenv("RECIPIENT_SMS_LIMIT", "5"))
RECIPIENT_CALL_LIMIT = int(os.getenv("RECIPIENT_CALL_LIMIT", "3"))

class SMSRequest(BaseModel):
    recipient: str
    message: str
    template_id: Optional[str] = None

class CallRequest(BaseModel):
    recipient: str
    message: Optional[str] = None
    template_id: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    global redis_client
    try:
        redis_client = redis.Redis.from_url(REDIS_URI)
        await redis_client.ping()
        logger.info("Connected to Redis")
        
        # Initialize rate limit counters
        today = datetime.now().strftime('%Y-%m-%d')
        if not await redis_client.exists(f"sms_count:{today}"):
            await redis_client.set(f"sms_count:{today}", "0", ex=86400)
        
        if not await redis_client.exists(f"call_count:{today}"):
            await redis_client.set(f"call_count:{today}", "0", ex=86400)
            
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
    
    # Check Twilio credentials
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        status["twilio"] = "configured"
    else:
        status["twilio"] = "missing_credentials"
    
    # Add rate limit info
    try:
        if redis_client:
            today = datetime.now().strftime('%Y-%m-%d')
            sms_count = await redis_client.get(f"sms_count:{today}")
            call_count = await redis_client.get(f"call_count:{today}")
            
            status["rate_limits"] = {
                "sms": {
                    "used": int(sms_count) if sms_count else 0,
                    "limit": MAX_SMS_PER_DAY
                },
                "calls": {
                    "used": int(call_count) if call_count else 0,
                    "limit": MAX_CALLS_PER_DAY
                }
            }
    except Exception:
        status["rate_limits"] = "error"
    
    overall_health = all(v in ["connected", "configured"] for k, v in status.items() if k not in ["rate_limits"])
    
    return {
        "status": "healthy" if overall_health else "unhealthy",
        "service": "notification",
        "details": status
    }

def format_phone_number(phone_number: str) -> str:
    """Format phone numbers to E.164 format for Twilio"""
    # Remove any spaces, dashes, parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone_number)
    
    # Handle UK mobile numbers (07xxx)
    if cleaned.startswith('07') and len(cleaned) == 11:
        return '+44' + cleaned[1:]  # Convert 07xxx to +447xxx
        
    # Handle numbers with international prefix
    if cleaned.startswith('+'):
        return cleaned
        
    # Handle numbers with 00 international prefix
    if cleaned.startswith('00'):
        return '+' + cleaned[2:]
        
    # If number doesn't have a country code, assume it's UK
    if len(cleaned) == 10 or len(cleaned) == 11:
        # Remove leading 0 if present
        if cleaned.startswith('0'):
            cleaned = cleaned[1:]
        return f'+44{cleaned}'
        
    # If all else fails, just add + at the beginning
    return f'+{cleaned}'

async def check_sms_rate_limit(recipient: str) -> bool:
    """Check if SMS rate limit is exceeded"""
    if not redis_client:
        return True  # Proceed if Redis is not available
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Check global limit
    global_key = f"sms_count:{today}"
    global_count = await redis_client.get(global_key)
    global_count = int(global_count) if global_count else 0
    
    if global_count >= MAX_SMS_PER_DAY:
        logger.warning(f"Global SMS limit exceeded: {global_count}/{MAX_SMS_PER_DAY}")
        return False
    
    # Check recipient limit
    recipient_key = f"sms_recipient:{recipient}:{today}"
    recipient_count = await redis_client.get(recipient_key)
    recipient_count = int(recipient_count) if recipient_count else 0
    
    if recipient_count >= RECIPIENT_SMS_LIMIT:
        logger.warning(f"Recipient SMS limit exceeded for {recipient}: {recipient_count}/{RECIPIENT_SMS_LIMIT}")
        return False
    
    # Increment counters
    await redis_client.incr(global_key)
    if not await redis_client.ttl(global_key) > 0:
        await redis_client.expire(global_key, 86400)  # 24 hours
    
    await redis_client.incr(recipient_key)
    if not await redis_client.ttl(recipient_key) > 0:
        await redis_client.expire(recipient_key, 86400)  # 24 hours
    
    return True

async def check_call_rate_limit(recipient: str) -> bool:
    """Check if call rate limit is exceeded"""
    if not redis_client:
        return True  # Proceed if Redis is not available
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Check global limit
    global_key = f"call_count:{today}"
    global_count = await redis_client.get(global_key)
    global_count = int(global_count) if global_count else 0
    
    if global_count >= MAX_CALLS_PER_DAY:
        logger.warning(f"Global call limit exceeded: {global_count}/{MAX_CALLS_PER_DAY}")
        return False
    
    # Check recipient limit
    recipient_key = f"call_recipient:{recipient}:{today}"
    recipient_count = await redis_client.get(recipient_key)
    recipient_count = int(recipient_count) if recipient_count else 0
    
    if recipient_count >= RECIPIENT_CALL_LIMIT:
        logger.warning(f"Recipient call limit exceeded for {recipient}: {recipient_count}/{RECIPIENT_CALL_LIMIT}")
        return False
    
    # Increment counters
    await redis_client.incr(global_key)
    if not await redis_client.ttl(global_key) > 0:
        await redis_client.expire(global_key, 86400)  # 24 hours
    
    await redis_client.incr(recipient_key)
    if not await redis_client.ttl(recipient_key) > 0:
        await redis_client.expire(recipient_key, 86400)  # 24 hours
    
    return True

@app.post("/send-sms")
async def send_sms(request: SMSRequest):
    """Send SMS via Twilio API"""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")
    
    # Format phone number
    formatted_recipient = format_phone_number(request.recipient)
    
    # Check rate limit
    if not await check_sms_rate_limit(formatted_recipient):
        raise HTTPException(status_code=429, detail="SMS rate limit exceeded")
    
    try:
        # Call Twilio API
        auth = aiohttp.BasicAuth(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        
        # Prepare form data
        form_data = {
            "To": formatted_recipient,
            "From": TWILIO_PHONE_NUMBER,
            "Body": request.message
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                twilio_url,
                auth=auth,
                data=form_data
            ) as response:
                result = await response.json()
                
                if response.status < 200 or response.status >= 300:
                    error_message = result.get("message", "Unknown error")
                    logger.error(f"Twilio API error: {error_message}")
                    raise HTTPException(status_code=response.status, detail=f"Twilio API error: {error_message}")
        
        return {
            "sid": result.get("sid"),
            "recipient": formatted_recipient,
            "status": "sent",
            "message": f"SMS sent to {formatted_recipient}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending SMS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending SMS: {str(e)}")

@app.post("/make-call")
async def make_call(request: CallRequest):
    """Make a phone call via Twilio API"""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")
    
    if not TWIML_URL:
        raise HTTPException(status_code=500, detail="TwiML URL not configured")
    
    # Format phone number
    formatted_recipient = format_phone_number(request.recipient)
    
    # Check rate limit
    if not await check_call_rate_limit(formatted_recipient):
        raise HTTPException(status_code=429, detail="Call rate limit exceeded")
    
    try:
        # Call Twilio API
        auth = aiohttp.BasicAuth(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Calls.json"
        
        # Prepare TwiML URL with message parameter if provided
        twiml_url = TWIML_URL
        if request.message:
            encoded_message = urllib.parse.quote(request.message)
            if "?" in twiml_url:
                twiml_url = f"{twiml_url}&message={encoded_message}"
            else:
                twiml_url = f"{twiml_url}?message={encoded_message}"
        
        # Prepare form data
        form_data = {
            "To": formatted_recipient,
            "From": TWILIO_PHONE_NUMBER,
            "Url": twiml_url
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                twilio_url,
                auth=auth,
                data=form_data
            ) as response:
                result = await response.json()
                
                if response.status < 200 or response.status >= 300:
                    error_message = result.get("message", "Unknown error")
                    logger.error(f"Twilio API error: {error_message}")
                    raise HTTPException(status_code=response.status, detail=f"Twilio API error: {error_message}")
        
        return {
            "sid": result.get("sid"),
            "recipient": formatted_recipient,
            "status": "initiated",
            "message": f"Call initiated to {formatted_recipient}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making call: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error making call: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)