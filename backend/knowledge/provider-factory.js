const axios = require('axios');

class KnowledgeProviderFactory {
  constructor() {
    this.providers = new Map();
    this.currentProvider = process.env.KNOWLEDGE_PROVIDER || 'tavily';
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize Tavily
    if (process.env.TAVILY_API_KEY) {
      this.providers.set('tavily', {
        type: 'tavily',
        apiKey: process.env.TAVILY_API_KEY,
        name: 'Tavily',
        description: 'AI-powered search API optimized for LLMs'
      });
    }

    // Initialize Exa.ai
    if (process.env.EXA_API_KEY) {
      this.providers.set('exa', {
        type: 'exa',
        apiKey: process.env.EXA_API_KEY,
        name: 'Exa.ai',
        description: 'Neural search engine for finding similar and relevant content'
      });
    }

    // Initialize Perplexity
    if (process.env.PERPLEXITY_API_KEY) {
      this.providers.set('perplexity', {
        type: 'perplexity',
        apiKey: process.env.PERPLEXITY_API_KEY,
        name: 'Perplexity',
        description: 'AI-powered answer engine with real-time web access'
      });
    }

    // Initialize SerpAPI (Google Search)
    if (process.env.SERPAPI_KEY) {
      this.providers.set('serpapi', {
        type: 'serpapi',
        apiKey: process.env.SERPAPI_KEY,
        name: 'SerpAPI',
        description: 'Google Search results API'
      });
    }

    // Initialize Brave Search
    if (process.env.BRAVE_API_KEY) {
      this.providers.set('brave', {
        type: 'brave',
        apiKey: process.env.BRAVE_API_KEY,
        name: 'Brave Search',
        description: 'Privacy-focused search API'
      });
    }


    console.log(`[Knowledge Provider] Initialized ${this.providers.size} providers`);
    console.log(`[Knowledge Provider] Active provider: ${this.currentProvider}`);
  }

  async search(query, options = {}) {
    const provider = this.providers.get(this.currentProvider);
    
    if (!provider) {
      console.error(`[Knowledge Provider] Provider ${this.currentProvider} not configured`);
      return [];
    }

    try {
      switch (provider.type) {
        case 'tavily':
          return await this.searchTavily(provider, query, options);
        case 'exa':
          return await this.searchExa(provider, query, options);
        case 'perplexity':
          return await this.searchPerplexity(provider, query, options);
        case 'serpapi':
          return await this.searchSerpAPI(provider, query, options);
        case 'brave':
          return await this.searchBrave(provider, query, options);
        default:
          throw new Error(`Unknown provider type: ${provider.type}`);
      }
    } catch (error) {
      console.error(`[Knowledge Provider] Error with ${provider.type}:`, error.message);
      throw error;
    }
  }

  async searchTavily(provider, query, options) {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: provider.apiKey,
      query: query,
      search_depth: options.depth || 'basic',
      include_answer: true,
      include_raw_content: false,
      max_results: options.maxResults || 5
    });

    return this.formatResults(response.data.results, 'tavily', response.data.answer);
  }

  async searchExa(provider, query, options) {
    // Exa.ai uses neural search for finding similar content
    const response = await axios.post('https://api.exa.ai/search', {
      query: query,
      num_results: options.maxResults || 10,
      use_autoprompt: true,
      type: options.searchType || 'neural', // 'neural' or 'keyword'
      include_text: true
    }, {
      headers: {
        'x-api-key': provider.apiKey,
        'Content-Type': 'application/json'
      }
    });

    const results = response.data.results || [];
    return this.formatResults(results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.substring(0, 500),
      score: r.score
    })), 'exa');
  }

  async searchPerplexity(provider, query, options) {
    // Perplexity API for AI-powered answers
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'pplx-70b-online', // or 'pplx-7b-online' for faster
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides accurate, sourced information.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      stream: false,
      max_tokens: options.maxTokens || 1000
    }, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const answer = response.data.choices[0].message.content;
    
    // Perplexity includes citations in the response
    return [{
      type: 'answer',
      content: answer,
      provider: 'perplexity',
      sources: this.extractPerplexitySources(answer)
    }];
  }

  async searchSerpAPI(provider, query, options) {
    const params = new URLSearchParams({
      q: query,
      api_key: provider.apiKey,
      engine: 'google',
      num: options.maxResults || 10,
      hl: 'en',
      gl: 'us'
    });

    const response = await axios.get(`https://serpapi.com/search?${params}`);
    
    const results = response.data.organic_results || [];
    return this.formatResults(results.map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: r.source
    })), 'serpapi');
  }

  async searchBrave(provider, query, options) {
    const params = new URLSearchParams({
      q: query,
      count: options.maxResults || 10,
      freshness: options.freshness || 'all', // 'pd' (past day), 'pw' (past week), 'pm' (past month)
      text_decorations: false
    });

    const response = await axios.get(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'X-Subscription-Token': provider.apiKey,
        'Accept': 'application/json'
      }
    });

    const results = response.data.web?.results || [];
    return this.formatResults(results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      age: r.age
    })), 'brave');
  }


  formatResults(results, provider, answer = null) {
    const formatted = {
      provider: provider,
      timestamp: new Date(),
      answer: answer,
      results: results.map(r => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.snippet || r.description || '',
        metadata: {
          score: r.score,
          source: r.source,
          age: r.age,
          datePublished: r.datePublished
        }
      }))
    };

    return formatted;
  }

  extractPerplexitySources(text) {
    // Extract [1], [2], etc. citations from Perplexity responses
    const citations = [];
    const regex = /\[(\d+)\]/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      citations.push(parseInt(match[1]));
    }
    
    return [...new Set(citations)].sort((a, b) => a - b);
  }

  async searchTermDefinitions(terms, provider = null) {
    const searchProvider = provider || this.currentProvider;
    const definitions = [];

    for (const term of terms) {
      try {
        const searchQuery = `define "${term}" technical definition explanation`;
        const results = await this.search(searchQuery, { 
          maxResults: 3,
          depth: 'basic'
        });

        if (results.answer) {
          definitions.push({
            term: term,
            definition: results.answer,
            sources: results.results.slice(0, 3).map(r => ({
              title: r.title,
              url: r.url
            })),
            provider: searchProvider
          });
        } else if (results.results && results.results.length > 0) {
          // Combine snippets if no direct answer
          const combinedDefinition = results.results
            .slice(0, 2)
            .map(r => r.snippet)
            .join(' ');
          
          definitions.push({
            term: term,
            definition: combinedDefinition,
            sources: results.results.slice(0, 3).map(r => ({
              title: r.title,
              url: r.url
            })),
            provider: searchProvider
          });
        }
      } catch (error) {
        console.error(`[Knowledge Provider] Error searching for term "${term}":`, error.message);
      }
    }

    return definitions;
  }

  setProvider(providerName) {
    if (this.providers.has(providerName)) {
      this.currentProvider = providerName;
      console.log(`[Knowledge Provider] Switched to ${providerName}`);
      return true;
    }
    
    console.error(`[Knowledge Provider] Provider ${providerName} not available`);
    return false;
  }

  getAvailableProviders() {
    return Array.from(this.providers.entries()).map(([key, provider]) => ({
      id: key,
      name: provider.name,
      description: provider.description,
      active: key === this.currentProvider
    }));
  }

  getCurrentProvider() {
    return {
      id: this.currentProvider,
      ...this.providers.get(this.currentProvider)
    };
  }

  updateSettings(settings) {
    if (settings.knowledgeProvider && this.providers.has(settings.knowledgeProvider)) {
      this.setProvider(settings.knowledgeProvider);
    }
    
    // Update API keys if provided
    if (settings.tavilyApiKey && settings.tavilyApiKey !== '***configured***') {
      this.updateProviderKey('tavily', settings.tavilyApiKey);
    }
    if (settings.exaApiKey && settings.exaApiKey !== '***configured***') {
      this.updateProviderKey('exa', settings.exaApiKey);
    }
    if (settings.perplexityApiKey && settings.perplexityApiKey !== '***configured***') {
      this.updateProviderKey('perplexity', settings.perplexityApiKey);
    }
  }

  updateProviderKey(providerName, apiKey) {
    if (this.providers.has(providerName)) {
      this.providers.get(providerName).apiKey = apiKey;
      console.log(`[Knowledge Provider] Updated API key for ${providerName}`);
    }
  }
}

module.exports = KnowledgeProviderFactory;