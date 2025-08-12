const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMProviderFactory {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.currentModel = null;
    this.settings = {
      llmProvider: process.env.LLM_PROVIDER || 'openai',
      llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY
    };
    
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize OpenAI if API key is available
    if (this.settings.openaiApiKey) {
      this.providers.set('openai', {
        client: new OpenAI({ apiKey: this.settings.openaiApiKey }),
        type: 'openai'
      });
    }

    // Initialize Anthropic if API key is available
    if (this.settings.anthropicApiKey) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this.providers.set('anthropic', {
          client: new Anthropic({ apiKey: this.settings.anthropicApiKey }),
          type: 'anthropic'
        });
      } catch (e) {
        console.log('[LLM Provider] Anthropic SDK not installed, skipping initialization');
      }
    }

    // Initialize Google Gemini if API key is available
    if (this.settings.geminiApiKey) {
      try {
        this.providers.set('gemini', {
          client: new GoogleGenerativeAI(this.settings.geminiApiKey),
          type: 'gemini'
        });
      } catch (e) {
        console.log('[LLM Provider] Google Generative AI SDK not installed, skipping initialization');
      }
    }

    // Set current provider
    this.setProvider(this.settings.llmProvider, this.settings.llmModel);
  }

  updateSettings(newSettings) {
    let needsReinit = false;

    // Check if API keys have changed
    if (newSettings.openaiApiKey && newSettings.openaiApiKey !== '***configured***' && 
        newSettings.openaiApiKey !== this.settings.openaiApiKey) {
      this.settings.openaiApiKey = newSettings.openaiApiKey;
      needsReinit = true;
    }

    if (newSettings.anthropicApiKey && newSettings.anthropicApiKey !== '***configured***' && 
        newSettings.anthropicApiKey !== this.settings.anthropicApiKey) {
      this.settings.anthropicApiKey = newSettings.anthropicApiKey;
      needsReinit = true;
    }

    if (newSettings.geminiApiKey && newSettings.geminiApiKey !== '***configured***' && 
        newSettings.geminiApiKey !== this.settings.geminiApiKey) {
      this.settings.geminiApiKey = newSettings.geminiApiKey;
      needsReinit = true;
    }

    // Update provider and model
    if (newSettings.llmProvider) {
      this.settings.llmProvider = newSettings.llmProvider;
    }
    if (newSettings.llmModel) {
      this.settings.llmModel = newSettings.llmModel;
    }

    if (needsReinit) {
      this.initializeProviders();
    } else {
      this.setProvider(this.settings.llmProvider, this.settings.llmModel);
    }
  }

  setProvider(providerName, modelName) {
    if (!this.providers.has(providerName)) {
      console.error(`[LLM Provider] Provider ${providerName} not available. Falling back to OpenAI.`);
      providerName = 'openai';
    }

    this.currentProvider = providerName;
    this.currentModel = modelName || this.getDefaultModel(providerName);
    
    console.log(`[LLM Provider] Active provider: ${this.currentProvider}, model: ${this.currentModel}`);
  }

  getDefaultModel(provider) {
    const defaults = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      gemini: 'gemini-1.5-flash'
    };
    return defaults[provider] || 'gpt-4o-mini';
  }

  async createCompletion(messages, options = {}) {
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not initialized`);
    }

    try {
      switch (provider.type) {
        case 'openai':
          return await this.createOpenAICompletion(provider.client, messages, options);
        
        case 'anthropic':
          return await this.createAnthropicCompletion(provider.client, messages, options);
        
        case 'gemini':
          return await this.createGeminiCompletion(provider.client, messages, options);
        
        default:
          throw new Error(`Unknown provider type: ${provider.type}`);
      }
    } catch (error) {
      console.error(`[LLM Provider] Error with ${this.currentProvider}:`, error.message);
      throw error;
    }
  }

  async createOpenAICompletion(client, messages, options) {
    const response = await client.chat.completions.create({
      model: this.currentModel,
      messages: messages,
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 500,
      ...(options.responseFormat && { response_format: options.responseFormat })
    });

    return {
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model
    };
  }

  async createAnthropicCompletion(client, messages, options) {
    // Convert OpenAI format to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    // Anthropic expects alternating user/assistant messages
    const anthropicMessages = userMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const response = await client.messages.create({
      model: this.currentModel,
      messages: anthropicMessages,
      system: systemMessage ? systemMessage.content : undefined,
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 500
    });

    // Parse JSON if response format is JSON
    let content = response.content[0].text;
    if (options.responseFormat && options.responseFormat.type === 'json_object') {
      try {
        // Ensure the response is valid JSON
        JSON.parse(content);
      } catch (e) {
        // If not valid JSON, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }
      }
    }

    return {
      content: content,
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      model: response.model
    };
  }

  async createGeminiCompletion(client, messages, options) {
    // Get the appropriate model
    const model = client.getGenerativeModel({ model: this.currentModel });
    
    // Convert OpenAI format to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    // Combine messages into a single prompt
    let prompt = '';
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`;
    }
    
    userMessages.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    });

    // Add instruction for JSON output if needed
    if (options.responseFormat && options.responseFormat.type === 'json_object') {
      prompt += '\nPlease respond with valid JSON only.';
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature || 0.3,
        maxOutputTokens: options.maxTokens || 500,
        topP: 0.8,
        topK: 40
      }
    });

    const response = await result.response;
    let content = response.text();

    // Parse JSON if response format is JSON
    if (options.responseFormat && options.responseFormat.type === 'json_object') {
      try {
        // Ensure the response is valid JSON
        JSON.parse(content);
      } catch (e) {
        // If not valid JSON, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }
      }
    }

    return {
      content: content,
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0
      },
      model: this.currentModel
    };
  }

  getActiveProvider() {
    return {
      provider: this.currentProvider,
      model: this.currentModel
    };
  }

  isProviderAvailable(providerName) {
    return this.providers.has(providerName);
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }
}

module.exports = LLMProviderFactory;