# TranscriptIQ Development Commands

## Environment Setup
```bash
source activate.sh        # Activate Node.js and Python environments
```

## Development
```bash
npm run dev               # Start all services (backend, frontend, electron)
npm run dev:backend       # Start backend server only
npm run dev:frontend      # Start frontend dev server only
npm run dev:electron      # Start Electron app only
```

## Docker Operations
```bash
npm run docker:dev        # Start development with Docker
npm run docker:prod       # Start production with Docker
npm run docker:build      # Build Docker images
npm run docker:up         # Start Docker containers
npm run docker:down       # Stop Docker containers
npm run docker:logs       # View Docker logs
npm run docker:clean      # Clean Docker volumes
```

## Testing
```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run test:integration  # Run integration tests only
npm run test:perf         # Run performance tests
npm run perf:check        # Verify latency targets
```

## Code Quality
```bash
npm run lint              # Run ESLint
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Format code with Prettier
```

## Building
```bash
npm run build             # Build frontend and Electron
npm run build:frontend    # Build frontend only
npm run build:electron    # Build Electron app only
```

## Debugging
```bash
npm run debug:memory      # Run server with memory debugging
npm run claude:check      # Check Claude configuration
```

## Git Operations (Darwin/macOS)
```bash
git status               # Check repository status
git add .                # Stage all changes
git commit -m "message"  # Commit changes
git push                 # Push to remote
git pull                 # Pull from remote
```

## File Operations (Darwin/macOS)
```bash
ls -la                   # List all files with details
cd <directory>           # Change directory
pwd                      # Print working directory
cat <file>               # Display file contents
grep -r "pattern" .      # Search for pattern recursively
find . -name "*.js"      # Find files by pattern
```