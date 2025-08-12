# TranscriptIQ Project Structure

```
meeting-notation/
├── electron/                    # Electron main application
│   ├── main.js                 # Main process entry point
│   ├── preload.js              # Preload script for security
│   └── icon.png                # Application icon
│
├── electron-audio-bridge/       # Separate Electron audio capture app
│   ├── main.js                 # Electron main process
│   ├── renderer.js             # Audio capture logic
│   ├── preload.js              # Security bridge
│   └── styles.css              # UI styles
│
├── backend/                     # Node.js backend server
│   ├── server.js               # Main server entry point
│   ├── db/                     # Database related
│   │   └── connection.js       # PostgreSQL connection pool
│   ├── llm/                    # LLM integrations
│   │   ├── contextual-intelligence.js  # Context analysis engine
│   │   └── openai.js           # OpenAI API integration
│   ├── knowledge/              # Knowledge retrieval
│   │   └── tavily.js           # Tavily API integration
│   ├── routes/                 # API endpoints
│   │   └── meetings.js         # Meeting CRUD operations
│   ├── services/               # Business logic
│   │   ├── meeting.js          # Meeting management
│   │   ├── report.js           # Report generation
│   │   └── storage.js          # Data persistence
│   ├── transcription/          # Speech-to-text
│   │   └── deepgram.js         # Deepgram WebSocket integration
│   ├── utils/                  # Utilities
│   │   └── logger.js           # Winston logger configuration
│   └── websocket/              # WebSocket handling
│       └── handlers.js         # Socket.io event handlers
│
├── frontend/                    # React application
│   ├── public/                 # Static assets
│   │   ├── index.html          # Main HTML template
│   │   └── bundle.js           # Compiled JavaScript
│   ├── src/                    # Source code
│   │   ├── App.jsx             # Main React component
│   │   ├── index.js            # Entry point
│   │   └── components/         # React components
│   │       ├── ui/             # shadcn/ui components
│   │       ├── MeetingSidebar.jsx      # Meeting navigation
│   │       ├── ContextualInsights.jsx  # Real-time insights
│   │       ├── DefinitionHistory.jsx   # Term tracking
│   │       ├── ReportView.jsx          # Meeting reports
│   │       └── Settings.jsx            # Global settings
│   ├── webpack.config.js       # Webpack configuration
│   └── package.json            # Frontend dependencies
│
├── scripts/                     # Utility scripts
│   ├── latency-check.js        # Performance verification
│   └── claude-check.js         # Claude configuration check
│
├── tests/                       # Test files
│   └── *.test.js               # Jest test files
│
├── docs/                        # Documentation
│   └── (various documentation files)
│
├── config/                      # Configuration files
│   └── (configuration files)
│
├── monitoring/                  # Monitoring tools
│   └── (monitoring scripts)
│
├── shared/                      # Shared utilities
│   └── (shared code between frontend/backend)
│
├── Configuration Files (root)
├── .env.example                # Environment variable template
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── .gitignore                  # Git ignore rules
├── .dockerignore               # Docker ignore rules
├── .nvmrc                      # Node version specification
├── package.json                # Root dependencies and scripts
├── package-lock.json           # Dependency lock file
├── docker-compose.yml          # Production Docker config
├── docker-compose.dev.yml      # Development Docker config
├── activate.sh                 # Environment activation script
├── docker-start.sh             # Docker startup script
│
└── Documentation Files (root)
    ├── CLAUDE.md               # Claude Code instructions
    ├── PROJECT_STATUS.md       # Current project status
    ├── IMPLEMENTATION_NOTES.md # Implementation details
    └── DOCKER.md               # Docker documentation
```

## Key Architectural Decisions

1. **Hybrid Architecture**: Electron for clean audio capture, Docker for backend services
2. **Microservices Pattern**: Separate services for transcription, LLM, knowledge retrieval
3. **Real-time Communication**: WebSocket for low-latency updates
4. **Caching Strategy**: Redis for performance optimization
5. **Database Design**: PostgreSQL with UUID primary keys and proper indexing
6. **Frontend Build**: Manual Webpack setup (no Create React App)
7. **Component Library**: shadcn/ui for professional UI components