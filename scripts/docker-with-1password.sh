#!/bin/bash

# Run Docker Compose with 1Password integration
# This script fetches secrets and starts the application

set -e

VAULT="TranscriptIQ"

echo "🔐 TranscriptIQ Docker with 1Password Integration"
echo "=================================================="

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo "❌ Error: 1Password CLI is not installed"
    echo "Install from: https://developer.1password.com/docs/cli/get-started"
    exit 1
fi

# Check if user is signed in
if ! op account list &>/dev/null; then
    echo "📝 Signing in to 1Password..."
    eval $(op signin)
fi

# Fetch latest secrets
echo ""
echo "🔑 Fetching secrets from 1Password..."
./scripts/fetch-secrets.sh

# Check if .env file was created
if [ ! -f .env ]; then
    echo "❌ Error: Failed to create .env file"
    exit 1
fi

# Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
docker-compose down

# Determine which compose file to use
if [ "$1" == "dev" ] || [ "$1" == "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "🚀 Starting in DEVELOPMENT mode..."
else
    COMPOSE_FILE="docker-compose.yml"
    echo "🚀 Starting in PRODUCTION mode..."
fi

# Start containers with fresh secrets
echo "📦 Starting containers with compose file: $COMPOSE_FILE"
docker-compose -f "$COMPOSE_FILE" up --build -d

# Show container status
echo ""
echo "✅ Containers started successfully!"
echo ""
docker-compose ps

echo ""
echo "📊 Application URLs:"
echo "  - Frontend: http://localhost:4000"
echo "  - Backend API: http://localhost:9000"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "📝 Logs: docker-compose logs -f"
echo "🛑 Stop: docker-compose down"