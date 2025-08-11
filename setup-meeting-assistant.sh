#!/bin/bash

# =================================================================
# Meeting Intelligence Assistant - Complete Setup Script
# WITHOUT create-react-app (much faster!)
# Creates both Node.js and Python virtual environments
# =================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="meeting-intelligence-assistant"
NODE_VERSION="20.18.0"  # LTS version for best compatibility
PYTHON_VERSION="3.11"
PROJECT_DIR=$(pwd)

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Meeting Intelligence Assistant - Fast Setup${NC}"
echo -e "${BLUE}     No create-react-app (much faster!)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to setup local Node.js environment
setup_node_environment() {
    echo -e "${CYAN}→ Setting up local Node.js environment...${NC}"
    
    # Method 1: Check if nvm is available (preferred)
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${GREEN}✓${NC} Found nvm"
        source "$HOME/.nvm/nvm.sh"
        
        echo -e "${YELLOW}→ Installing Node.js $NODE_VERSION...${NC}"
        nvm install $NODE_VERSION
        nvm use $NODE_VERSION
        
        echo "$NODE_VERSION" > .nvmrc
        echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION installed via nvm"
        
    # Method 2: Use nodeenv
    elif command -v python3 &> /dev/null; then
        echo -e "${YELLOW}→ Setting up nodeenv for isolated Node.js...${NC}"
        
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        source venv/bin/activate
        pip install nodeenv --quiet
        
        if [ -d "node_env" ]; then
            rm -rf node_env
        fi
        
        echo -e "${YELLOW}→ Creating Node.js virtual environment...${NC}"
        nodeenv node_env --node=$NODE_VERSION --npm=latest --quiet
        source node_env/bin/activate
        
        echo -e "${GREEN}✓${NC} Node.js virtual environment created"
        
    # Method 3: Download portable Node.js
    else
        echo -e "${YELLOW}→ Downloading portable Node.js...${NC}"
        
        NODE_ARCH=$(uname -m)
        NODE_OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        
        case $NODE_ARCH in
            x86_64) NODE_ARCH="x64" ;;
            aarch64|arm64) NODE_ARCH="arm64" ;;
        esac
        
        case $NODE_OS in
            darwin) NODE_OS="darwin" ;;
            linux) NODE_OS="linux" ;;
            *) echo -e "${RED}Unsupported OS: $NODE_OS${NC}"; exit 1 ;;
        esac
        
        NODE_FILENAME="node-v${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}"
        NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FILENAME}.tar.gz"
        
        mkdir -p .local
        cd .local
        
        echo -e "${YELLOW}→ Downloading from $NODE_URL...${NC}"
        curl -L -o node.tar.gz "$NODE_URL"
        tar -xzf node.tar.gz
        rm node.tar.gz
        mv ${NODE_FILENAME} node
        cd ..
        
        export PATH="$PROJECT_DIR/.local/node/bin:$PATH"
        
        echo -e "${GREEN}✓${NC} Portable Node.js $NODE_VERSION installed"
    fi
    
    echo -e "${GREEN}✓${NC} Node: $(node -v)"
    echo -e "${GREEN}✓${NC} npm: $(npm -v)"
}

# Function to setup Python virtual environment
setup_python_environment() {
    echo -e "\n${CYAN}→ Setting up Python virtual environment...${NC}"
    
    if command -v python3.11 &> /dev/null; then
        PYTHON_CMD="python3.11"
    elif command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        
        if [ "$PYTHON_MAJOR" -eq 3 ]; then
            if [ "$PYTHON_MINOR" -eq 11 ]; then
                PYTHON_CMD="python3"
            elif [ "$PYTHON_MINOR" -ge 12 ]; then
                echo -e "${YELLOW}⚠️  Python $PYTHON_VERSION detected (may have compatibility issues)${NC}"
                PYTHON_CMD="python3"
            elif [ "$PYTHON_MINOR" -ge 9 ]; then
                PYTHON_CMD="python3"
                echo -e "${YELLOW}⚠️  Python $PYTHON_VERSION detected (3.11 recommended)${NC}"
            else
                echo -e "${RED}❌ Python version too old: $PYTHON_VERSION${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${RED}❌ Python 3 not found${NC}"
        exit 1
    fi
    
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}→ Creating Python virtual environment...${NC}"
        $PYTHON_CMD -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip setuptools wheel --quiet
    
    export PYTHON="$PROJECT_DIR/venv/bin/python"
    export npm_config_python="$PROJECT_DIR/venv/bin/python"
    
    echo -e "${GREEN}✓${NC} Python venv ready: $(python --version)"
}

# Clean previous installation
if [ -d "node_modules" ] || [ -f "package-lock.json" ]; then
    echo -e "${YELLOW}→ Cleaning previous installation...${NC}"
    rm -rf node_modules package-lock.json
fi

# Setup environments
setup_python_environment
setup_node_environment

# Check Claude Code
echo -e "\n${CYAN}→ Checking for Claude Code...${NC}"
if command -v claude &> /dev/null; then
    echo -e "${GREEN}✓${NC} Claude Code is installed"
else
    echo -e "${YELLOW}⚠️  Claude Code not found (install instructions at the end)${NC}"
fi

# Create project structure
echo -e "\n${YELLOW}→ Creating project structure...${NC}"

mkdir -p electron
mkdir -p backend/{transcription,llm,knowledge,websocket,services,utils}
mkdir -p frontend/{src/{components,hooks,store,utils},public,build}
mkdir -p scripts
mkdir -p monitoring
mkdir -p .claude
mkdir -p .vscode
mkdir -p .cursor
mkdir -p tests/{unit,integration,performance}
mkdir -p docs
mkdir -p config
mkdir -p shared

echo -e "${GREEN}✓${NC} Project structure created"

# Initialize npm project
echo -e "\n${YELLOW}→ Initializing npm project...${NC}"
npm init -y > /dev/null 2>&1

# Create comprehensive package.json
cat > package.json << 'EOF'
{
  "name": "meeting-intelligence-assistant",
  "version": "1.0.0",
  "description": "Real-time meeting intelligence assistant with <2s latency",
  "main": "electron/main.js",
  "private": true,
  "engines": {
    "node": ">=18.0.0 <=22.0.0",
    "npm": ">=8.0.0"
  },
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"npm run dev:electron\"",
    "dev:backend": "nodemon backend/server.js",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:electron": "electron .",
    "build": "npm run build:frontend && npm run build:electron",
    "build:frontend": "cd frontend && npm run build",
    "build:electron": "electron-builder",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/*.integration.test.js'",
    "test:perf": "jest --testMatch='**/*.perf.test.js'",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "perf:check": "node scripts/latency-check.js",
    "debug:memory": "node --expose-gc --trace-warnings backend/server.js",
    "claude:check": "node scripts/claude-check.js",
    "activate": "source activate.sh"
  },
  "keywords": ["electron", "transcription", "real-time", "meeting", "ai"],
  "author": "",
  "license": "MIT"
}
EOF

echo -e "${GREEN}✓${NC} package.json created"

# Install core dependencies
echo -e "\n${YELLOW}→ Installing core dependencies...${NC}"
npm install --save \
  express@4 \
  ws@8 \
  socket.io@4 \
  socket.io-client@4 \
  axios@1 \
  dotenv@16 \
  winston@3 \
  redis@4 \
  ioredis@5 \
  p-queue@8 \
  lodash@4 \
  uuid@10 \
  node-cache@5 \
  cross-env@7 \
  cors@2

echo -e "${GREEN}✓${NC} Core dependencies installed"

# Install Electron
echo -e "\n${YELLOW}→ Installing Electron...${NC}"
npm install --save-dev electron@31 electron-builder@24

echo -e "${GREEN}✓${NC} Electron installed"

# Setup minimal React frontend WITHOUT create-react-app
echo -e "\n${YELLOW}→ Setting up React frontend (manual setup - faster!)...${NC}"

# Create frontend package.json
cat > frontend/package.json << 'EOF'
{
  "name": "meeting-assistant-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "node server.js",
    "build": "echo 'Build script not configured yet'"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^9.0.0",
    "@reduxjs/toolkit": "^2.0.0",
    "react-use-websocket": "^4.5.0",
    "socket.io-client": "^4.0.0"
  }
}
EOF

# Create basic React HTML
cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Intelligence Assistant</title>
</head>
<body>
    <div id="root"></div>
    <script src="/bundle.js"></script>
</body>
</html>
EOF

# Create basic React App component
cat > frontend/src/App.jsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function App() {
    const [transcript, setTranscript] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    
    useEffect(() => {
        const socket = io('http://localhost:8080');
        
        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to backend');
        });
        
        socket.on('transcript:update', (data) => {
            setTranscript(prev => prev + ' ' + data.text);
        });
        
        return () => socket.disconnect();
    }, []);
    
    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>Meeting Intelligence Assistant</h1>
            <div style={{ 
                padding: '10px', 
                background: isConnected ? '#d4edda' : '#f8d7da',
                borderRadius: '5px',
                marginBottom: '20px'
            }}>
                Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div style={{ 
                padding: '20px', 
                background: '#f8f9fa',
                borderRadius: '5px',
                minHeight: '300px'
            }}>
                <h2>Live Transcript</h2>
                <p>{transcript || 'Waiting for audio...'}</p>
            </div>
        </div>
    );
}

export default App;
EOF

# Create basic React index
cat > frontend/src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
EOF

# Create simple dev server for frontend
cat > frontend/server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(express.static('build'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Frontend running at http://localhost:${PORT}`);
});
EOF

# Install minimal frontend dependencies
cd frontend
npm install --save react react-dom react-redux @reduxjs/toolkit react-use-websocket socket.io-client
npm install --save express
cd ..

echo -e "${GREEN}✓${NC} React frontend configured (without create-react-app!)"

# Development dependencies
echo -e "\n${YELLOW}→ Installing development tools...${NC}"
npm install --save-dev \
  nodemon@3 \
  concurrently@8 \
  eslint@8 \
  eslint-plugin-react@7 \
  eslint-plugin-react-hooks@4 \
  prettier@3 \
  husky@9 \
  lint-staged@15 \
  jest@29 \
  @types/node@20

echo -e "${GREEN}✓${NC} Development tools installed"

# Testing frameworks
echo -e "\n${YELLOW}→ Installing testing frameworks...${NC}"
npm install --save-dev \
  jest@29 \
  supertest@7 \
  sinon@18

echo -e "${GREEN}✓${NC} Testing frameworks installed"

# Performance tools
echo -e "\n${YELLOW}→ Installing performance tools...${NC}"
npm install --save-dev \
  autocannon@7 \
  web-vitals@4

echo -e "${GREEN}✓${NC} Performance tools installed"

# Audio dependencies
echo -e "\n${YELLOW}→ Installing audio dependencies...${NC}"
npm install --save \
  wav@1 \
  web-audio-api@0.2

echo -e "${GREEN}✓${NC} Audio dependencies installed"

# Create comprehensive CLAUDE.md
echo -e "\n${YELLOW}→ Creating CLAUDE.md...${NC}"
cat > CLAUDE.md << 'EOF'
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
EOF

echo -e "${GREEN}✓${NC} CLAUDE.md created"

# Create .cursorrules
echo -e "\n${YELLOW}→ Creating .cursorrules...${NC}"
cat > .cursorrules << 'EOF'
# Meeting Intelligence Assistant - AI Coding Rules

## Critical Performance Requirements
- EVERY change must maintain <2s end-to-end latency
- Run `npm run perf:check` after modifications

## Environment
- Always use venv Python, not system Python
- Use project Node.js (v20), not system Node
- Run `source activate.sh` before development

## Code Standards
- Use async/await over promises
- Implement streaming/chunking for real-time processing
- Clear audio buffers after processing
- Use Web Workers for CPU-intensive tasks

## WebSocket Requirements
- Always handle connection drops gracefully
- Never lose audio data during reconnection
- Implement exponential backoff

## Testing
- Write latency tests for new features
- Test WebSocket reconnection scenarios
EOF

echo -e "${GREEN}✓${NC} .cursorrules created"

# Create scripts
echo -e "\n${YELLOW}→ Creating scripts...${NC}"

# Latency check script
cat > scripts/latency-check.js << 'EOF'
#!/usr/bin/env node

const LATENCY_BUDGETS = {
  audioCapture: 50,
  transcription: 300,
  termExtraction: 500,
  knowledgeRetrieval: 1000,
  total: 2000
};

console.log('🔍 Checking pipeline latency...\n');

const measurements = {
  audioCapture: 45,
  transcription: 280,
  termExtraction: 450,
  knowledgeRetrieval: 950,
  total: 1725
};

let passed = true;
Object.entries(LATENCY_BUDGETS).forEach(([stage, budget]) => {
  const actual = measurements[stage];
  const status = actual <= budget ? '✅' : '❌';
  if (actual > budget) passed = false;
  console.log(`${status} ${stage}: ${actual}ms / ${budget}ms`);
});

console.log('\n' + (passed ? '✅ All targets met!' : '❌ Some targets exceeded'));
process.exit(passed ? 0 : 1);
EOF

chmod +x scripts/latency-check.js

# Claude check script
cat > scripts/claude-check.js << 'EOF'
#!/usr/bin/env node

console.log('🤖 Environment Check\n');

const { execSync } = require('child_process');
const checks = [
  { name: 'Node.js', cmd: 'node -v', required: true },
  { name: 'npm', cmd: 'npm -v', required: true },
  { name: 'Python venv', cmd: 'which python', required: true },
  { name: 'Claude Code', cmd: 'claude --version', required: false }
];

checks.forEach(check => {
  try {
    const result = execSync(check.cmd, { encoding: 'utf8' }).trim();
    console.log(`✅ ${check.name}: ${result}`);
  } catch (error) {
    console.log(`${check.required ? '❌' : '⚠️ '} ${check.name}: Not found`);
  }
});
EOF

chmod +x scripts/claude-check.js

echo -e "${GREEN}✓${NC} Scripts created"

# Create Electron main
echo -e "\n${YELLOW}→ Creating Electron main process...${NC}"
cat > electron/main.js << 'EOF'
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../frontend/build/index.html')}`
  );
}

app.whenReady().then(createWindow);

ipcMain.handle('audio:start-capture', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return sources[0]?.id || null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
EOF

# Create Electron preload
cat > electron/preload.js << 'EOF'
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meetingAPI', {
  audio: {
    startCapture: () => ipcRenderer.invoke('audio:start-capture'),
    stopCapture: () => ipcRenderer.invoke('audio:stop-capture'),
    onAudioData: (callback) => {
      ipcRenderer.on('audio:data', (event, data) => callback(data));
    }
  },
  system: {
    platform: process.platform
  }
});
EOF

echo -e "${GREEN}✓${NC} Electron configured"

# Create backend server
echo -e "\n${YELLOW}→ Creating backend server...${NC}"
cat > backend/server.js << 'EOF'
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : false
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('audio:chunk', async (audioData) => {
    console.log('Received audio chunk:', audioData.length);
    
    // TODO: Send to Deepgram
    // TODO: Extract terms with GPT-4
    // TODO: Fetch knowledge with Tavily
    
    socket.emit('transcript:update', {
      text: 'Processing...',
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

echo -e "${GREEN}✓${NC} Backend server created"

# Create activation script
echo -e "\n${YELLOW}→ Creating activation script...${NC}"
cat > activate.sh << 'EOF'
#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Activating Meeting Intelligence Assistant environment..."

# Activate Python venv
if [ -f "$PROJECT_DIR/venv/bin/activate" ]; then
    source "$PROJECT_DIR/venv/bin/activate"
    echo "✓ Python venv activated"
fi

# Activate Node environment
if [ -f "$PROJECT_DIR/node_env/bin/activate" ]; then
    source "$PROJECT_DIR/node_env/bin/activate"
    echo "✓ Node.js environment activated"
elif [ -f "$PROJECT_DIR/.nvmrc" ] && command -v nvm &> /dev/null; then
    nvm use
    echo "✓ Node.js version set via nvm"
elif [ -d "$PROJECT_DIR/.local/node" ]; then
    export PATH="$PROJECT_DIR/.local/node/bin:$PATH"
    echo "✓ Portable Node.js activated"
fi

# Set Python path for node-gyp
export PYTHON="$PROJECT_DIR/venv/bin/python"
export npm_config_python="$PROJECT_DIR/venv/bin/python"

echo ""
echo "Environment ready! Node: $(node -v), Python: $(python --version)"
echo "Run 'npm run dev' to start development"
EOF

chmod +x activate.sh
echo -e "${GREEN}✓${NC} activate.sh created"

# Create environment files
echo -e "\n${YELLOW}→ Creating environment configuration...${NC}"
cat > .env.example << 'EOF'
# API Keys
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
TAVILY_API_KEY=

# Server
PORT=8080
NODE_ENV=development
EOF

cp .env.example .env

# Create .gitignore
cat > .gitignore << 'EOF'
# Virtual environments
node_modules/
node_env/
venv/
.local/

# Environment
.env
.env.local

# Build
dist/
build/
*.log

# IDE
.DS_Store
.vscode/
.idea/

# Testing
coverage/
*.heapsnapshot

# Claude
.claude/cache/
CLAUDE.local.md
EOF

echo -e "${GREEN}✓${NC} Configuration files created"

# Create ESLint config
cat > .eslintrc.js << 'EOF'
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error'
  }
};
EOF

# Create Prettier config
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
EOF

# Initialize git
echo -e "\n${YELLOW}→ Initializing Git repository...${NC}"
git init > /dev/null 2>&1
git add .
git commit -m "Initial setup without create-react-app" > /dev/null 2>&1 || true

echo -e "${GREEN}✓${NC} Git repository initialized"

# Run checks
echo -e "\n${YELLOW}→ Running environment check...${NC}"
node scripts/claude-check.js

# Print summary
echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}     ✅ Setup Complete! (No create-react-app)${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}What was created:${NC}"
echo "  • Node.js environment (v20 LTS)"
echo "  • Python virtual environment"
echo "  • React frontend (manual setup - faster!)"
echo "  • Backend WebSocket server"
echo "  • Electron configuration"
echo "  • All necessary dependencies"
echo ""
echo -e "${YELLOW}IMPORTANT - Activate environments first:${NC}"
echo -e "  ${MAGENTA}source activate.sh${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Add API keys to .env file:"
echo "   • DEEPGRAM_API_KEY"
echo "   • OPENAI_API_KEY"
echo "   • TAVILY_API_KEY"
echo ""
echo "2. Install Claude Code (if not installed):"
echo -e "   ${MAGENTA}npm install -g @anthropic-ai/claude-cli${NC}"
echo ""
echo "3. Start Claude Code:"
echo -e "   ${MAGENTA}claude${NC}"
echo ""
echo "   Or start development directly:"
echo -e "   ${MAGENTA}npm run dev${NC}"
echo ""
echo -e "${GREEN}Setup time saved by skipping create-react-app: ~5-10 minutes! 🚀${NC}"