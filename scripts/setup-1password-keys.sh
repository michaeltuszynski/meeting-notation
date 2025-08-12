#!/bin/bash

# Setup 1Password items for TranscriptIQ API keys
# This script creates all API key entries in the TranscriptIQ vault

VAULT="TranscriptIQ"

echo "Setting up API keys in 1Password vault: $VAULT"
echo "============================================"

# Function to create or update an API key item
create_api_key() {
    local title="$1"
    local category="$2"
    local field_name="$3"
    local current_value="$4"
    local description="$5"
    
    echo "Creating item: $title"
    
    # Check if item already exists
    if op item get "$title" --vault "$VAULT" &>/dev/null; then
        echo "  Item already exists, skipping..."
    else
        # Create the item with the API key
        if [ -n "$current_value" ] && [ "$current_value" != "your_*" ] && [ "$current_value" != "" ]; then
            op item create \
                --vault "$VAULT" \
                --category "API Credential" \
                --title "$title" \
                --tags "$category,api-key" \
                "$field_name=$current_value" \
                "notes=$description"
            echo "  ✓ Created with existing key"
        else
            # Create placeholder
            op item create \
                --vault "$VAULT" \
                --category "API Credential" \
                --title "$title" \
                --tags "$category,api-key" \
                "$field_name=PLACEHOLDER_UPDATE_ME" \
                "notes=$description"
            echo "  ✓ Created placeholder (update in 1Password)"
        fi
    fi
}

# Read current .env file to get existing keys
if [ -f .env ]; then
    source .env
fi

echo ""
echo "Creating LLM Provider API Keys..."
echo "----------------------------------"
create_api_key \
    "OpenAI API Key" \
    "llm" \
    "credential" \
    "$OPENAI_API_KEY" \
    "OpenAI API key for GPT-4o models"

create_api_key \
    "Anthropic API Key" \
    "llm" \
    "credential" \
    "$ANTHROPIC_API_KEY" \
    "Anthropic API key for Claude models"

create_api_key \
    "Google Gemini API Key" \
    "llm" \
    "credential" \
    "$GEMINI_API_KEY" \
    "Google API key for Gemini models"

echo ""
echo "Creating Transcription Provider API Keys..."
echo "-------------------------------------------"
create_api_key \
    "Deepgram API Key" \
    "transcription" \
    "credential" \
    "$DEEPGRAM_API_KEY" \
    "Deepgram API key for real-time transcription"

create_api_key \
    "AssemblyAI API Key" \
    "transcription" \
    "credential" \
    "$ASSEMBLYAI_API_KEY" \
    "AssemblyAI API key for high-accuracy transcription"

create_api_key \
    "Google Speech API Key" \
    "transcription" \
    "credential" \
    "$GOOGLE_SPEECH_API_KEY" \
    "Google Cloud Speech-to-Text API key"

create_api_key \
    "Azure Speech Key" \
    "transcription" \
    "credential" \
    "$AZURE_SPEECH_KEY" \
    "Azure Cognitive Services Speech key"

create_api_key \
    "Azure Speech Region" \
    "transcription" \
    "region" \
    "$AZURE_SPEECH_REGION" \
    "Azure region for Speech Services (e.g., eastus)"

create_api_key \
    "Rev.ai API Key" \
    "transcription" \
    "credential" \
    "$REVAI_API_KEY" \
    "Rev.ai API key for professional transcription"

create_api_key \
    "Speechmatics API Key" \
    "transcription" \
    "credential" \
    "$SPEECHMATICS_API_KEY" \
    "Speechmatics API key for multilingual transcription"

echo ""
echo "Creating Knowledge Provider API Keys..."
echo "---------------------------------------"
create_api_key \
    "Tavily API Key" \
    "knowledge" \
    "credential" \
    "$TAVILY_API_KEY" \
    "Tavily API key for AI-powered search"

create_api_key \
    "Exa API Key" \
    "knowledge" \
    "credential" \
    "$EXA_API_KEY" \
    "Exa.ai API key for neural search"

create_api_key \
    "Perplexity API Key" \
    "knowledge" \
    "credential" \
    "$PERPLEXITY_API_KEY" \
    "Perplexity API key for AI answers"

create_api_key \
    "SerpAPI Key" \
    "knowledge" \
    "credential" \
    "$SERPAPI_KEY" \
    "SerpAPI key for Google search results"

create_api_key \
    "Brave API Key" \
    "knowledge" \
    "credential" \
    "$BRAVE_API_KEY" \
    "Brave Search API key"


echo ""
echo "Creating Database Credentials..."
echo "--------------------------------"
create_api_key \
    "PostgreSQL Password" \
    "database" \
    "password" \
    "$POSTGRES_PASSWORD" \
    "PostgreSQL database password for TranscriptIQ"

echo ""
echo "============================================"
echo "✅ 1Password vault setup complete!"
echo ""
echo "Next steps:"
echo "1. Review items in 1Password app"
echo "2. Update any PLACEHOLDER values with actual API keys"
echo "3. Run './scripts/fetch-secrets.sh' to load keys from 1Password"
echo ""
echo "Vault ID: $VAULT"