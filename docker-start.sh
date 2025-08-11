#!/bin/bash

echo "Starting Meeting Intelligence Assistant with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create one with your API keys."
    echo "Required keys: DEEPGRAM_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY"
    exit 1
fi

# Use development compose for hot-reload
if [ "$1" == "dev" ]; then
    echo "Starting in development mode with hot-reload..."
    docker-compose -f docker-compose.dev.yml up --build
else
    echo "Starting in production mode..."
    docker-compose up --build -d
    echo "Services started in background."
    echo "Frontend: http://localhost:4000"
    echo "Backend: http://localhost:9000"
    echo "Use 'docker-compose logs -f' to view logs"
fi