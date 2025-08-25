# Multimodal RAG System

A sophisticated microservices-based Retrieval-Augmented Generation (RAG) system with multimodal capabilities, featuring real-time web search, image processing, voice interactions, and SMS/phone call integration.

## 🎯 Features

### Core Capabilities
- **Multimodal AI Assistant**: Supports text, images, voice, and web content
- **Real-time Web Search**: Google Custom Search integration for up-to-date information
- **Image Processing**: Image generation (DALL-E), analysis, and processing
- **Voice Interactions**: Speech-to-text and text-to-speech capabilities
- **Communication Services**: SMS and phone call integration via Twilio
- **Conversation Management**: Persistent conversation history with MongoDB
- **Advanced Reasoning**: Multi-step reasoning with transparent thought process display

### Technical Features
- **Microservices Architecture**: 7 independent, scalable services
- **Real-time Caching**: Redis-based caching for improved performance
- **Authentication System**: JWT-based auth with CSRF protection
- **Rate Limiting**: Service-level and user-level rate limiting
- **Health Monitoring**: Built-in health checks for all services
- **Docker Deployment**: Containerized services with Docker Compose

## 🏗️ Architecture

### Backend Services

1. **API Gateway** (Port 8000)
   - Central entry point for all client requests
   - Request routing and aggregation
   - CORS handling

2. **Conversation Service** (Port 8001)
   - Manages conversation history and threads
   - MongoDB integration for persistence
   - Thread management and retrieval

3. **Search Service** (Port 8002)
   - Google Custom Search integration
   - Web content extraction and scraping
   - Result caching with Redis

4. **Multimedia Service** (Port 8003)
   - Image generation (DALL-E)
   - Image analysis and processing
   - Speech-to-text (Whisper)
   - Text-to-speech

5. **Notification Service** (Port 8004)
   - SMS messaging via Twilio
   - Phone call initiation
   - Rate limiting per recipient

6. **LLM Service** (Port 8005)
   - OpenAI GPT integration
   - Tool orchestration and selection
   - Multi-step reasoning
   - Response formatting

7. **Auth Service** (Port 8006)
   - User authentication
   - JWT token management
   - Session handling
   - Security middleware

### Frontend

- **Next.js 15** with TypeScript
- **React 19** with Hooks
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Markdown** for content rendering
- **Syntax Highlighting** with Prism

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- OpenAI API key
- Google API key and Custom Search Engine ID
- Twilio account (optional, for SMS/calls)
- MongoDB (auto-provisioned via Docker)
- Redis (auto-provisioned via Docker)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/multimodal-rag-system.git
cd multimodal-rag-system
```

### 2. Backend Setup

#### Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Required API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CSE_ID=your-google-cse-id

# Optional: Twilio (for SMS/calls)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Database (auto-generated passwords are fine)
MONGO_PASSWORD=secure-mongo-password
REDIS_PASSWORD=secure-redis-password

# Security Keys (generate random strings)
JWT_SECRET=long-random-string
CSRF_SECRET=different-long-random-string
```

#### Deploy Backend Services

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
- Build Docker images for all services
- Start all containers with proper networking
- Set up MongoDB and Redis
- Initialize health checks

#### Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Test health endpoints
curl http://localhost:8000/api/health
```

### 3. Frontend Setup

```bash
cd ../rag-frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Access the application at `http://localhost:3000`

## 📖 Usage Guide

### Basic Chat
1. Start a new conversation or select an existing one
2. Type your message or use voice input
3. Attach images for analysis
4. Switch between "Explore" and "Setup" modes

### Advanced Features

#### Web Search
The assistant automatically searches the web when needed for current information.

#### Image Generation
Ask the assistant to create images:
```
"Generate an image of a futuristic city at sunset"
```

#### Image Analysis
Upload an image and ask questions about it:
```
"What objects do you see in this image?"
```

#### Voice Interaction
- Click the microphone button to speak
- Assistant responses can be played as audio

#### SMS/Phone Integration
```
"Send an SMS to +1234567890 saying 'Meeting at 3pm'"
```

## 🔧 Development

### Running Individual Services

```bash
# Run specific service
docker-compose up search-service

# View logs
docker-compose logs -f llm-service

# Restart service
docker-compose restart conversation-service
```

### Scaling Services

```bash
# Scale horizontally
docker-compose up -d --scale search-service=3
```

### Frontend Development

```bash
cd rag-frontend
npm run dev    # Development server
npm run build  # Production build
npm run lint   # Run linter
```

## 📊 Monitoring

### Service Health Checks

All services expose health endpoints:
- API Gateway: `http://localhost:8000/api/health`
- Individual services: `http://localhost:800X/health`

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f llm-service

# With timestamps
docker-compose logs -t -f
```

### Database Access

```bash
# MongoDB
docker exec -it mongodb mongosh -u mongo-user -p $MONGO_PASSWORD

# Redis
docker exec -it redis redis-cli -a $REDIS_PASSWORD
```

## 🔒 Security Features

- JWT-based authentication
- CSRF protection
- Rate limiting per service and user
- Environment variable isolation
- Secure password hashing (bcrypt)
- CORS configuration
- Input validation and sanitization

## 🐛 Troubleshooting

### Common Issues

1. **Service Connection Errors**
   - Check if all services are running: `docker-compose ps`
   - Verify network connectivity: `docker network ls`

2. **MongoDB Connection Issues**
   - Check credentials in `.env`
   - Verify MongoDB is running: `docker-compose logs mongodb`

3. **Rate Limiting**
   - Check Redis connection: `docker-compose logs redis`
   - Adjust limits in `.env` if needed

4. **Frontend Build Issues**
   - Clear Next.js cache: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

## 📈 Performance Optimization

- Redis caching with configurable TTL
- Service-level rate limiting
- Lazy loading for frontend components
- Image optimization and compression
- Connection pooling for databases
- Horizontal scaling support

## 🚀 Production Deployment

### Prerequisites
1. Configure production environment variables
2. Set up HTTPS with TLS certificates
3. Configure production database URLs
4. Set up monitoring and alerting
5. Implement backup strategies

### Deployment Steps

```bash
# Build for production
docker-compose -f docker-compose.prod.yml build

# Deploy with production config
docker-compose -f docker-compose.prod.yml up -d

# Frontend production build
cd rag-frontend
npm run build
npm start
```

## 📝 API Documentation

### Main Endpoints

- `POST /api/chat` - Main chat endpoint
- `POST /api/speech-to-text` - Convert speech to text
- `POST /api/text-to-speech` - Convert text to speech
- `POST /api/generate-image` - Generate images
- `POST /api/analyze-image` - Analyze uploaded images
- `POST /api/send-sms` - Send SMS messages
- `POST /api/make-call` - Initiate phone calls
- `GET /api/conversations` - Get conversation history
- `GET /api/health` - System health check

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check existing issues for solutions
