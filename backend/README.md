# Multimodal RAG System - Microservices Architecture

This repository contains a complete microservices implementation of the RAG (Retrieval-Augmented Generation) system with multimodal capabilities.

## Architecture Overview

The system is composed of the following microservices:

1. **API Gateway** - Entry point for all client requests
2. **Conversation Service** - Manages conversation history and state
3. **Search Service** - Handles web search and content extraction
4. **Multimedia Service** - Processes images, audio, and text-to-speech
5. **Notification Service** - Manages SMS and phone calls
6. **LLM Service** - Orchestrates AI reasoning and tool selection

## Prerequisites

- Docker and Docker Compose
- OpenAI API key
- Google API key and Custom Search Engine ID
- Twilio account (for SMS and calls)
- MongoDB (auto-provisioned in Docker)
- Redis (auto-provisioned in Docker)

## Deployment Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/rag-microservices.git
cd rag-microservices
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file and fill in your API keys and configuration values.

### 3. Build and Start the Services

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
- Create the necessary directory structure
- Copy configuration files
- Build Docker images for all services
- Start all containers with appropriate environment variables

### 4. Verify Deployment

Once deployment completes, verify that all services are running:

```bash
docker-compose ps
```

Check health endpoints for each service:

```bash
curl http://localhost:8000/api/health  # API Gateway
curl http://localhost:8001/health      # Conversation Service
curl http://localhost:8002/health      # Search Service
curl http://localhost:8003/health      # Multimedia Service
curl http://localhost:8004/health      # Notification Service
curl http://localhost:8005/health      # LLM Service
```

### 5. Connect Frontend

Update your frontend configuration to point to the API Gateway:

```
API_URL=http://localhost:8000
```

## Service Endpoints

The API Gateway exposes the following endpoints:

- `POST /api/chat/` - Main chat endpoint
- `POST /api/speech-to-text/` - Convert speech to text
- `POST /api/text-to-speech/` - Convert text to speech
- `POST /api/generate-image/` - Generate an image
- `POST /api/analyze-image/` - Analyze an image
- `POST /api/process-image/` - Process an image
- `POST /api/send-sms/` - Send an SMS message
- `POST /api/make-call/` - Make a phone call
- `GET /api/health` - Check system health

## Scaling and Monitoring

### Scaling Individual Services

Each service can be scaled independently:

```bash
docker-compose up -d --scale search-service=3 --scale llm-service=2
```

### Monitoring

To view logs from all services:

```bash
docker-compose logs -f
```

To view logs from a specific service:

```bash
docker-compose logs -f api-gateway
```

## Architecture Benefits

This microservices architecture provides:

1. **Independent Scaling** - Scale only the services under load
2. **Resilience** - One failing service doesn't take down the entire system
3. **Clear Responsibility Boundaries** - Each service has a focused purpose
4. **Technology Flexibility** - Services can be implemented in different languages
5. **Isolated State** - Each service manages its own data
6. **Efficient Caching** - Service-specific caching strategies
7. **Enhanced Monitoring** - Per-service health and performance metrics

## Troubleshooting

### Common Issues

1. **Redis Connection Problems**
   - Check if Redis is running: `docker-compose ps redis`
   - Verify Redis configuration

2. **MongoDB Connection Issues**
   - Check MongoDB logs: `docker-compose logs mongodb`
   - Verify credentials in `.env`

3. **API Rate Limiting**
   - Check service logs for rate limit warnings
   - Adjust rate limits in `.env` if necessary

4. **Service Timeouts**
   - Check network connectivity between services
   - Adjust timeout settings in service configuration

### Restarting a Service

If a service needs to be restarted:

```bash
docker-compose restart service-name
```

For example:

```bash
docker-compose restart llm-service
```

## Production Considerations

Before deploying to production:

1. Configure proper authentication for API endpoints
2. Set up HTTPS with TLS certificates
3. Implement proper logging with log aggregation
4. Set up monitoring and alerting
5. Implement CI/CD pipelines
6. Add rate limiting at the API Gateway level
7. Configure backup and recovery for MongoDB
8. Implement proper secrets management