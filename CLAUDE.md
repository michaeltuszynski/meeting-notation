# Meeting Intelligence Assistant

Real-time meeting intelligence with <2s latency requirement.

## Critical Performance Requirements

**MUST achieve <2 second end-to-end latency:**
- Audio Capture: <50ms
- Transcription: <300ms (Deepgram Nova-2)
- Term Extraction: <500ms (GPT-4o Mini)
- Knowledge Retrieval: <1000ms (Tavily)
- **Total: <2000ms**

## Environment Setup

This project uses isolated Node.js and Python environments:
- Node.js 20.18.0 LTS (in node_env/ or via nvm)
- Python venv (in venv/)

### Activation
```bash
source activate.sh
```

## Commands

```bash
# Development
npm run dev                 # Start all services
npm run perf:check         # Verify latency targets
npm run debug:memory       # Check for memory leaks

# Testing
npm test                   # Run all tests
npm run test:perf         # Run performance tests
```

## Architecture

- **Electron**: System audio capture via desktopCapturer
- **Backend**: Node.js with WebSocket server (port 8080)
- **Transcription**: Deepgram Nova-2 via WebSocket (~250ms latency)
- **LLM**: GPT-4o Mini for term extraction ($0.15/1M tokens)
- **Knowledge**: Tavily API ($10/month for 10K searches)
- **Frontend**: React (manual setup, no CRA)
- **Caching**: Redis for term definitions (24hr TTL)

## File Structure

- `electron/` - Electron main and preload scripts
- `backend/` - WebSocket server and service integrations
- `frontend/` - React application (manual setup)
- `scripts/` - Performance monitoring and utilities
- `.claude/` - Claude Code configuration

## Environment Variables Required

Add to .env file:
```
DEEPGRAM_API_KEY=xxx
OPENAI_API_KEY=xxx
TAVILY_API_KEY=xxx
```

## Platform-Specific Audio Setup

- **macOS**: Install BlackHole from https://existential.audio/blackhole/
- **Windows**: Install VB-Cable from https://vb-audio.com/Cable/

## Current Status

- [x] Project structure created
- [x] Dependencies installed
- [ ] Audio capture implementation
- [ ] Deepgram integration
- [ ] Term extraction
- [ ] Knowledge retrieval
- [ ] Frontend UI

## Next Steps

1. Implement Electron audio capture
2. Connect to Deepgram WebSocket
3. Add term extraction with GPT-4o Mini
4. Integrate Tavily for knowledge retrieval
