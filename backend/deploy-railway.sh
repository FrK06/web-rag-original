#!/bin/bash
set -e

echo "🚂 Railway Deployment Script for Multimodal RAG Assistant 🚂"
echo "==========================================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in
railway whoami || railway login

# Create a new project if needed
echo "Creating Railway project (if it doesn't exist)..."
railway init --name rag-assistant || true

# Add database plugins
echo "Adding MongoDB and Redis plugins (if they don't exist)..."
railway add -p mongodb || echo "MongoDB already configured"
railway add -p redis || echo "Redis already configured"

# Set environment variables
echo "Setting environment variables..."
railway variables set JWT_SECRET "$(openssl rand -hex 32)"
railway variables set CSRF_SECRET "$(openssl rand -hex 32)"

echo "Enter SendGrid API key:"
read -s SENDGRID_API_KEY
railway variables set SENDGRID_API_KEY "$SENDGRID_API_KEY"

echo "Enter email sender address:"
read EMAIL_FROM
railway variables set EMAIL_FROM "$EMAIL_FROM"

echo "Enter OpenAI API key:"
read -s OPENAI_API_KEY
railway variables set OPENAI_API_KEY "$OPENAI_API_KEY"

echo "Enter frontend URL (must be a Railway domain or custom domain):"
read FRONTEND_URL
railway variables set FRONTEND_URL "$FRONTEND_URL"

# Deploy services in order
echo "Deploying database initialization script..."
cd backend && python init_db.py

echo "Deploying auth service..."
railway up --service auth-service

echo "Deploying conversation service..."
railway up --service conversation-service

echo "Deploying search service..."
railway up --service search-service

echo "Deploying multimedia service..."
railway up --service multimedia-service

echo "Deploying notification service..."
railway up --service notification-service

echo "Deploying LLM service..."
railway up --service llm-service

echo "Deploying API gateway..."
railway up --service api-gateway

echo "Deploying frontend..."
railway up --service frontend

echo "⚠️ IMPORTANT: Now set the following environment variables manually in the Railway dashboard:"
echo "- SERVICE_URLs for each microservice (connect them together)"
echo "- NEXT_PUBLIC_API_URL for frontend to API gateway connection"

echo "✅ Deployment completed! Your app should be available at: $FRONTEND_URL"