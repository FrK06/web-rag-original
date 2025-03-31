from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import os
import datetime
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Conversation Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DB_NAME = os.getenv("MONGO_DB", "ragassistant")
COLLECTION_NAME = "conversations"

# MongoDB client - initialized during startup
mongo_client = None
db = None
conversations = None

class ConversationRequest(BaseModel):
    thread_id: Optional[str] = None
    message: str
    conversation_history: List[Dict[str, Any]] = []

class ConversationUpdate(BaseModel):
    thread_id: str
    assistant_message: str
    metadata: Dict[str, Any] = {}

class ConversationRenameRequest(BaseModel):
    name: str

@app.on_event("startup")
async def startup_event():
    global mongo_client, db, conversations
    try:
        # Use Motor instead of aiomongo
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[DB_NAME]
        conversations = db[COLLECTION_NAME]
        
        # Create indexes
        await conversations.create_index("thread_id", unique=True)
        await conversations.create_index("last_updated", expireAfterSeconds=7*24*60*60)  # Auto-expire after 7 days
        
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        raise e


@app.on_event("shutdown")
async def shutdown_event():
    if mongo_client:
        mongo_client.close()
        logger.info("Closed MongoDB connection")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Ping MongoDB
        await db.command("ping")
        return {"status": "healthy", "service": "conversation", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "service": "conversation", "error": str(e)}

@app.post("/store")
async def store_message(request: ConversationRequest):
    """Store a new message in the conversation history"""
    # Generate thread_id if not provided
    thread_id = request.thread_id or f"thread_{uuid.uuid4().hex}"
    
    # Format the message
    user_message = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    try:
        # Check if conversation exists
        conversation = await conversations.find_one({"thread_id": thread_id})
        
        if conversation:
            # Update existing conversation
            await conversations.update_one(
                {"thread_id": thread_id},
                {
                    "$push": {"messages": user_message},
                    "$set": {"last_updated": datetime.datetime.utcnow()}
                }
            )
            history = conversation.get("messages", [])
            history.append(user_message)
        else:
            # Create new conversation
            history = [user_message]
            await conversations.insert_one({
                "thread_id": thread_id,
                "messages": history,
                "created_at": datetime.datetime.utcnow(),
                "last_updated": datetime.datetime.utcnow(),
                "title": request.message[:50]  # Use first message as initial title
            })
        
        return {
            "thread_id": thread_id,
            "history": history[-10:],  # Return last 10 messages to limit size
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error storing message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error storing message: {str(e)}")

@app.post("/update")
async def update_conversation(request: ConversationUpdate):
    """Update conversation with assistant's response"""
    try:
        # Format the message
        assistant_message = {
            "role": "assistant",
            "content": request.assistant_message,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "metadata": request.metadata
        }
        
        # Update the conversation
        result = await conversations.update_one(
            {"thread_id": request.thread_id},
            {
                "$push": {"messages": assistant_message},
                "$set": {"last_updated": datetime.datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            logger.warning(f"Thread {request.thread_id} not found for update")
            raise HTTPException(status_code=404, detail="Thread not found")
            
        return {
            "thread_id": request.thread_id,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating conversation: {str(e)}")

@app.get("/history/{thread_id}")
async def get_history(thread_id: str, limit: int = 100):
    """Get conversation history for a thread"""
    try:
        conversation = await conversations.find_one({"thread_id": thread_id})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Thread not found")
            
        messages = conversation.get("messages", [])
        
        # Apply limit
        if limit > 0:
            messages = messages[-limit:]
            
        return {
            "thread_id": thread_id,
            "messages": messages,
            "count": len(messages)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")

@app.delete("/delete/{thread_id}")
async def delete_conversation(thread_id: str):
    """Delete a conversation thread"""
    try:
        result = await conversations.delete_one({"thread_id": thread_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Thread not found")
            
        return {
            "thread_id": thread_id,
            "status": "deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(e)}")
    
@app.get("/threads")
async def list_threads(limit: int = 20, skip: int = 0):
    """Get a list of conversation threads with preview information"""
    try:
        # Find all conversations, sorted by last_updated (newest first)
        cursor = conversations.find(
            {},
            {"thread_id": 1, "last_updated": 1, "messages": {"$slice": -1}, "title": 1}  # Get only the last message and title
        ).sort("last_updated", -1).skip(skip).limit(limit)
        
        threads = []
        async for doc in cursor:
            # Extract preview info - prefer custom title if available
            title = doc.get("title", "")
            
            # If no title or fallback to last message
            if not title:
                last_message = doc.get("messages", [{}])[0] if doc.get("messages") else {}
                title = last_message.get("content", "")
                if len(title) > 60:
                    title = title[:57] + "..."
                
            threads.append({
                "thread_id": doc.get("thread_id"),
                "last_updated": doc.get("last_updated").isoformat() if doc.get("last_updated") else "",
                "preview": title
            })
            
        return {
            "threads": threads,
            "count": len(threads),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error listing threads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing threads: {str(e)}")

# New endpoint for renaming conversations
@app.put("/rename/{thread_id}")
async def rename_conversation(thread_id: str, request: ConversationRenameRequest):
    """Rename a conversation thread"""
    try:
        # Validate that the name is not empty
        if not request.name.strip():
            raise HTTPException(status_code=400, detail="Conversation name cannot be empty")
            
        # Update the conversation title
        result = await conversations.update_one(
            {"thread_id": thread_id},
            {"$set": {"title": request.name, "last_updated": datetime.datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Thread not found")
            
        return {
            "thread_id": thread_id,
            "name": request.name,
            "status": "renamed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error renaming conversation: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)