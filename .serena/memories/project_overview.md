# TranscriptIQ Project Overview

## Purpose
TranscriptIQ is an AI-powered meeting intelligence platform that provides real-time transcription and contextual insights with a strict <2 second end-to-end latency requirement. It's an enterprise-ready application designed for professional meeting transcription and analysis.

## Key Features
- **Real-time transcription** using Deepgram Nova-2 WebSocket API
- **Contextual intelligence** beyond simple keywords using GPT-4o Mini
- **Knowledge retrieval** via Tavily API with Redis caching
- **Meeting management** with PostgreSQL persistence
- **Hybrid architecture** with Electron for audio capture and Docker for backend services
- **Professional UI** with React, Tailwind CSS, and shadcn/ui components
- **Multi-LLM support** for OpenAI, Anthropic, and Google Gemini models

## Performance Requirements
- Audio Capture: <50ms
- Transcription: <300ms  
- Term Extraction: <500ms
- Knowledge Retrieval: <1000ms
- **Total: <2000ms end-to-end latency**

## Current Status
Version v3.3.1 - Enterprise ready with complete configuration management system, ReportView restoration, and UI consistency improvements.