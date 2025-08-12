#!/bin/bash

# TranscriptIQ Production Mode Script
# This script runs the application in production mode with optimized builds

echo "🚀 Starting TranscriptIQ in production mode..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Please create it with your API keys."
    echo ""
fi

# Stop any existing containers
echo "📦 Stopping existing containers..."
docker-compose down
docker-compose -f docker-compose.dev.yml down

# Start in production mode
echo "🔨 Building and starting production containers..."
docker-compose up --build -d

echo ""
echo "✅ Production environment started!"
echo "   Frontend: http://localhost:4000"
echo "   Backend:  http://localhost:9000"
echo ""
echo "   Run 'docker-compose logs -f' to view logs"
echo "   Run 'docker-compose down' to stop"