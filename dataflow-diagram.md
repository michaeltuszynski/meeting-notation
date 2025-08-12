# TranscriptIQ System Architecture Dataflow Diagram

```mermaid
graph TD
    %% External Services
    DG[Deepgram API<br/>Nova-2 Transcription]
    OPENAI[OpenAI API<br/>GPT-4o Mini]
    ANTHROPIC[Anthropic API<br/>Claude]
    GEMINI[Google Gemini API]
    TAVILY[Tavily API<br/>Knowledge Search]
    EXA[Exa API]
    PERPLEXITY[Perplexity API]
    REDIS[(Redis Cache<br/>24hr TTL)]
    POSTGRES[(PostgreSQL<br/>Database)]
    
    %% Audio Sources
    AUDIO_SRC[System Audio<br/>BlackHole/VB-Cable]
    
    %% Electron Layer
    ELECTRON[Electron Main Process<br/>electron/main.js]
    AUDIO_CAPTURE[Audio Capture<br/>electron/audioCapture.js]
    PRELOAD[Preload Script<br/>electron/preload.js]
    
    %% Frontend Layer
    FRONTEND[React Frontend<br/>frontend/src/App.jsx]
    MEETING_SIDEBAR[Meeting Sidebar<br/>Components]
    REPORT_VIEW[Report View<br/>Components]
    SETTINGS[Settings UI<br/>Components]
    CORRECTIONS[Corrections UI<br/>Components]
    
    %% Backend Core
    EXPRESS[Express Server<br/>backend/server.js]
    WEBSOCKET[WebSocket Server<br/>Socket.IO]
    AUDIO_PROCESSOR[Audio Processor<br/>Buffering & Format]
    
    %% Backend Services
    MEETING_SVC[Meeting Service<br/>backend/services/meeting.js]
    REPORT_SVC[Report Service<br/>backend/services/report.js]
    STORAGE_SVC[Storage Service<br/>backend/services/storage.js]
    CORRECTION_SVC[Global Corrections<br/>backend/services/global-corrections.js]
    ENHANCED_SUMMARY[Enhanced Summary<br/>backend/services/enhanced-summary.js]
    
    %% AI & Processing Services
    TRANSCRIPTION_SVC[Transcription Service<br/>Provider Factory]
    DEEPGRAM_SVC[Deepgram Service<br/>backend/transcription/deepgram.js]
    LLM_REGISTRY[Model Registry<br/>backend/llm/model-registry.js]
    LLM_FACTORY[LLM Provider Factory<br/>backend/llm/provider-factory.js]
    CONTEXTUAL_AI[Contextual Intelligence<br/>backend/llm/contextual-intelligence.js]
    KNOWLEDGE_SVC[Knowledge Service<br/>Provider Factory]
    TAVILY_SVC[Tavily Service<br/>backend/knowledge/tavily.js]
    
    %% Routes
    MEETING_ROUTES[Meeting Routes<br/>backend/routes/meetings.js]
    CORRECTION_ROUTES[Correction Routes<br/>backend/routes/corrections.js]
    
    %% Data Flow - Audio Processing
    AUDIO_SRC --> AUDIO_CAPTURE
    AUDIO_CAPTURE --> ELECTRON
    ELECTRON --> PRELOAD
    PRELOAD --> FRONTEND
    FRONTEND --> WEBSOCKET
    WEBSOCKET --> AUDIO_PROCESSOR
    AUDIO_PROCESSOR --> TRANSCRIPTION_SVC
    TRANSCRIPTION_SVC --> DEEPGRAM_SVC
    DEEPGRAM_SVC --> DG
    
    %% Data Flow - Transcription Response
    DG --> DEEPGRAM_SVC
    DEEPGRAM_SVC --> TRANSCRIPTION_SVC
    TRANSCRIPTION_SVC --> CONTEXTUAL_AI
    CONTEXTUAL_AI --> LLM_FACTORY
    LLM_FACTORY --> OPENAI
    LLM_FACTORY --> ANTHROPIC
    LLM_FACTORY --> GEMINI
    
    %% Data Flow - Knowledge Retrieval
    CONTEXTUAL_AI --> KNOWLEDGE_SVC
    KNOWLEDGE_SVC --> TAVILY_SVC
    TAVILY_SVC --> TAVILY
    KNOWLEDGE_SVC --> EXA
    KNOWLEDGE_SVC --> PERPLEXITY
    
    %% Data Flow - Caching
    TAVILY_SVC --> REDIS
    REDIS --> TAVILY_SVC
    CONTEXTUAL_AI --> REDIS
    REDIS --> CONTEXTUAL_AI
    
    %% Data Flow - Database Operations
    MEETING_SVC --> POSTGRES
    REPORT_SVC --> POSTGRES
    STORAGE_SVC --> POSTGRES
    CORRECTION_SVC --> POSTGRES
    
    %% Data Flow - Frontend Communication
    WEBSOCKET --> FRONTEND
    FRONTEND --> MEETING_SIDEBAR
    FRONTEND --> REPORT_VIEW
    FRONTEND --> SETTINGS
    FRONTEND --> CORRECTIONS
    
    %% Data Flow - REST API
    FRONTEND --> EXPRESS
    EXPRESS --> MEETING_ROUTES
    EXPRESS --> CORRECTION_ROUTES
    MEETING_ROUTES --> MEETING_SVC
    CORRECTION_ROUTES --> CORRECTION_SVC
    
    %% Data Flow - Real-time Updates
    TRANSCRIPTION_SVC --> WEBSOCKET
    CONTEXTUAL_AI --> WEBSOCKET
    KNOWLEDGE_SVC --> WEBSOCKET
    MEETING_SVC --> WEBSOCKET
    CORRECTION_SVC --> WEBSOCKET
    
    %% Data Flow - Reports & Analysis
    MEETING_SVC --> REPORT_SVC
    REPORT_SVC --> ENHANCED_SUMMARY
    ENHANCED_SUMMARY --> LLM_FACTORY
    CONTEXTUAL_AI --> REPORT_SVC
    
    %% Provider Management
    LLM_REGISTRY --> LLM_FACTORY
    TRANSCRIPTION_SVC --> DEEPGRAM_SVC
    KNOWLEDGE_SVC --> TAVILY_SVC
    
    %% Styling
    classDef external fill:#ff9999,stroke:#333,stroke-width:2px
    classDef electron fill:#9ff,stroke:#333,stroke-width:2px
    classDef frontend fill:#9f9,stroke:#333,stroke-width:2px
    classDef backend fill:#ff9,stroke:#333,stroke-width:2px
    classDef service fill:#f9f,stroke:#333,stroke-width:2px
    classDef storage fill:#f99,stroke:#333,stroke-width:2px
    
    class DG,OPENAI,ANTHROPIC,GEMINI,TAVILY,EXA,PERPLEXITY external
    class ELECTRON,AUDIO_CAPTURE,PRELOAD electron
    class FRONTEND,MEETING_SIDEBAR,REPORT_VIEW,SETTINGS,CORRECTIONS frontend
    class EXPRESS,WEBSOCKET,AUDIO_PROCESSOR,MEETING_ROUTES,CORRECTION_ROUTES backend
    class MEETING_SVC,REPORT_SVC,STORAGE_SVC,CORRECTION_SVC,ENHANCED_SUMMARY,TRANSCRIPTION_SVC,DEEPGRAM_SVC,LLM_REGISTRY,LLM_FACTORY,CONTEXTUAL_AI,KNOWLEDGE_SVC,TAVILY_SVC service
    class REDIS,POSTGRES storage
```

## Key Components Overview

### 1. Audio Processing Pipeline
- **System Audio Capture**: Electron desktopCapturer → Audio Processing → WebSocket
- **Latency Target**: <50ms for audio capture

### 2. Transcription Pipeline  
- **Audio Buffering**: Format conversion and batching
- **Deepgram Integration**: Real-time WebSocket transcription (~250ms)
- **Multiple Provider Support**: Deepgram, AssemblyAI, Whisper, Google, Azure, Rev.ai, Speechmatics

### 3. AI Intelligence Pipeline
- **Term Extraction**: GPT-4o Mini identifies key terms (<500ms)
- **Contextual Analysis**: Multi-provider LLM support (OpenAI, Anthropic, Gemini)
- **Knowledge Retrieval**: Tavily/Exa/Perplexity integration (<1000ms)

### 4. Data Management
- **PostgreSQL**: Meeting data, transcripts, corrections, usage metrics
- **Redis**: Term definition caching (24hr TTL)
- **Storage Service**: Sequence caching and data persistence

### 5. Real-time Communication
- **WebSocket Server**: Bidirectional communication for audio, transcripts, intelligence
- **REST API**: Meeting management and corrections CRUD operations

### 6. Provider Architecture
- **Factory Pattern**: Dynamic provider switching for LLM, transcription, knowledge
- **Model Registry**: Available model enumeration per provider
- **Usage Tracking**: Cost calculation and metrics collection

### 7. Frontend Architecture
- **React Components**: Meeting sidebar, report view, settings, corrections
- **Real-time Updates**: WebSocket integration for live data
- **Electron Bridge**: System audio access and IPC communication

## Critical Performance Requirements
**Total Latency Target: <2000ms**
- Audio Capture: <50ms
- Transcription: <300ms (Deepgram Nova-2)  
- Term Extraction: <500ms (GPT-4o Mini)
- Knowledge Retrieval: <1000ms (Tavily)