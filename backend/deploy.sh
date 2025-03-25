#!/bin/bash

# RAG System Deployment Script
# This script sets up and deploys the microservices architecture

set -e

echo "Starting RAG System Deployment..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "No .env file found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env from .env.example. Please edit .env with your actual values."
        exit 1
    else
        echo "No .env.example file found. Please create a .env file with necessary environment variables."
        exit 1
    fi
fi

# Create service directories if they don't exist
for service in api_gateway conversation_service search_service multimedia_service notification_service llm_service; do
    if [ ! -d "$service" ]; then
        echo "Creating directory for $service..."
        mkdir -p "$service"
    fi
done

# Copy Dockerfile to each service directory
for service in api_gateway conversation_service search_service multimedia_service notification_service llm_service; do
    if [ ! -f "$service/Dockerfile" ]; then
        echo "Copying Dockerfile template to $service..."
        cp Dockerfile.template "$service/Dockerfile"
        
        # Adjust port in CMD for each service
        case "$service" in
            api_gateway)
                port=8000
                ;;
            conversation_service)
                port=8001
                ;;
            search_service)
                port=8002
                ;;
            multimedia_service)
                port=8003
                ;;
            notification_service)
                port=8004
                ;;
            llm_service)
                port=8005
                ;;
        esac
        
        # Replace the port in the CMD
        sed -i "s/--port\", \"8000/--port\", \"$port/g" "$service/Dockerfile"
    fi
done

# Move service files to respective directories
echo "Organizing service files..."
for service in api_gateway conversation_service search_service multimedia_service notification_service llm_service; do
    if [ -f "$service.py" ]; then
        echo "Moving $service.py to $service/main.py..."
        mv "$service.py" "$service/main.py"
    fi
    
    # Create requirements.txt if missing
    if [ ! -f "$service/requirements.txt" ]; then
        echo "Creating requirements.txt for $service..."
        cat > "$service/requirements.txt" <<EOF
fastapi>=0.104.0
uvicorn>=0.23.2
httpx>=0.25.0
redis>=5.0.0
python-dotenv>=1.0.0
pydantic>=2.4.2
logging>=0.4.9.6
aiohttp>=3.8.6
EOF
        
        # Add service-specific dependencies
        case "$service" in
            conversation_service)
                echo "motor>=3.3.1" >> "$service/requirements.txt"
                echo "aiomongo>=0.1.0" >> "$service/requirements.txt"
                ;;
            search_service)
                echo "beautifulsoup4>=4.12.2" >> "$service/requirements.txt"
                ;;
            multimedia_service)
                echo "pillow>=10.0.1" >> "$service/requirements.txt"
                echo "numpy>=1.26.0" >> "$service/requirements.txt"
                ;;
        esac
    fi
done

# Build and start the containers
echo "Building and starting containers..."
docker-compose up -d --build

# Wait for services to be ready
echo "Waiting for services to start up..."
sleep 10

# Check if services are running
echo "Checking service health..."
docker-compose ps

echo "Deployment complete! RAG System is now running."
echo "API Gateway is available at: http://localhost:8000"
echo "Use 'docker-compose logs -f' to view logs"