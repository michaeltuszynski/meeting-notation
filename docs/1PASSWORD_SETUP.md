# 1Password Integration for TranscriptIQ

This document describes how TranscriptIQ integrates with 1Password for secure API key management.

## Overview

TranscriptIQ uses 1Password to securely store and manage all API keys and credentials. This ensures:
- Secrets are never stored in code or version control
- Easy rotation and management of API keys
- Secure sharing among team members
- Automated secret injection for development and production

## Prerequisites

1. **1Password CLI**: Install from [1Password Developer](https://developer.1password.com/docs/cli/get-started)
   ```bash
   # macOS
   brew install --cask 1password-cli
   
   # Verify installation
   op --version
   ```

2. **1Password Account**: Sign in to your account
   ```bash
   eval $(op signin)
   ```

## Vault Structure

All TranscriptIQ secrets are stored in a dedicated vault called `TranscriptIQ` with the following structure:

### LLM Providers
- OpenAI API Key
- Anthropic API Key
- Google Gemini API Key

### Transcription Providers
- Deepgram API Key
- AssemblyAI API Key
- Google Speech API Key
- Azure Speech Key & Region
- Rev.ai API Key
- Speechmatics API Key

### Knowledge/Search Providers
- Tavily API Key
- Exa API Key
- Perplexity API Key
- SerpAPI Key
- Brave API Key

### Database
- PostgreSQL Password

## Initial Setup

### 1. Create the Vault and Populate Keys

Run the setup script to create all necessary items in 1Password:

```bash
./scripts/setup-1password-keys.sh
```

This will:
- Create the TranscriptIQ vault if it doesn't exist
- Add all API key items with existing values from .env
- Create placeholders for missing keys

### 2. Update Missing Keys

Open 1Password and navigate to the TranscriptIQ vault to:
- Review all created items
- Update any PLACEHOLDER values with actual API keys
- Add any additional API keys as needed

## Daily Usage

### Development Mode with Caching

For development, use the cached version to avoid repeated 1Password authentication:

```bash
# Uses cached secrets if less than 24 hours old
./scripts/fetch-secrets-cached.sh

# Force refresh (bypass cache)
./scripts/fetch-secrets-cached.sh --force

# Custom cache duration (48 hours)
CACHE_HOURS=48 ./scripts/fetch-secrets-cached.sh
```

**Cache Features:**
- ✅ Auto-uses cache if valid (default: 24 hours)
- ⚡ Works offline if cache exists
- 🔄 Auto-refreshes when expired
- 💾 Stores backup in `.env.cache`
- 📊 Metadata in `.env.cache.json`

### Production Mode (No Cache)

For production or when you need fresh secrets:

```bash
./scripts/fetch-secrets.sh
```

This always fetches fresh secrets from 1Password.

### Start with Docker

Use the integrated Docker script that automatically fetches secrets:

```bash
# Development mode
./scripts/docker-with-1password.sh dev

# Production mode
./scripts/docker-with-1password.sh
```

### Manual Docker Compose

```bash
# Fetch secrets first
./scripts/fetch-secrets.sh

# Then start normally
docker-compose up
```

## Adding New API Keys

### 1. Add to 1Password

```bash
op item create \
    --vault "TranscriptIQ" \
    --category "API Credential" \
    --title "New Service API Key" \
    --tags "category-tag,api-key" \
    credential="your-api-key-here" \
    "notes=Description of the service"
```

### 2. Update Fetch Script

Edit `scripts/fetch-secrets.sh` to include the new key:

```bash
NEW_SERVICE_API_KEY=$(get_secret "New Service API Key" "credential")
```

### 3. Update Application Code

Add the new environment variable to your application configuration.

## Security Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Rotate keys regularly** - Update in 1Password, then re-fetch
3. **Use read-only access** - For production, use 1Password Service Accounts
4. **Audit access** - Review vault access in 1Password admin panel
5. **Environment separation** - Use different vaults for dev/staging/production

## Production Deployment

For production deployments, use 1Password Service Accounts:

### 1. Create Service Account

In 1Password admin:
1. Go to Settings → Service Accounts
2. Create new service account for TranscriptIQ
3. Grant read access to TranscriptIQ vault
4. Save the token

### 2. Configure CI/CD

Add to your CI/CD environment variables:
```bash
OP_SERVICE_ACCOUNT_TOKEN=<your-service-account-token>
```

### 3. Use in Docker

```dockerfile
# In Dockerfile or docker-compose
RUN op run --env-file=".env.template" -- printenv > .env
```

## Troubleshooting

### Not signed in to 1Password
```bash
eval $(op signin)
```

### Vault not found
```bash
op vault list
```

### Item not found
```bash
op item list --vault TranscriptIQ
```

### View a specific secret
```bash
op item get "OpenAI API Key" --vault TranscriptIQ --reveal
```

### Update a secret
```bash
op item edit "OpenAI API Key" --vault TranscriptIQ credential="new-key-value"
```

## Benefits

- **Security**: Secrets never stored in code
- **Convenience**: One command to fetch all secrets
- **Team Collaboration**: Easy sharing via 1Password
- **Audit Trail**: Track who accessed which secrets
- **Rotation**: Update keys in one place
- **Multi-environment**: Different vaults for dev/prod

## Support

For issues with 1Password integration:
1. Check 1Password CLI is installed and updated
2. Verify you're signed in: `op account list`
3. Check vault access: `op vault get TranscriptIQ`
4. Review logs: `op --debug item list --vault TranscriptIQ`