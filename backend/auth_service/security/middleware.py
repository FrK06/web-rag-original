# backend/auth_service/security/middleware.py
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Dict, Optional, Any
import time
import secrets
import hashlib
import os
from redis.asyncio import Redis
import logging
from datetime import datetime, timedelta

# Setup logging
logger = logging.getLogger(__name__)

# Security configuration from environment variables
SECRET_KEY = os.getenv("JWT_SECRET", "fallback-secret-only-for-development")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # minutes
REFRESH_TOKEN_EXPIRE = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))    # days
CSRF_SECRET = os.getenv("CSRF_SECRET", "fallback-csrf-secret-only-for-development") 

# Rate limiting configuration
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "900"))  # 15 minutes in seconds
LOGIN_RATE_LIMIT = int(os.getenv("LOGIN_RATE_LIMIT", "5"))              # 5 attempts per window
REGISTER_RATE_LIMIT = int(os.getenv("REGISTER_RATE_LIMIT", "3"))        # 3 attempts per window
API_RATE_LIMIT = int(os.getenv("API_RATE_LIMIT", "100"))                # 100 API calls per window
IP_BLOCK_THRESHOLD = int(os.getenv("IP_BLOCK_THRESHOLD", "10"))         # Block IP after 10 failed attempts

# Bearer token extractor
bearer_scheme = HTTPBearer(auto_error=False)

class SecurityMiddleware:
    """Security middleware with CSRF, rate limiting, and token validation"""
    
    def __init__(self, redis_client=None):
        """Initialize the middleware with the Redis client
        
        Args:
            redis_client: Redis client for caching and rate limiting
        """
        self.redis = redis_client
        '''
    async def __call__(self, request: Request, call_next):
        """Main middleware handler"""
        # TEMPORARY DEVELOPMENT BYPASS
        # Skip all security middleware for testing
        logger.warning("⚠️ Security middleware bypassed for development")
        response = await call_next(request)
        return response
       '''
    
    async def __call__(self, request: Request, call_next):
        """Main middleware handler"""
        start_time = time.time()
        
        # Skip CSRF check for certain paths
        skip_csrf = request.url.path in [
            "/health",
            "/api/health",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/csrf-token",
            "/csrf-token",  # Add this line
            "/test"  # For health check route
        ]
        
        # Skip auth check for certain paths
        skip_auth = request.url.path in [
            "/health",
            "/api/health",
            "/api/auth/login", 
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/csrf-token",
            "/api/auth/request-reset",
            "/api/auth/reset-password",
            "/csrf-token",
            "/login",  # Add this line
            "/register",  # Add this too for consistency  # Add this line
            "/test"  # For health check route
        ]
        
        # Rate limiting paths
        rate_limit_paths = {
            "/api/auth/login": LOGIN_RATE_LIMIT,
            "/api/auth/register": REGISTER_RATE_LIMIT,
            "/api/auth/request-reset": LOGIN_RATE_LIMIT
        }
        
        try:
            # Rate limiting check
            if self.redis and request.url.path in rate_limit_paths:
                rate_limit = rate_limit_paths[request.url.path]
                if not await self._check_rate_limit(request, rate_limit):
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Rate limit exceeded. Please try again later."}
                    )
            
            # CSRF protection for state-changing operations
            if not skip_csrf and request.method in ["POST", "PUT", "PATCH", "DELETE"]:
                csrf_valid = await self._validate_csrf_token(request)
                if not csrf_valid:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "CSRF token missing or invalid"}
                    )
            
            # Token validation for protected routes
            if not skip_auth:
                user = await self._validate_token(request)
                if not user:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={"detail": "Not authenticated"},
                        headers={"WWW-Authenticate": "Bearer"}
                    )
                # Add user to request state for route handlers
                request.state.user = user
            
            # Continue with the request
            response = await call_next(request)
            
            # Add security headers to all responses
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            
            # Add Server-Timing header only in development
            if os.getenv("ENVIRONMENT", "production").lower() != "production":
                process_time = time.time() - start_time
                response.headers["Server-Timing"] = f"total;dur={process_time * 1000:.2f}"
            
            return response
            
        except Exception as e:
            logger.error(f"Security middleware error: {str(e)}")
            # In production, don't expose error details
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"}
            )
        
    async def _check_rate_limit(self, request: Request, limit: int) -> bool:
        """Check if the request exceeds rate limits"""
        if not self.redis:
            # If Redis is unavailable, allow the request but log a warning
            logger.warning("Redis unavailable, rate limiting disabled")
            return True
            
        try:
            client_ip = self._get_client_ip(request)
            path = request.url.path
            
            # Create a rate limit key with IP and path
            rate_key = f"rate:{client_ip}:{path}"
            
            # Check if IP is blocked
            block_key = f"block:{client_ip}"
            try:
                is_blocked = await self.redis.get(block_key)
                if is_blocked:
                    logger.warning(f"Blocked IP attempt: {client_ip}")
                    return False
            except Exception as e:
                logger.error(f"Error checking IP block status: {str(e)}")
                # Continue with rate limiting even if block check fails
                
            # Count request in current window
            try:
                count = await self.redis.get(rate_key)
                count = int(count) if count else 0
                
                if count >= limit:
                    logger.warning(f"Rate limit exceeded for {client_ip} on {path}: {count}/{limit}")
                    
                    # Check for failed login attempts
                    if path == "/api/auth/login" and count >= IP_BLOCK_THRESHOLD:
                        # Block IP temporarily
                        try:
                            await self.redis.set(block_key, "1", ex=RATE_LIMIT_WINDOW)
                            logger.warning(f"IP blocked due to excessive attempts: {client_ip}")
                        except Exception as e:
                            logger.error(f"Error blocking IP: {str(e)}")
                    
                    return False
                    
                # Increment counter 
                if count == 0:
                    # First request in this window - set with expiry
                    await self.redis.set(rate_key, "1", ex=RATE_LIMIT_WINDOW)
                else:
                    # Increment existing counter
                    await self.redis.incr(rate_key)
                    # Ensure expiry is set (in case it was lost)
                    await self.redis.expire(rate_key, RATE_LIMIT_WINDOW)
            except Exception as e:
                logger.error(f"Error updating rate limit counter: {str(e)}")
                # Allow the request if rate limit check fails
                
            return True
        except Exception as e:
            logger.error(f"Rate limiting error: {str(e)}")
            # If there's an error, allow the request but log it
            return True
        
    async def _validate_csrf_token(self, request: Request) -> bool:
        """Validate CSRF token using Double Submit Cookie pattern"""
        try:
            # Get token from header and cookie
            header_token = request.headers.get("X-CSRF-Token")
            cookie_token = request.cookies.get("csrf_token")
            
            logger.info(f"CSRF validation: header={header_token}, cookie={cookie_token}")
            
            if not header_token:
                logger.warning("CSRF token missing from header")
                return False
                
            if not cookie_token:
                logger.warning("CSRF token missing from cookie")
                return False
                
            # Simple comparison for CSRF tokens
            if header_token != cookie_token:
                logger.warning(f"CSRF token mismatch: header={header_token}, cookie={cookie_token}")
                return False
                
            logger.info("CSRF token valid")
            return True
        except Exception as e:
            logger.error(f"CSRF validation error: {str(e)}")
            # If there's an error, fail closed (safer)
            return False
        
    async def _validate_token(self, request: Request) -> Optional[Dict[str, Any]]:
        """Validate JWT and check if it's been revoked"""
        try:
            # Extract token from header
            credentials: HTTPAuthorizationCredentials = await bearer_scheme(request)
            if not credentials:
                return None
                
            token = credentials.credentials
            
            try:
                # Decode token
                payload = jwt.decode(
                    token, 
                    SECRET_KEY, 
                    algorithms=[ALGORITHM]
                )
                
                # Check token type
                if payload.get("type") != "access":
                    logger.warning("Invalid token type used")
                    return None
                    
                # Get token unique ID
                jti = payload.get("jti")
                if not jti:
                    logger.warning("Token missing JTI")
                    return None
                    
                # Check if token has been revoked if Redis is available
                if self.redis:
                    try:
                        revoked_key = f"revoked:{jti}"
                        is_revoked = await self.redis.get(revoked_key)
                        if is_revoked:
                            logger.warning(f"Revoked token used: {jti}")
                            return None
                    except Exception as e:
                        logger.error(f"Error checking token revocation: {str(e)}")
                        # Continue validation even if revocation check fails
                    
                return payload
                
            except JWTError as e:
                logger.warning(f"JWT validation error: {str(e)}")
                return None
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return None
            
    def _get_client_ip(self, request: Request) -> str:
        """Get the client IP, accounting for proxies"""
        try:
            # Check for X-Forwarded-For header
            x_forwarded_for = request.headers.get("X-Forwarded-For")
            if x_forwarded_for:
                # Get the first IP in the chain
                ip = x_forwarded_for.split(",")[0].strip()
            else:
                # Fallback to direct client
                ip = request.client.host
                
            return ip
        except Exception as e:
            logger.error(f"Error getting client IP: {str(e)}")
            # Return a placeholder IP if there's an error
            return "0.0.0.0"
        
# Generate CSRF token
def generate_csrf_token() -> str:
    """Generate a secure CSRF token"""
    token = secrets.token_hex(32)
    # In a production implementation, sign this token with a server secret
    # token_signature = hmac.new(CSRF_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()
    # return f"{token}.{token_signature}"
    return token

# Create JWT tokens
def create_access_token(subject: str, user_id: str) -> str:
    """Create a new access token"""
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    expire = datetime.utcnow() + expires_delta
    
    # Create unique token ID
    jti = hashlib.sha256(f"{subject}:{secrets.token_hex(8)}:{time.time()}".encode()).hexdigest()
    
    to_encode = {
        "sub": subject,  # Usually email
        "jti": jti,  # Unique token ID for revocation
        "type": "access",  # Token type
        "user_id": user_id,  # User ID for lookups
        "exp": expire,
        "iat": datetime.utcnow()  # Issued at time
    }
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(subject: str, user_id: str) -> str:
    """Create a new refresh token"""
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE)
    expire = datetime.utcnow() + expires_delta
    
    # Create unique token ID
    jti = hashlib.sha256(f"{subject}:{secrets.token_hex(8)}:{time.time()}".encode()).hexdigest()
    
    to_encode = {
        "sub": subject,  # Usually email
        "jti": jti,  # Unique token ID for revocation
        "type": "refresh",  # Token type
        "user_id": user_id,  # User ID for lookups
        "exp": expire,
        "iat": datetime.utcnow()  # Issued at time
    }
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)