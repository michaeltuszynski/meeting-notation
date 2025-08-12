const axios = require('axios');
const Redis = require('ioredis');

class TavilyService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    this.apiUrl = 'https://api.tavily.com/search';
    
    // Initialize Redis for caching
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    this.redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    
    this.redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
    
    // Performance tracking
    this.metrics = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLatency: 0,
      lastLatency: 0,
      averageLatency: 0,
      errors: 0
    };
    
    this.usageTracking = {
      totalApiCalls: 0,
      totalCost: 0
    };
    
    // Rate limiting
    this.searchQueue = [];
    this.isProcessing = false;
    this.minSearchInterval = 100; // 100ms between API calls
    this.lastSearchTime = 0;
    
    // Cache settings
    this.cacheTTL = 86400; // 24 hours in seconds
  }
  
  async searchTerms(terms) {
    if (!terms || terms.length === 0) {
      return [];
    }
    
    const startTime = Date.now();
    const results = [];
    
    for (const term of terms) {
      try {
        const definition = await this.searchTerm(term);
        if (definition) {
          results.push({
            term,
            definition,
            source: definition.cached ? 'cache' : 'api'
          });
        }
      } catch (error) {
        console.error(`[Tavily] Error searching for "${term}":`, error.message);
      }
    }
    
    const latency = Date.now() - startTime;
    this.updateMetrics(latency, false);
    
    console.log(`[Tavily] Searched ${terms.length} terms in ${latency}ms`);
    
    return results;
  }
  
  async searchTerm(term) {
    if (!term || typeof term !== 'string') {
      return null;
    }
    
    const cacheKey = `term:${term.toLowerCase()}`;
    
    // Check cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return { 
          ...JSON.parse(cached), 
          cached: true 
        };
      }
    } catch (error) {
      console.error('[Redis] Cache read error:', error.message);
    }
    
    // Cache miss - search via API
    this.metrics.cacheMisses++;
    
    // Rate limiting
    const now = Date.now();
    const timeSinceLastSearch = now - this.lastSearchTime;
    if (timeSinceLastSearch < this.minSearchInterval) {
      await this.delay(this.minSearchInterval - timeSinceLastSearch);
    }
    
    try {
      this.lastSearchTime = Date.now();
      
      const response = await axios.post(this.apiUrl, {
        api_key: this.apiKey,
        query: `define "${term}" technical term meaning`,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
        include_raw_content: false,
        include_images: false
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Track API usage and cost
      this.usageTracking.totalApiCalls += 1;
      this.usageTracking.totalCost += 0.001; // $0.001 per search
      
      console.log(`[Tavily] API call made for "${term}" - Total calls: ${this.usageTracking.totalApiCalls}, Cost: $${this.usageTracking.totalCost.toFixed(4)}`);
      
      if (response.data && response.data.answer) {
        const definition = {
          summary: this.extractDefinition(response.data.answer, term),
          sources: response.data.results?.slice(0, 2).map(r => ({
            title: r.title,
            url: r.url
          })) || [],
          timestamp: Date.now()
        };
        
        // Cache the result
        try {
          await this.redis.setex(
            cacheKey,
            this.cacheTTL,
            JSON.stringify(definition)
          );
        } catch (error) {
          console.error('[Redis] Cache write error:', error.message);
        }
        
        return definition;
      }
      
      return null;
      
    } catch (error) {
      this.metrics.errors++;
      console.error('[Tavily] API error:', error.response?.data || error.message);
      return null;
    }
  }
  
  extractDefinition(text, term) {
    // Extract a concise definition from the answer
    const maxLength = 200;
    
    // Try to find the first sentence that contains the term
    const sentences = text.split(/[.!?]+/);
    const relevantSentence = sentences.find(s => 
      s.toLowerCase().includes(term.toLowerCase())
    ) || sentences[0];
    
    // Trim to max length
    if (relevantSentence.length > maxLength) {
      return relevantSentence.substring(0, maxLength) + '...';
    }
    
    return relevantSentence.trim();
  }
  
  updateMetrics(latency, isError) {
    this.metrics.totalSearches++;
    this.metrics.totalLatency += latency;
    this.metrics.lastLatency = latency;
    this.metrics.averageLatency = 
      this.metrics.totalLatency / this.metrics.totalSearches;
    
    if (isError) {
      this.metrics.errors++;
    }
    
    // Log warning if latency exceeds target
    if (latency > 1000) {
      console.warn(`[Tavily] Latency ${latency}ms exceeds 1000ms target`);
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      ...this.usageTracking,
      cacheHitRate: this.metrics.cacheHits / 
        (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }
  
  getUsageForMeeting() {
    return {
      provider: 'tavily',
      searchCount: this.usageTracking.totalApiCalls,
      totalCost: this.usageTracking.totalCost
    };
  }
  
  resetUsageTracking() {
    this.usageTracking = {
      totalApiCalls: 0,
      totalCost: 0
    };
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async clearCache() {
    try {
      const keys = await this.redis.keys('term:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Redis] Cleared ${keys.length} cached terms`);
      }
    } catch (error) {
      console.error('[Redis] Cache clear error:', error.message);
    }
  }
  
  async disconnect() {
    await this.redis.quit();
  }
}

module.exports = TavilyService;