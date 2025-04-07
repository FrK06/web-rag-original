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
railway init

# Add database plugins
echo "Adding MongoDB and Redis plugins..."
echo "Please follow the interactive prompts to add MongoDB and Redis plugins"
railway add
echo "After adding MongoDB, press Enter to continue"
read -p ""
railway add
echo "After adding Redis, press Enter to continue"
read -p ""

# Generate secure secrets for JWT and CSRF
JWT_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)

# Set environment variables interactively
echo "Setting environment variables..."
echo "Please use the Railway dashboard to set the following variables:"
echo "- JWT_SECRET: $JWT_SECRET"
echo "- CSRF_SECRET: $CSRF_SECRET"
echo "- EMAIL_VERIFICATION_REQUIRED: true"

echo "Open the Railway dashboard at https://railway.app/dashboard"
echo "Navigate to your project, then click on Variables"
echo "After setting the variables, press Enter to continue"
read -p ""

# Deploy services
echo "Deploying auth service..."
echo "Please use the Railway dashboard to deploy the auth service"
echo "After deploying auth service, press Enter to continue"
read -p ""

echo "Deploying API gateway..."
echo "Please use the Railway dashboard to deploy the API gateway"
echo "After deploying API gateway, press Enter to continue"
read -p ""

echo "Deploying frontend..."
echo "Please use the Railway dashboard to deploy the frontend"
echo "After deploying frontend, press Enter to continue"
read -p ""

echo "✅ Deployment completed! Please verify your deployments in the Railway dashboard."