# backend/auth_service/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Request, Response, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
import logging
import os
from datetime import datetime, timedelta
import uuid
from pydantic import BaseModel, EmailStr, Field
import secrets

# Import security modules
from security.middleware import (
    SecurityMiddleware,
    generate_csrf_token,
    create_access_token,
    create_refresh_token
)

# Import database modules
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Redis
import redis.asyncio as redis

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Authentication Service")

public_router = APIRouter()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGO_DB", "ragassistant")
USERS_COLLECTION = "users"
TOKENS_COLLECTION = "refresh_tokens"

# Redis connection
REDIS_URI = os.getenv("REDIS_URI", "redis://redis:6379/0")
redis_client = None

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# CORS configuration - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Add after your middleware setup
app.include_router(public_router)
# Auth models
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class TokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class CSRFResponse(BaseModel):
    token: str

class StatusResponse(BaseModel):
    status: str
    message: str

# Database and redis connection
@app.on_event("startup")
async def startup_event():
    global mongo_client, db, users_collection, tokens_collection, redis_client
    try:
        # Connect to MongoDB
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[DB_NAME]
        users_collection = db[USERS_COLLECTION]
        tokens_collection = db[TOKENS_COLLECTION]
        
        # Create indexes
        await users_collection.create_index("email", unique=True)
        await tokens_collection.create_index("user_id")
        await tokens_collection.create_index("expires_at", expireAfterSeconds=0)
        
        # Connect to Redis
        redis_client = redis.Redis.from_url(REDIS_URI)
        await redis_client.ping()
        
        logger.info("Connected to MongoDB and Redis")
        
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise e

@app.on_event("shutdown")
async def shutdown_event():
    if mongo_client:
        mongo_client.close()
    if redis_client:
        await redis_client.close()
    logger.info("Closed database connections")

# Add security middleware
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Initialize middleware with the redis client
    middleware = SecurityMiddleware(redis_client)
    return await middleware(request, call_next)

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    return await users_collection.find_one({"email": email})

async def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    user = await get_user_by_email(email)
    if not user:
        # Use constant-time comparison to prevent timing attacks
        pwd_context.verify("dummy_password", get_password_hash("dummy_password"))
        return None
        
    if not verify_password(password, user["password"]):
        return None
        
    return user

# Store refresh token in Redis & MongoDB
async def store_refresh_token(user_id: str, token: str, jti: str) -> None:
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    # Store in MongoDB (for lookups)
    await tokens_collection.insert_one({
        "token": token,
        "jti": jti,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at
    })
    
    # Store in Redis (for fast validation)
    redis_key = f"refresh:{jti}"
    await redis_client.set(
        redis_key,
        user_id,
        ex=7 * 24 * 60 * 60  # 7 days in seconds
    )

# Revoke token
async def revoke_token(jti: str) -> None:
    # Add to revoked tokens set
    revoke_key = f"revoked:{jti}"
    await redis_client.set(
        revoke_key,
        "1",
        ex=24 * 60 * 60  # Store for 24 hours
    )
    
    # Remove from active tokens
    await tokens_collection.delete_one({"jti": jti})

# Format user response (remove password)
def format_user_response(user: Dict[str, Any]) -> Dict[str, Any]:
    # Create safe user object without password
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"]
    }

# Routes
@app.get("/health")
async def health_check():
    try:
        # Check MongoDB
        await db.command("ping")
        
        # Check Redis
        redis_ping = await redis_client.ping()
        
        return {
            "status": "healthy" if redis_ping else "unhealthy",
            "service": "auth",
            "database": "connected",
            "redis": "connected" if redis_ping else "error"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "auth",
            "error": str(e)
        }

# Move the CSRF endpoint to the public router
@app.get("/csrf-token", response_model=CSRFResponse)
async def get_csrf_token(response: Response):
    """Get a new CSRF token"""
    logger.info("CSRF token endpoint called")
    
    # Generate token
    token = generate_csrf_token()
    logger.info("Generated CSRF token")
    
    # Set CSRF token as a cookie (HTTP only for security)
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600  # 1 hour
    )
    logger.info("Set CSRF cookie")
    
    return {"token": token}

@app.get("/test")
async def test_endpoint():
    """Simple test endpoint to check if the service is responsive"""
    logger.info("Test endpoint called")
    return {"status": "ok", "message": "Auth service is running"}

@app.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if user already exists
    existing_user = await get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user with secure password
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    now = datetime.utcnow()
    
    new_user = {
        "_id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": now,
        "updated_at": now,
        "last_login": None
    }
    
    await users_collection.insert_one(new_user)
    
    # Create tokens
    access_token = create_access_token(
        subject=user_data.email,
        user_id=user_id
    )
    
    refresh_token = create_refresh_token(
        subject=user_data.email,
        user_id=user_id
    )
    
    # Store refresh token
    token_jti = refresh_token.split(".")[1]  # Extract JTI from token
    await store_refresh_token(user_id, refresh_token, token_jti)
    
    # Format user response
    user_response = format_user_response(new_user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login with email and password"""
    # Log attempt (use the form_data that FastAPI already parsed)
    logger.info(f"Login attempt for: {form_data.username}")
    
    # Authenticate user
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token = create_access_token(
        subject=user["email"],
        user_id=str(user["_id"])
    )
    
    refresh_token = create_refresh_token(
        subject=user["email"],
        user_id=str(user["_id"])
    )
    
    # Store refresh token
    token_jti = refresh_token.split(".")[1]  # Extract JTI from token
    await store_refresh_token(str(user["_id"]), refresh_token, token_jti)
    
    # Format user response
    user_response = format_user_response(user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/refresh", response_model=TokenResponse)
async def refresh(token_data: TokenRequest):
    """Refresh access token with refresh token"""
    # Verify refresh token
    try:
        # Token validation here (implemented in middleware)
        # This is simplified for example purposes
        
        # Get refresh token from database
        token_record = await tokens_collection.find_one({
            "token": token_data.refresh_token
        })
        
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        user_id = token_record["user_id"]
        
        # Get user data
        user = await users_collection.find_one({"_id": user_id})
        if not user:
            # Token refers to deleted user
            await tokens_collection.delete_many({"user_id": user_id})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Generate new access token
        access_token = create_access_token(
            subject=user["email"],
            user_id=user_id
        )
        
        # Generate new refresh token (token rotation for security)
        new_refresh_token = create_refresh_token(
            subject=user["email"],
            user_id=user_id
        )
        
        # Revoke old refresh token
        old_jti = token_record["jti"]
        await revoke_token(old_jti)
        
        # Store new refresh token
        token_jti = new_refresh_token.split(".")[1]
        await store_refresh_token(user_id, new_refresh_token, token_jti)
        
        # Format user response
        user_response = format_user_response(user)
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": user_response
        }
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

@app.post("/logout", response_model=StatusResponse)
async def logout(token_data: TokenRequest):
    """Logout user by revoking refresh token"""
    try:
        # Find token in database
        token_record = await tokens_collection.find_one({
            "token": token_data.refresh_token
        })
        
        if token_record:
            # Revoke the token
            await revoke_token(token_record["jti"])
        
        return {
            "status": "success",
            "message": "Logged out successfully"
        }
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return {
            "status": "success",  # Always return success for security
            "message": "Logged out successfully"
        }

@app.get("/me")
async def get_current_user(request: Request):
    """Get current user profile from JWT token"""
    # User data is added to request state by middleware
    user = request.state.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Get full user data from database
    user_id = user.get("user_id")
    user_data = await users_collection.find_one({"_id": user_id})
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Return formatted user data
    return {"user": format_user_response(user_data)}

@app.post("/request-reset", response_model=StatusResponse)
async def request_password_reset(request: PasswordResetRequest):
    """Request password reset email"""
    # Find user by email
    user = await get_user_by_email(request.email)
    
    # Always return success even if email doesn't exist (security)
    if not user:
        return {
            "status": "success",
            "message": "If an account with this email exists, a password reset link has been sent."
        }
    
    # Generate reset token (expires in 1 hour)
    reset_token = str(uuid.uuid4())
    reset_token_hash = pwd_context.hash(reset_token)
    
    # Store reset token in database
    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "reset_token": reset_token_hash,
                "reset_token_expiry": datetime.utcnow() + timedelta(hours=1)
            }
        }
    )
    
    # In a real implementation, send email with reset link
    # Example: reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    logger.info(f"Password reset requested for {request.email}")
    
    return {
        "status": "success",
        "message": "If an account with this email exists, a password reset link has been sent."
    }

@app.post("/reset-password", response_model=StatusResponse)
async def reset_password(request: PasswordReset):
    """Reset password with token"""
    # Find user with unexpired reset token
    users = db[USERS_COLLECTION]
    cursor = users.find({
        "reset_token_expiry": {"$gt": datetime.utcnow()}
    })
    
    # Check each user's reset token
    user = None
    async for doc in cursor:
        # Verify token against stored hash
        if pwd_context.verify(request.token, doc.get("reset_token", "")):
            user = doc
            break
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password
    hashed_password = get_password_hash(request.new_password)
    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hashed_password,
                "updated_at": datetime.utcnow(),
                "reset_token": None,
                "reset_token_expiry": None
            }
        }
    )
    
    # Revoke all refresh tokens for security
    await tokens_collection.delete_many({"user_id": str(user["_id"])})
    
    return {
        "status": "success",
        "message": "Password reset successfully"
    }

@app.put("/update-password", response_model=StatusResponse)
async def update_password(request: Request, data: UserUpdatePassword):
    """Update user password"""
    # Get user from request state (added by middleware)
    auth_user = request.state.user
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user_id = auth_user.get("user_id")
    
    # Get user from database
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not verify_password(data.current_password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    hashed_password = get_password_hash(data.new_password)
    await users_collection.update_one(
        {"_id": user_id},
        {
            "$set": {
                "password": hashed_password,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Revoke all refresh tokens for security
    await tokens_collection.delete_many({"user_id": user_id})
    
    return {
        "status": "success",
        "message": "Password updated successfully"
    }

@app.put("/update-profile", response_model=Dict[str, Any])
async def update_profile(request: Request, data: UserUpdate):
    """Update user profile"""
    # Get user from request state (added by middleware)
    auth_user = request.state.user
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    user_id = auth_user.get("user_id")
    
    # Get user from database
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prepare update data
    update_data = {"updated_at": datetime.utcnow()}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        # Check if email already exists
        if data.email != user["email"]:
            existing = await get_user_by_email(data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already in use"
                )
        update_data["email"] = data.email
    
    # Update user
    await users_collection.update_one(
        {"_id": user_id},
        {"$set": update_data}
    )
    
    # Get updated user
    updated_user = await users_collection.find_one({"_id": user_id})
    
    return {"user": format_user_response(updated_user)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)