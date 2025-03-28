# backend/auth_service/main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import jwt
import secrets
from uuid import uuid4

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Authentication Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGO_DB", "ragassistant")
USERS_COLLECTION = "users"
TOKENS_COLLECTION = "refresh_tokens"

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token validation
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# MongoDB client - initialized during startup
mongo_client = None
db = None
users_collection = None
tokens_collection = None

# Models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class User(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: datetime
    updated_at: datetime

class TokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: User

class StatusResponse(BaseModel):
    status: str
    message: str

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    global mongo_client, db, users_collection, tokens_collection
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[DB_NAME]
        users_collection = db[USERS_COLLECTION]
        tokens_collection = db[TOKENS_COLLECTION]
        
        # Create indexes
        await users_collection.create_index("email", unique=True)
        await tokens_collection.create_index("user_id")
        await tokens_collection.create_index("expires_at", 
                                            expireAfterSeconds=0)  # TTL index
        
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        raise e

@app.on_event("shutdown")
async def shutdown_event():
    if mongo_client:
        mongo_client.close()
        logger.info("Closed MongoDB connection")

# Health check
@app.get("/health")
async def health_check():
    try:
        # Ping MongoDB
        await db.command("ping")
        return {"status": "healthy", "service": "auth", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "service": "auth", "error": str(e)}

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_user_by_email(email: str):
    user = await users_collection.find_one({"email": email})
    return user

async def authenticate_user(email: str, password: str):
    user = await get_user_by_email(email)
    if not user:
        return False
    if not verify_password(password, user["password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def create_refresh_token(user_id: str):
    # Create refresh token
    token = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Store in database
    await tokens_collection.insert_one({
        "token": token,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at
    })
    
    return token

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await users_collection.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    
    # Remove password from response
    user.pop("password", None)
    return user

# Auth endpoints
@app.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user_id = str(uuid4())
    hashed_password = get_password_hash(user_data.password)
    now = datetime.utcnow()
    
    new_user = {
        "_id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": now,
        "updated_at": now
    }
    
    await users_collection.insert_one(new_user)
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user_id}
    )
    
    # Create refresh token
    refresh_token = await create_refresh_token(user_id)
    
    # Format user object for response (removing password)
    user_response = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "created_at": now,
        "updated_at": now
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user["_id"]}
    )
    
    # Create refresh token
    refresh_token = await create_refresh_token(user["_id"])
    
    # Format user object for response (removing password)
    user_response = {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"]
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/refresh", response_model=TokenResponse)
async def refresh(token_data: TokenRequest):
    # Verify refresh token
    token_record = await tokens_collection.find_one({
        "token": token_data.refresh_token,
        "expires_at": {"$gt": datetime.utcnow()}  # Token is not expired
    })
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user_id = token_record["user_id"]
    
    # Get user from database
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        # If user was deleted but token exists
        await tokens_collection.delete_many({"user_id": user_id})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create new access token
    access_token = create_access_token(
        data={"sub": user_id}
    )
    
    # Create new refresh token and invalidate old one
    await tokens_collection.delete_one({"token": token_data.refresh_token})
    new_refresh_token = await create_refresh_token(user_id)
    
    # Format user object for response (removing password)
    user_response = {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"]
    }
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": user_response
    }

@app.post("/logout", response_model=StatusResponse)
async def logout(token_data: TokenRequest):
    # Delete refresh token
    await tokens_collection.delete_one({
        "token": token_data.refresh_token
    })
    
    return {
        "status": "success",
        "message": "Logged out successfully"
    }

@app.get("/me", response_model=User)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "created_at": current_user["created_at"],
        "updated_at": current_user["updated_at"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)