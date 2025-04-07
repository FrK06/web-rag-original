#!/usr/bin/env python3
import os
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get connection strings from environment
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
REDIS_URI = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DB_NAME = os.getenv("MONGO_DB", "ragassistant")

async def initialize_mongodb():
    """Initialize MongoDB collections and indexes"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[DB_NAME]
        
        # Create collections if they don't exist
        collections = ["users", "refresh_tokens", "conversations", "messages"]
        
        for collection_name in collections:
            # List collections to check if it exists
            collection_exists = await db.list_collection_names(filter={"name": collection_name})
            if not collection_exists:
                logger.info(f"Creating collection: {collection_name}")
                await db.create_collection(collection_name)
        
        # Create indexes
        logger.info("Creating MongoDB indexes...")
        
        # Users collection indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("email_verification_token")
        await db.users.create_index("reset_token")
        
        # Refresh tokens collection indexes
        await db.refresh_tokens.create_index("user_id")
        await db.refresh_tokens.create_index("jti", unique=True)
        await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
        
        # Conversations collection indexes
        await db.conversations.create_index("user_id")
        await db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
        
        # Messages collection indexes
        await db.messages.create_index("conversation_id")
        await db.messages.create_index([("conversation_id", 1), ("timestamp", 1)])
        
        logger.info("MongoDB initialization complete!")
        
    except Exception as e:
        logger.error(f"Error initializing MongoDB: {str(e)}")
        raise

async def initialize_redis():
    """Initialize Redis configuration"""
    try:
        # Connect to Redis
        r = redis.from_url(REDIS_URI)
        
        # Test connection
        await r.ping()
        logger.info("Redis connection successful")
        
        # Set some configuration values
        await r.config_set("maxmemory-policy", "allkeys-lru")
        
        # Close connection
        await r.close()
        
        logger.info("Redis initialization complete!")
        
    except Exception as e:
        logger.error(f"Error initializing Redis: {str(e)}")
        raise

async def main():
    """Run all initialization tasks"""
    logger.info("Starting database initialization...")
    
    await initialize_mongodb()
    await initialize_redis()
    
    logger.info("All database initialization complete!")

if __name__ == "__main__":
    asyncio.run(main())