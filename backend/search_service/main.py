from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import aiohttp
import asyncio
import redis.asyncio as redis
import os
import json
import logging
from urllib.parse import urlparse
from datetime import datetime
import hashlib

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Search Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google Custom Search API settings
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

# Redis connection
REDIS_URI = os.getenv("REDIS_URI", "redis://redis:6379/1")
redis_client = None

# Rate limiting settings
DEFAULT_CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))  # 1 hour default cache
API_REQUEST_LIMIT = int(os.getenv("API_REQUEST_LIMIT", "100"))  # Daily API quota monitoring

# Scraping settings
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
SCRAPING_TIMEOUT = int(os.getenv("SCRAPING_TIMEOUT", "30"))
SCRAPING_RETRIES = int(os.getenv("SCRAPING_RETRIES", "2"))

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10
    recency_bias: Optional[bool] = True

class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None
    retry_count: Optional[int] = 2

@app.on_event("startup")
async def startup_event():
    global redis_client
    try:
        redis_client = redis.Redis.from_url(REDIS_URI)
        await redis_client.ping()
        logger.info("Connected to Redis")
        
        # Initialize API quota counter if needed
        quota_key = f"search_api_quota:{datetime.now().strftime('%Y-%m-%d')}"
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
    
    # Check Google API credentials
    if GOOGLE_API_KEY and GOOGLE_CSE_ID:
        status["google_api"] = "configured"
    else:
        status["google_api"] = "missing_credentials"
    
    # Add API quota info
    try:
        if redis_client:
            quota_key = f"search_api_quota:{datetime.now().strftime('%Y-%m-%d')}"
            quota_used = await redis_client.get(quota_key)
            status["api_quota_used"] = int(quota_used) if quota_used else 0
            status["api_quota_limit"] = API_REQUEST_LIMIT
    except Exception:
        status["api_quota"] = "error"
    
    overall_health = all(v in ["connected", "configured"] for k, v in status.items() if k not in ["api_quota_used", "api_quota_limit"])
    
    return {
        "status": "healthy" if overall_health else "unhealthy",
        "service": "search",
        "details": status
    }

@app.post("/search")
async def search_web(request: SearchRequest):
    """Perform web search with caching and rate limiting"""
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
        raise HTTPException(status_code=500, detail="Search API credentials not configured")
    
    # Create cache key based on query and results count
    cache_key = f"search:{hashlib.md5(request.query.encode()).hexdigest()}:{request.max_results}"
    
    # Check if cached response exists
    if redis_client:
        cached_result = await redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for query: {request.query}")
            return json.loads(cached_result)
    
    # Check API quota
    if redis_client:
        quota_key = f"search_api_quota:{datetime.now().strftime('%Y-%m-%d')}"
        quota_used = await redis_client.get(quota_key)
        quota_used = int(quota_used) if quota_used else 0
        
        if quota_used >= API_REQUEST_LIMIT:
            logger.warning(f"API quota exceeded. Used: {quota_used}/{API_REQUEST_LIMIT}")
            raise HTTPException(status_code=429, detail="API quota exceeded for today")
    
    # Prepare search parameters
    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CSE_ID,
        "q": request.query,
        "num": min(request.max_results, 10),  # Google limits to 10 per request
        "lr": "lang_en",
        "safe": "active"
    }
    
    # Add recency bias if requested
    if request.recency_bias:
        params["sort"] = "date:r:1y"  # Sort by date, published in the last year
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(GOOGLE_SEARCH_URL, params=params) as response:
                # Check rate limiting
                if response.status == 429:
                    raise HTTPException(status_code=429, detail="API rate limit exceeded")
                
                # Check other errors
                if response.status != 200:
                    response_text = await response.text()
                    raise HTTPException(status_code=response.status, detail=f"Search API error: {response_text}")
                
                # Update quota counter
                if redis_client:
                    await redis_client.incr(quota_key)
                
                # Process results
                data = await response.json()
                search_results = []
                
                if "items" in data:
                    for item in data["items"]:
                        result = {
                            "link": item.get("link"),
                            "title": item.get("title"),
                            "snippet": item.get("snippet"),
                            "source": urlparse(item.get("link")).netloc,
                            "date": item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time", "")
                        }
                        search_results.append(result)
                
                # Format and diversify results
                formatted_results = {
                    "query": request.query,
                    "results": await diversify_results(search_results, min(request.max_results, 5)),
                    "count": len(search_results),
                    "timestamp": datetime.now().isoformat()
                }
                
                # Cache results
                if redis_client and formatted_results["results"]:
                    await redis_client.set(
                        cache_key,
                        json.dumps(formatted_results),
                        ex=DEFAULT_CACHE_TTL
                    )
                
                return formatted_results
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

async def diversify_results(results: List[Dict[str, Any]], num_results: int) -> List[Dict[str, Any]]:
    """Select diverse results from different domains"""
    if len(results) <= num_results:
        return results
    
    # Group by domain
    domains = {}
    for result in results:
        domain = result.get("source", "unknown")
        if domain not in domains:
            domains[domain] = []
        domains[domain].append(result)
    
    # Select one result from each domain until we have enough
    selected = []
    domain_list = list(domains.keys())
    
    # First pass: take one from each domain
    for domain in domain_list:
        if len(selected) >= num_results:
            break
        selected.append(domains[domain][0])
    
    # Second pass if needed: take additional results
    if len(selected) < num_results:
        for domain in domain_list:
            if len(domains[domain]) > 1:
                for result in domains[domain][1:]:
                    if len(selected) >= num_results:
                        break
                    selected.append(result)
    
    return selected[:num_results]

@app.post("/scrape")
async def scrape_webpage(request: ScrapeRequest):
    """Scrape content from a webpage with caching"""
    # Create cache key based on URL and selector
    cache_key = f"scrape:{hashlib.md5(request.url.encode()).hexdigest()}"
    if request.selector:
        cache_key += f":{hashlib.md5(request.selector.encode()).hexdigest()}"
    
    # Check if cached response exists
    if redis_client:
        cached_result = await redis_client.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for URL: {request.url}")
            return json.loads(cached_result)
    
    # Function to attempt scraping with retry logic
    async def attempt_scrape():
        for attempt in range(request.retry_count + 1):
            try:
                timeout = aiohttp.ClientTimeout(total=SCRAPING_TIMEOUT)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    headers = {
                        "User-Agent": USER_AGENT,
                        "Accept": "text/html,application/xhtml+xml,application/xml",
                        "Accept-Language": "en-US,en;q=0.9"
                    }
                    
                    async with session.get(request.url, headers=headers) as response:
                        if response.status != 200:
                            logger.warning(f"HTTP {response.status} when scraping {request.url}")
                            return {
                                "success": False,
                                "url": request.url,
                                "error": f"HTTP error: {response.status}",
                                "content": ""
                            }
                        
                        html = await response.text()
                        
                        # Basic content extraction - just get the text
                        # In a real implementation, you'd use BeautifulSoup or similar
                        # This is a simplified version
                        import re
                        
                        # Strip HTML tags
                        text = re.sub(r'<[^>]+>', ' ', html)
                        # Normalize whitespace
                        text = re.sub(r'\s+', ' ', text).strip()
                        
                        if len(text) < 100:
                            if attempt < request.retry_count:
                                logger.warning(f"Content too short, retrying: {request.url}")
                                await asyncio.sleep(1)  # Wait before retry
                                continue
                        
                        return {
                            "success": True,
                            "url": request.url,
                            "content": text[:10000],  # Limit content size
                            "content_length": len(text),
                            "timestamp": datetime.now().isoformat()
                        }
            
            except asyncio.TimeoutError:
                if attempt < request.retry_count:
                    logger.warning(f"Timeout when scraping {request.url}, retrying...")
                    await asyncio.sleep(1)
                else:
                    return {
                        "success": False,
                        "url": request.url,
                        "error": "Timeout error",
                        "content": ""
                    }
            except Exception as e:
                if attempt < request.retry_count:
                    logger.warning(f"Error when scraping {request.url}: {str(e)}, retrying...")
                    await asyncio.sleep(1)
                else:
                    return {
                        "success": False,
                        "url": request.url,
                        "error": f"Scraping error: {str(e)}",
                        "content": ""
                    }
    
    try:
        result = await attempt_scrape()
        
        # Cache successful results
        if redis_client and result.get("success"):
            await redis_client.set(
                cache_key,
                json.dumps(result),
                ex=DEFAULT_CACHE_TTL
            )
        
        return result
    
    except Exception as e:
        logger.error(f"Error during scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scraping error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)