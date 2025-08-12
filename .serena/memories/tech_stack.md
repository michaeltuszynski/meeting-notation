# TranscriptIQ Technology Stack

## Frontend
- **React 18.3.1** - Main UI framework (manual setup, no CRA)
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Professional component library
- **Socket.io-client** - WebSocket client for real-time updates
- **Webpack** - Build tool with custom configuration

## Backend
- **Node.js 20.18.0 LTS** - Runtime environment
- **Express 4.21.2** - Web server framework
- **Socket.io 4.8.1** - WebSocket server for real-time communication
- **WebSocket (ws)** - Low-level WebSocket for Deepgram integration

## Electron
- **Electron 31.7.7** - Desktop application for system audio capture
- **System audio capture** via desktopCapturer API
- **Context isolation** for security

## Database & Caching
- **PostgreSQL 15** - Primary database for meetings and transcripts
- **Redis** - Caching layer with 24hr TTL for term definitions
- **ioredis 5.7.0** - Redis client library

## AI & APIs
- **Deepgram 3.1.1** - Speech-to-text transcription (Nova-2 model)
- **OpenAI 4.20.1** - GPT-4o Mini for term extraction
- **Tavily API** - Knowledge retrieval ($10/month for 10K searches)
- **Support for Anthropic Claude and Google Gemini**

## DevOps
- **Docker & Docker Compose** - Container orchestration
- **Nodemon** - Development server with hot reload
- **Concurrently** - Run multiple dev servers simultaneously

## Testing & Quality
- **Jest 29.7.0** - Testing framework
- **ESLint 8.57.1** - JavaScript linter
- **Prettier 3.6.2** - Code formatter
- **Husky & lint-staged** - Git hooks for code quality