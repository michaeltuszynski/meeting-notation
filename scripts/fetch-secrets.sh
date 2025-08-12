#!/bin/bash

# Fetch secrets from 1Password and create .env file
# This script retrieves all API keys from the TranscriptIQ vault

VAULT="TranscriptIQ"
ENV_FILE=".env"
ENV_TEMPLATE=".env.template"

echo "Fetching secrets from 1Password vault: $VAULT"
echo "============================================"

# Check if user is signed in to 1Password
if ! op account list &>/dev/null; then
    echo "❌ Error: Not signed in to 1Password"
    echo "Please run: eval \$(op signin)"
    exit 1
fi

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

# Create .env file with secrets from 1Password
cat > "$ENV_FILE" << EOF
# ================================================
# TranscriptIQ Environment Configuration
# Generated from 1Password vault: $VAULT
# Generated at: $(date)
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

echo ""
echo "✅ Environment file created: $ENV_FILE"
echo ""

# Count configured vs missing keys
total_keys=0
configured_keys=0

while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]] && [[ "$key" =~ _KEY|_PASSWORD ]]; then
        total_keys=$((total_keys + 1))
        if [[ -n "$value" ]] && [[ "$value" != "" ]]; then
            configured_keys=$((configured_keys + 1))
            echo "✓ $key: Configured"
        else
            echo "⚠ $key: Not configured (update in 1Password)"
        fi
    fi
done < "$ENV_FILE"

echo ""
echo "Summary: $configured_keys/$total_keys API keys configured"
echo ""

# Create .env.template for reference
cat > "$ENV_TEMPLATE" << 'EOF'
# ================================================
# TranscriptIQ Environment Template
# Copy this to .env and run: ./scripts/fetch-secrets.sh
# ================================================

# LLM API Keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Transcription API Keys
DEEPGRAM_API_KEY=
ASSEMBLYAI_API_KEY=
GOOGLE_SPEECH_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
REVAI_API_KEY=
SPEECHMATICS_API_KEY=

# Knowledge/Search API Keys
TAVILY_API_KEY=
EXA_API_KEY=
PERPLEXITY_API_KEY=
SERPAPI_KEY=
BRAVE_API_KEY=

# Provider Selection (defaults)
TRANSCRIPTION_PROVIDER=deepgram
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
KNOWLEDGE_PROVIDER=tavily

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=transcriptiq_intelligence
POSTGRES_USER=transcriptiq_user
POSTGRES_PASSWORD=

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

NODE_ENV=development
EOF

echo "Template file created: $ENV_TEMPLATE"