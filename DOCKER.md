# Docker Setup for Meeting Intelligence Assistant

## Ports Configuration

- **Backend**: Port 9000 (previously 8080)
- **Frontend**: Port 4000 (previously 3000)
- **Redis**: Port 6379

## Quick Start

### Prerequisites

1. Docker and Docker Compose installed
2. `.env` file with API keys:
   ```
   DEEPGRAM_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   TAVILY_API_KEY=your_key_here
   ```

### Running with Docker

#### Production Mode
```bash
# Start all services in background
npm run docker:prod
# OR
docker-compose up -d

# View logs
npm run docker:logs
```

#### Development Mode (with hot-reload)
```bash
# Start with volume mounts for development
npm run docker:dev
# OR
./docker-start.sh dev
```

### Docker Commands

```bash
# Build containers
npm run docker:build

# Start containers
npm run docker:up

# Stop containers
npm run docker:down

# View logs
npm run docker:logs

# Clean up (removes volumes)
npm run docker:clean
```

## Access Points

- Frontend: http://localhost:4000
- Backend WebSocket: ws://localhost:9000
- Backend HTTP: http://localhost:9000

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   Port 4000     │
└────────┬────────┘
         │
    WebSocket
         │
┌────────▼────────┐
│   Backend       │
│   Port 9000     │
└────────┬────────┘
         │
┌────────▼────────┐
│   Redis Cache   │
│   Port 6379     │
└─────────────────┘
```

## Troubleshooting

### Port Conflicts
If ports are already in use, stop conflicting services or modify ports in:
- `docker-compose.yml`
- `backend/server.js`
- `frontend/server.js`

### Connection Issues
Ensure environment variables are set correctly:
- `REACT_APP_WS_URL` for frontend WebSocket connection
- `PORT` for backend server port

### Build Issues
Clear Docker cache and rebuild:
```bash
docker-compose down
docker system prune -f
docker-compose build --no-cache
```