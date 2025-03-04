# Web RAG System

A multimodal (Agentic) Retrieval-Augmented Generation (RAG) system with web search, scrape, image processing, speech (TTS & STT), and communication capabilities (currently outgoing phone calls and SMS).

## Features

- **Web Search & Scraping**: Search the web for up-to-date information and extract content from websites
- **Image Processing**: Generate, analyze, and process images using DALL-E and GPT-4 Vision
- **Speech Recognition & Synthesis**: Convert speech to text and text to speech using OpenAI's APIs
- **Communication**: Send SMS messages and make phone calls via Twilio integration
- **Vector Storage**: Store and retrieve information using vector embeddings
- **Reactive UI**: Modern React frontend with real-time tool activation indicators

## Project Structure

```
web_rag/
│
├── rag-frontend/         # React/Next.js frontend
│    ├── node_modules/
│    ├── public/  
│    ├── src/ 
│    │    └── ChatInterface.tsx    # Main chat interface component
│    │
│    ├── package.json
│    └── ...               # Other Next.js configuration files
│
├── src/                  # Python backend
│   ├── core/             # Core RAG components
│   │   ├── __init__.py
│   │   ├── vector_store.py
│   │   └── workflow.py
│   │
│   ├── tools/            # Tool implementations
│   │   ├── __init__.py
│   │   ├── image_tools.py
│   │   ├── rag_tools.py
│   │   ├── speech_tools.py
│   │   ├── twilio.py
│   │   ├── web_scraper.py
│   │   └── web_searcher.py
│   │
│   ├── __init__.py
│   ├── demo.py
│   └── web_rag_system.py
│
├── app.py               # FastAPI application
├── requirements.txt     # Python dependencies
└── setup.py            # Package setup
```

## Installation

### Backend Setup

1. Clone the repository
   ```bash
   git clone https://github.com/FrK06/web-rag.git
   cd web-rag
   ```

2. Create a virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies
   ```bash
   pip install -e .
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_CSE_ID=your_google_custom_search_engine_id
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

### Frontend Setup

1. Navigate to the frontend directory
   ```bash
   cd rag-frontend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm run dev
   ```

## Usage

1. Start the backend server
   ```bash
   uvicorn app:app --reload
   ```

2. In a separate terminal, start the frontend (if not already running)
   ```bash
   cd rag-frontend
   npm run dev
   ```

3. Navigate to `http://localhost:3000` in your browser to use the application
