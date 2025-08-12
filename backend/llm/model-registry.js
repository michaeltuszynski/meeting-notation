const axios = require('axios');

class ModelRegistry {
  constructor() {
    this.modelCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  async getAvailableModels(provider, apiKey) {
    // Check cache first
    const cacheKey = `${provider}_models`;
    const cached = this.modelCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`[ModelRegistry] Using cached models for ${provider}`);
      return cached.models;
    }

    console.log(`[ModelRegistry] Fetching fresh models for ${provider}`);
    
    try {
      let models = [];
      
      switch (provider) {
        case 'openai':
          models = await this.fetchOpenAIModels(apiKey);
          break;
        case 'anthropic':
          models = await this.fetchAnthropicModels(apiKey);
          break;
        case 'gemini':
          models = await this.fetchGeminiModels(apiKey);
          break;
        default:
          models = this.getDefaultModels(provider);
      }
      
      // Cache the results
      this.modelCache.set(cacheKey, {
        models,
        timestamp: Date.now()
      });
      
      return models;
    } catch (error) {
      console.error(`[ModelRegistry] Error fetching models for ${provider}:`, error.message);
      // Return default models on error
      return this.getDefaultModels(provider);
    }
  }

  async fetchOpenAIModels(apiKey) {
    if (!apiKey || apiKey === '***configured***') {
      return this.getDefaultModels('openai');
    }

    try {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      // Filter for GPT models and format them
      const gptModels = response.data.data
        .filter(model => 
          model.id.includes('gpt') && 
          !model.id.includes('instruct') &&
          !model.id.includes('vision-preview')
        )
        .map(model => ({
          value: model.id,
          label: this.formatModelLabel('openai', model.id),
          capabilities: this.getModelCapabilities('openai', model.id)
        }))
        .sort((a, b) => {
          // Sort with newest/best models first
          const order = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
          return order.indexOf(a.value.split('-20')[0]) - order.indexOf(b.value.split('-20')[0]);
        });

      return gptModels.length > 0 ? gptModels : this.getDefaultModels('openai');
    } catch (error) {
      console.error('[ModelRegistry] OpenAI API error:', error.response?.data || error.message);
      return this.getDefaultModels('openai');
    }
  }

  async fetchAnthropicModels(apiKey) {
    if (!apiKey || apiKey === '***configured***') {
      return this.getDefaultModels('anthropic');
    }

    try {
      // Fetch models from Anthropic's API
      const response = await axios.get('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      if (response.data && response.data.data) {
        const models = response.data.data
          .filter(model => model.type === 'model') // Filter for model type
          .map(model => ({
            value: model.id,
            label: this.formatAnthropicModelLabel(model.id, model.display_name),
            capabilities: {
              maxTokens: this.getAnthropicMaxTokens(model.id),
              vision: this.hasVisionSupport(model.id)
            }
          }))
          .sort((a, b) => {
            // Sort by version number and variant
            const getOrder = (id) => {
              if (id.includes('opus-4-1')) return 0;
              if (id.includes('opus-4')) return 1;
              if (id.includes('sonnet-4')) return 2;
              if (id.includes('3-7')) return 3;
              if (id.includes('3-5')) return 4;
              if (id.includes('claude-3')) return 5;
              return 6;
            };
            return getOrder(a.value) - getOrder(b.value);
          });

        console.log(`[ModelRegistry] Fetched ${models.length} Anthropic models from API`);
        return models.length > 0 ? models : this.getDefaultModels('anthropic');
      }
      
      // If the endpoint doesn't return expected format, fall back to defaults
      return this.getDefaultModels('anthropic');
      
    } catch (error) {
      // If the API call fails, use defaults
      console.error('[ModelRegistry] Error fetching Anthropic models:', error.message);
      return this.getDefaultModels('anthropic');
    }
  }
  
  getAnthropicMaxTokens(modelId) {
    // Claude 4 models have larger context windows
    if (modelId.includes('opus-4')) return 200000;
    if (modelId.includes('sonnet-4')) return 200000;
    if (modelId.includes('3-7')) return 100000;
    if (modelId.includes('3-5')) return 8192;
    if (modelId.includes('claude-3')) return 4096;
    return 8192;
  }
  
  hasVisionSupport(modelId) {
    // Most Claude 3+ models support vision
    return modelId.includes('claude-3') || modelId.includes('claude-4') || 
           modelId.includes('opus') || modelId.includes('sonnet');
  }

  formatAnthropicModelLabel(modelId, displayName) {
    // Use display name if available, otherwise format the ID
    if (displayName) return displayName;
    
    const labels = {
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (Fast, Capable)',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku (Fastest)',
      'claude-3-opus-20240229': 'Claude 3 Opus (Most Capable)',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet (Balanced)',
      'claude-3-haiku-20240307': 'Claude 3 Haiku (Fast, Efficient)'
    };
    
    return labels[modelId] || modelId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async fetchGeminiModels(apiKey) {
    if (!apiKey || apiKey === '***configured***') {
      return this.getDefaultModels('gemini');
    }

    try {
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      const models = response.data.models
        .filter(model => 
          model.supportedGenerationMethods?.includes('generateContent') &&
          !model.name.includes('embedding')
        )
        .map(model => ({
          value: model.name.replace('models/', ''),
          label: this.formatModelLabel('gemini', model.displayName || model.name),
          capabilities: {
            maxTokens: model.outputTokenLimit || 8192,
            vision: model.name.includes('vision') || model.name.includes('pro')
          }
        }))
        .sort((a, b) => {
          // Sort with Pro models first, then Flash
          if (a.value.includes('pro') && !b.value.includes('pro')) return -1;
          if (!a.value.includes('pro') && b.value.includes('pro')) return 1;
          return b.value.localeCompare(a.value);
        });

      return models.length > 0 ? models : this.getDefaultModels('gemini');
    } catch (error) {
      console.error('[ModelRegistry] Gemini API error:', error.response?.data || error.message);
      return this.getDefaultModels('gemini');
    }
  }

  getDefaultModels(provider) {
    const defaults = {
      openai: [
        { value: 'gpt-4o', label: 'GPT-4o (Latest)', capabilities: { maxTokens: 128000, vision: true } },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cost-effective)', capabilities: { maxTokens: 128000, vision: true } },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', capabilities: { maxTokens: 128000, vision: true } },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', capabilities: { maxTokens: 16385, vision: false } }
      ],
      anthropic: [
        { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (Latest)', capabilities: { maxTokens: 200000, vision: true } },
        { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', capabilities: { maxTokens: 200000, vision: true } },
        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', capabilities: { maxTokens: 200000, vision: true } },
        { value: 'claude-3-7-sonnet-20250219', label: 'Claude Sonnet 3.7', capabilities: { maxTokens: 100000, vision: true } },
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude Sonnet 3.5', capabilities: { maxTokens: 8192, vision: true } }
      ],
      gemini: [
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', capabilities: { maxTokens: 8192, vision: true } },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)', capabilities: { maxTokens: 8192, vision: true } },
        { value: 'gemini-pro', label: 'Gemini Pro', capabilities: { maxTokens: 8192, vision: false } }
      ]
    };
    
    return defaults[provider] || [];
  }

  formatModelLabel(provider, modelId) {
    // Clean up model IDs for display
    const cleanId = modelId.replace('models/', '').replace('gpt-', 'GPT-');
    
    // Add descriptive suffixes
    if (modelId.includes('4o') && modelId.includes('mini')) return `${cleanId} (Cost-effective, Fast)`;
    if (modelId.includes('4o')) return `${cleanId} (Latest, Most Capable)`;
    if (modelId.includes('turbo')) return `${cleanId} (Fast, Powerful)`;
    if (modelId.includes('gemini') && modelId.includes('flash')) return `${cleanId} (Fast, Efficient)`;
    if (modelId.includes('gemini') && modelId.includes('pro')) return `${cleanId} (Most Capable)`;
    
    return cleanId;
  }

  getModelCapabilities(provider, modelId) {
    // Return known capabilities for models
    const capabilities = {
      'gpt-4o': { maxTokens: 128000, vision: true },
      'gpt-4o-mini': { maxTokens: 128000, vision: true },
      'gpt-4-turbo': { maxTokens: 128000, vision: true },
      'gpt-4': { maxTokens: 8192, vision: false },
      'gpt-3.5-turbo': { maxTokens: 16385, vision: false }
    };
    
    return capabilities[modelId] || { maxTokens: 4096, vision: false };
  }

  clearCache() {
    this.modelCache.clear();
    console.log('[ModelRegistry] Model cache cleared');
  }
}

module.exports = ModelRegistry;