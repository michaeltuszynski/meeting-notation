#!/bin/bash

# Fetch secrets from 1Password with intelligent caching for development
# This script only fetches from 1Password if the cache is stale or missing

VAULT="TranscriptIQ"
ENV_FILE=".env"
ENV_CACHE=".env.cache"
CACHE_METADATA=".env.cache.json"
CACHE_HOURS=${CACHE_HOURS:-24}  # Default 24 hour cache
FORCE_REFRESH=${1:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 TranscriptIQ Secrets Manager (Development Mode)${NC}"
echo "=================================================="

# Function to check if cache is valid
is_cache_valid() {
    if [ "$FORCE_REFRESH" == "--force" ] || [ "$FORCE_REFRESH" == "-f" ]; then
        echo -e "${YELLOW}⚡ Force refresh requested${NC}"
        return 1
    fi
    
    if [ ! -f "$ENV_FILE" ] || [ ! -f "$CACHE_METADATA" ]; then
        echo -e "${YELLOW}📭 No cache found${NC}"
        return 1
    fi
    
    # Check cache age
    if [ -f "$CACHE_METADATA" ]; then
        cache_timestamp=$(grep '"timestamp"' "$CACHE_METADATA" | sed 's/.*: \([0-9]*\).*/\1/')
        current_timestamp=$(date +%s)
        cache_age_seconds=$((current_timestamp - cache_timestamp))
        cache_age_hours=$((cache_age_seconds / 3600))
        
        if [ $cache_age_hours -lt $CACHE_HOURS ]; then
            echo -e "${GREEN}✅ Using cached secrets (${cache_age_hours}h old, expires in $((CACHE_HOURS - cache_age_hours))h)${NC}"
            echo -e "${BLUE}💡 Tip: Use './scripts/fetch-secrets-cached.sh --force' to refresh${NC}"
            return 0
        else
            echo -e "${YELLOW}⏰ Cache expired (${cache_age_hours}h old)${NC}"
            return 1
        fi
    fi
    
    return 1
}

# Function to create cache metadata
create_cache_metadata() {
    cat > "$CACHE_METADATA" << EOF
{
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "timestamp": $(date +%s),
  "cache_hours": $CACHE_HOURS,
  "vault": "$VAULT",
  "machine": "$(hostname)",
  "user": "$(whoami)"
}
EOF
}

# Function to check 1Password availability
check_1password() {
    if ! command -v op &> /dev/null; then
        echo -e "${RED}❌ Error: 1Password CLI is not installed${NC}"
        echo "Install from: https://developer.1password.com/docs/cli/get-started"
        
        # Check if we have a cached version
        if [ -f "$ENV_FILE" ]; then
            echo -e "${YELLOW}⚠️  Using existing .env file (may be outdated)${NC}"
            exit 0
        else
            exit 1
        fi
    fi
    
    # Check if user is signed in
    if ! op account list &>/dev/null; then
        echo -e "${YELLOW}📝 Not signed in to 1Password${NC}"
        
        # In development, use cache if available
        if [ -f "$ENV_FILE" ]; then
            echo -e "${GREEN}✅ Using cached .env file${NC}"
            echo -e "${BLUE}💡 To update: eval \$(op signin) && ./scripts/fetch-secrets-cached.sh --force${NC}"
            exit 0
        else
            echo -e "${RED}❌ No cached credentials available${NC}"
            echo "Please run: eval \$(op signin)"
            exit 1
        fi
    fi
    
    return 0
}

# Function to get secret value from 1Password
get_secret() {
    local item_title="$1"
    local field_name="$2"
    
    # Fetch the secret value with --reveal flag
    value=$(op item get "$item_title" --vault "$VAULT" --fields "$field_name" --reveal 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$value" ] && [ "$value" != "PLACEHOLDER_UPDATE_ME" ]; then
        echo "$value"
    else
        echo ""
    fi
}

# Function to fetch from 1Password
fetch_from_1password() {
    echo -e "${BLUE}🔄 Fetching fresh secrets from 1Password...${NC}"
    
    # Create .env file with secrets from 1Password
    cat > "$ENV_FILE" << EOF
# ================================================
# TranscriptIQ Environment Configuration
# Generated from 1Password vault: $VAULT
# Generated at: $(date)
# Cache expires: $CACHE_HOURS hours from now
# ================================================

# LLM API Keys
OPENAI_API_KEY=$(get_secret "OpenAI API Key" "credential")
ANTHROPIC_API_KEY=$(get_secret "Anthropic API Key" "credential")
GEMINI_API_KEY=$(get_secret "Google Gemini API Key" "credential")

# Transcription API Keys
DEEPGRAM_API_KEY=$(get_secret "Deepgram API Key" "credential")
ASSEMBLYAI_API_KEY=$(get_secret "AssemblyAI API Key" "credential")
GOOGLE_SPEECH_API_KEY=$(get_secret "Google Speech API Key" "credential")
AZURE_SPEECH_KEY=$(get_secret "Azure Speech Key" "credential")
AZURE_SPEECH_REGION=$(get_secret "Azure Speech Region" "region")
REVAI_API_KEY=$(get_secret "Rev.ai API Key" "credential")
SPEECHMATICS_API_KEY=$(get_secret "Speechmatics API Key" "credential")

# Knowledge/Search API Keys
TAVILY_API_KEY=$(get_secret "Tavily API Key" "credential")
EXA_API_KEY=$(get_secret "Exa API Key" "credential")
PERPLEXITY_API_KEY=$(get_secret "Perplexity API Key" "credential")
SERPAPI_KEY=$(get_secret "SerpAPI Key" "credential")
BRAVE_API_KEY=$(get_secret "Brave API Key" "credential")

# Provider Selection (defaults)
TRANSCRIPTION_PROVIDER=deepgram
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
KNOWLEDGE_PROVIDER=tavily

# Database Configuration (for local development)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=transcriptiq_intelligence
POSTGRES_USER=transcriptiq_user
POSTGRES_PASSWORD=$(get_secret "PostgreSQL Password" "password")

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

NODE_ENV=development
EOF

    # Create backup cache
    cp "$ENV_FILE" "$ENV_CACHE"
    
    # Create metadata
    create_cache_metadata
    
    echo -e "${GREEN}✅ Secrets fetched and cached successfully${NC}"
}

# Main logic
main() {
    # Check if we can use cache
    if is_cache_valid; then
        # Cache is valid, nothing to do
        exit 0
    fi
    
    # Check 1Password availability (will use cache if not available)
    check_1password
    
    # Fetch from 1Password
    fetch_from_1password
    
    # Show summary
    echo ""
    echo -e "${BLUE}📊 Summary:${NC}"
    
    # Count configured keys
    total_keys=0
    configured_keys=0
    
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]] && [[ "$key" =~ _KEY|_PASSWORD ]]; then
            total_keys=$((total_keys + 1))
            if [[ -n "$value" ]] && [[ "$value" != "" ]]; then
                configured_keys=$((configured_keys + 1))
            fi
        fi
    done < "$ENV_FILE"
    
    echo -e "  ${GREEN}✓${NC} Configured: $configured_keys API keys"
    echo -e "  ${YELLOW}⚠${NC}  Missing: $((total_keys - configured_keys)) API keys"
    echo -e "  ${BLUE}⏰${NC} Cache valid for: ${CACHE_HOURS} hours"
    echo ""
    echo -e "${BLUE}💡 Tips:${NC}"
    echo "  • Force refresh: ./scripts/fetch-secrets-cached.sh --force"
    echo "  • Change cache duration: CACHE_HOURS=48 ./scripts/fetch-secrets-cached.sh"
    echo "  • View cache info: cat .env.cache.json"
}

# Run main function
main