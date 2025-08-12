#!/bin/bash

# TranscriptIQ Development Mode Script
# This script runs the application in development mode with hot reloading

echo "🚀 Starting TranscriptIQ in development mode..."
echo "   - Frontend will auto-rebuild on file changes"
echo "   - Backend will restart on file changes"
echo ""

# Check and fetch secrets if needed (with caching)
if [ -f ./scripts/fetch-secrets-cached.sh ]; then
    echo "🔐 Checking API keys..."
    ./scripts/fetch-secrets-cached.sh
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: Could not fetch/validate API keys"
    fi
elif [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Please create it with your API keys."
    echo ""
fi

# Stop any existing containers
echo "📦 Stopping existing containers..."
docker-compose down
docker-compose -f docker-compose.dev.yml down

# Start in development mode
echo "🔨 Starting development containers..."
docker-compose -f docker-compose.dev.yml up --build

echo ""
echo "✅ Development environment started!"
echo "   Frontend: http://localhost:4000"
echo "   Backend:  http://localhost:9000"
echo ""
echo "   Press Ctrl+C to stop"