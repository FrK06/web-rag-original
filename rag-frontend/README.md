# Multimodal RAG Assistant Frontend

A modern, feature-rich conversational interface for the Multimodal Retrieval-Augmented Generation (RAG) system. This frontend provides a seamless chat experience with support for text, speech, and image interactions.

![Multimodal RAG Assistant](https://placeholder-image.com/rag-assistant-preview.png)

## Features

- **Conversational UI**: Clean, responsive chat interface with message history
- **Multimodal Inputs**:
  - Text messaging with markdown support
  - Speech recognition for voice input
  - Image upload and attachment
- **Multimodal Outputs**:
  - Rich text responses with markdown formatting
  - Text-to-speech capabilities
  - Image generation and display
- **Tool Integration**:
  - Web search and content retrieval
  - Web page scraping
  - SMS and phone call functionality
  - Image analysis and processing
- **Modes**:
  - Explore mode for information retrieval
  - Setup mode for configuration assistance

## Architecture

This frontend is built with:
- **Next.js**: React framework for production
- **React**: Component-based UI library
- **Axios**: For API requests
- **Tailwind CSS**: For styling
- **Lucide React**: For icons

The application connects to a Python FastAPI backend that powers the RAG capabilities and tool integrations.

## Directory Structure

The project follows a modular architecture for maintainability:

```
src/
├── components/
│   └── chat/              # Modularized chat components
│       ├── components/    # UI components
│       ├── services/      # API interaction services
│       ├── utils/         # Helper utilities
│       ├── ChatInterface.tsx  # Main container component
│       ├── types.ts       # TypeScript type definitions
│       └── index.ts       # Export file
├── pages/                 # Next.js pages
│   ├── api/               # API routes
│   └── index.tsx          # Main page
├── styles/                # Global styles
└── public/                # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API server running (see backend repository)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rag-frontend.git
   cd rag-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root with your API configuration:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Configuration

The frontend communicates with the backend API through services defined in `src/components/chat/services/apiService.ts`. By default, it connects to `http://localhost:8000`.

To change the API URL:
1. Update the `NEXT_PUBLIC_API_URL` in your `.env.local` file
2. Restart the development server

## Component Overview

- **ChatInterface**: Main container component that orchestrates all functionality
- **MessageItem**: Renders individual message bubbles with formatting
- **ChatInput**: Handles text input, speech recording, and image uploads
- **ImageModal**: Displays and provides options to analyze or process images
- **ToolBar**: Shows active tools and their status

## Troubleshooting

### API Connection Issues

If you see "Network Error" in the console:
1. Ensure your backend server is running
2. Check that the API URL in `.env.local` is correct
3. Verify CORS is properly configured on the backend
4. Try using a Next.js API route as a proxy (see `pages/api/chat.ts`)

### Build Issues

If you encounter build errors:
```bash
# Clean the Next.js cache
rm -rf .next
# Or with Windows PowerShell:
Remove-Item -Recurse -Force .next

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [ReactMarkdown](https://github.com/remarkjs/react-markdown)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [Tailwind CSS](https://tailwindcss.com/docs)
