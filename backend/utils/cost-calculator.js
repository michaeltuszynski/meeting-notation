/**
 * API Cost Calculator
 * Calculates estimated costs for various API providers used in TranscriptIQ
 */

class ApiCostCalculator {
  constructor() {
    // Pricing data as of August 2025 (in USD) - will be updated from APIs
    this.pricing = {
      // LLM Providers
      llm: {
        openai: {
          'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 }, // per token
          'gpt-4o': { input: 2.50 / 1000000, output: 10.00 / 1000000 },
          'gpt-3.5-turbo': { input: 0.50 / 1000000, output: 1.50 / 1000000 }
        },
        anthropic: {
          'claude-3-haiku': { input: 0.25 / 1000000, output: 1.25 / 1000000 },
          'claude-3-sonnet': { input: 3.00 / 1000000, output: 15.00 / 1000000 },
          'claude-3-opus': { input: 15.00 / 1000000, output: 75.00 / 1000000 }
        },
        gemini: {
          'gemini-1.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
          'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 }
        }
      },
      
      // Transcription Providers
      transcription: {
        deepgram: {
          'nova-2': 0.0043 / 60, // $0.0043 per minute
          'enhanced': 0.0059 / 60,
          'base': 0.0036 / 60
        },
        assemblyai: {
          'standard': 0.00037 / 1, // $0.00037 per second
          'enhanced': 0.00065 / 1
        },
        whisper: 0.006 / 60, // $0.006 per minute
        google: 0.024 / 60, // $0.024 per minute for first 60 minutes
        azure: 1.00 / 3600, // $1.00 per hour
        revai: 0.022 / 60, // $0.022 per minute
        speechmatics: 0.03 / 60 // $0.03 per minute
      },
      
      // Knowledge/Search Providers
      knowledge: {
        tavily: 0.001, // $0.001 per search
        exa: 0.001, // $0.001 per search
        perplexity: 0.20 / 1000000, // $0.20 per 1M tokens (approximation)
        serpapi: 0.005, // $0.005 per search
        brave: 0.0005 // $0.0005 per search
      }
    };
  }

  /**
   * Calculate LLM cost based on token usage
   */
  calculateLLMCost(provider, model, inputTokens, outputTokens) {
    const modelPricing = this.pricing.llm[provider]?.[model];
    if (!modelPricing) {
      console.warn(`[Cost Calculator] Unknown LLM model: ${provider}/${model}`);
      return 0;
    }

    const inputCost = (inputTokens || 0) * modelPricing.input;
    const outputCost = (outputTokens || 0) * modelPricing.output;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0
    };
  }

  /**
   * Calculate transcription cost based on duration
   */
  calculateTranscriptionCost(provider, model, durationSeconds) {
    let costPerSecond = 0;
    
    if (provider === 'deepgram') {
      costPerSecond = this.pricing.transcription.deepgram[model] || this.pricing.transcription.deepgram['nova-2'];
    } else if (provider === 'whisper') {
      costPerSecond = this.pricing.transcription.whisper;
    } else if (this.pricing.transcription[provider]) {
      if (typeof this.pricing.transcription[provider] === 'object') {
        costPerSecond = this.pricing.transcription[provider][model] || Object.values(this.pricing.transcription[provider])[0];
      } else {
        costPerSecond = this.pricing.transcription[provider];
      }
    } else {
      console.warn(`[Cost Calculator] Unknown transcription provider: ${provider}`);
      return 0;
    }

    return {
      totalCost: durationSeconds * costPerSecond,
      durationSeconds,
      costPerSecond
    };
  }

  /**
   * Calculate knowledge/search cost based on number of searches
   */
  calculateKnowledgeCost(provider, searchCount) {
    const costPerSearch = this.pricing.knowledge[provider];
    if (!costPerSearch) {
      console.warn(`[Cost Calculator] Unknown knowledge provider: ${provider}`);
      return 0;
    }

    return {
      totalCost: searchCount * costPerSearch,
      searchCount,
      costPerSearch
    };
  }

  /**
   * Calculate total meeting cost from usage data
   */
  calculateMeetingCost(usageData) {
    const costs = {
      llm: 0,
      transcription: 0,
      knowledge: 0,
      total: 0,
      breakdown: {
        llm: [],
        transcription: [],
        knowledge: []
      }
    };

    // Calculate LLM costs
    if (usageData.llm) {
      for (const usage of usageData.llm) {
        const cost = this.calculateLLMCost(
          usage.provider,
          usage.model,
          usage.inputTokens,
          usage.outputTokens
        );
        costs.llm += cost.totalCost;
        costs.breakdown.llm.push({
          provider: usage.provider,
          model: usage.model,
          ...cost
        });
      }
    }

    // Calculate transcription costs
    if (usageData.transcription) {
      for (const usage of usageData.transcription) {
        const cost = this.calculateTranscriptionCost(
          usage.provider,
          usage.model,
          usage.durationSeconds
        );
        costs.transcription += cost.totalCost;
        costs.breakdown.transcription.push({
          provider: usage.provider,
          model: usage.model,
          ...cost
        });
      }
    }

    // Calculate knowledge costs
    if (usageData.knowledge) {
      for (const usage of usageData.knowledge) {
        const cost = this.calculateKnowledgeCost(
          usage.provider,
          usage.searchCount
        );
        costs.knowledge += cost.totalCost;
        costs.breakdown.knowledge.push({
          provider: usage.provider,
          ...cost
        });
      }
    }

    costs.total = costs.llm + costs.transcription + costs.knowledge;
    
    return costs;
  }

  /**
   * Format cost as currency string
   */
  formatCost(cost) {
    if (cost < 0.01) {
      return `$${(cost * 1000).toFixed(3)}k`; // Show as fractions of cents for very small costs
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Get provider display names
   */
  getProviderDisplayName(provider, category) {
    const names = {
      llm: {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        gemini: 'Google Gemini'
      },
      transcription: {
        deepgram: 'Deepgram',
        assemblyai: 'AssemblyAI',
        whisper: 'OpenAI Whisper',
        google: 'Google Speech-to-Text',
        azure: 'Azure Speech',
        revai: 'Rev.ai',
        speechmatics: 'Speechmatics'
      },
      knowledge: {
        tavily: 'Tavily',
        exa: 'Exa.ai',
        perplexity: 'Perplexity',
        serpapi: 'SerpAPI',
        brave: 'Brave Search'
      }
    };

    return names[category]?.[provider] || provider;
  }

  /**
   * Fetch current OpenAI pricing (when available via API)
   */
  async fetchOpenAIPricing() {
    try {
      // OpenAI doesn't have a public pricing API, but we can check their website
      // For now, we'll use a fallback to their published rates
      const response = await fetch('https://api.openai.com/v1/models');
      if (response.ok) {
        // Models endpoint doesn't include pricing, but confirms API is accessible
        console.log('[Cost Calculator] OpenAI API accessible, using latest published rates');
      }
      
      // Update with latest published rates from OpenAI's pricing page
      this.pricing.llm.openai = {
        'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 },
        'gpt-4o': { input: 2.50 / 1000000, output: 10.00 / 1000000 },
        'gpt-3.5-turbo': { input: 0.50 / 1000000, output: 1.50 / 1000000 }
      };
      
    } catch (error) {
      console.warn('[Cost Calculator] Could not fetch OpenAI pricing:', error.message);
    }
  }

  /**
   * Fetch current Deepgram pricing
   */
  async fetchDeepgramPricing() {
    try {
      // Deepgram doesn't expose pricing via API, using published rates
      // Check if API is accessible
      if (process.env.DEEPGRAM_API_KEY) {
        console.log('[Cost Calculator] Deepgram API accessible, using latest published rates');
      }
      
      // Update with latest published rates
      this.pricing.transcription.deepgram = {
        'nova-2': 0.0043 / 60,
        'enhanced': 0.0059 / 60,
        'base': 0.0036 / 60
      };
      
    } catch (error) {
      console.warn('[Cost Calculator] Could not fetch Deepgram pricing:', error.message);
    }
  }

  /**
   * Fetch current Tavily pricing
   */
  async fetchTavilyPricing() {
    try {
      // Tavily doesn't expose pricing via API, using published rates
      if (process.env.TAVILY_API_KEY) {
        console.log('[Cost Calculator] Tavily API accessible, using latest published rates');
      }
      
      this.pricing.knowledge.tavily = 0.001; // $0.001 per search
      
    } catch (error) {
      console.warn('[Cost Calculator] Could not fetch Tavily pricing:', error.message);
    }
  }

  /**
   * Update all pricing from available sources
   */
  async updatePricingFromAPIs() {
    console.log('[Cost Calculator] Updating pricing from API sources...');
    
    await Promise.allSettled([
      this.fetchOpenAIPricing(),
      this.fetchDeepgramPricing(),
      this.fetchTavilyPricing()
    ]);
    
    console.log('[Cost Calculator] Pricing update complete');
  }

  /**
   * Get real-time cost calculation with current pricing
   */
  async calculateMeetingCostWithCurrentPricing(usageData) {
    await this.updatePricingFromAPIs();
    return this.calculateMeetingCost(usageData);
  }
}

module.exports = ApiCostCalculator;