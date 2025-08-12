const OpenAI = require('openai');

class GPT4oMiniService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.extractionWindow = [];
    this.windowDuration = 10000; // 10 second window
    this.lastExtraction = 0; // Start at 0 to allow immediate first extraction
    this.minExtractionInterval = 3000; // Extract every 3 seconds minimum
    
    this.performanceMetrics = {
      totalExtractions: 0,
      totalLatency: 0,
      errors: 0,
      lastLatency: 0,
      averageLatency: 0
    };
    
    this.usageTracking = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      callCount: 0
    };
    
    this.systemPrompt = `You are a meeting intelligence assistant that extracts key technical terms, acronyms, and important concepts from meeting transcripts.

Extract ONLY:
- Technical terms and jargon
- Acronyms and abbreviations
- Product names and features
- Important concepts being discussed
- Action items or decisions

Output format: JSON object with a "terms" key containing an array of terms.
Example: {"terms": ["API", "Kubernetes", "deployment pipeline", "Q4 roadmap"]}

Keep extractions concise - maximum 10 terms per response.`;
  }
  
  addTranscript(text, timestamp = Date.now()) {
    this.extractionWindow.push({ text, timestamp });
    
    // Remove old transcripts outside window
    const cutoff = timestamp - this.windowDuration;
    this.extractionWindow = this.extractionWindow.filter(t => t.timestamp > cutoff);
  }
  
  shouldExtract() {
    const now = Date.now();
    const timeSinceLastExtraction = now - this.lastExtraction;
    const hasEnoughText = this.extractionWindow.length >= 2; // At least 2 transcript segments
    
    console.log(`[GPT-4o Mini] Check extraction: segments=${this.extractionWindow.length}, timeSince=${timeSinceLastExtraction}ms, minInterval=${this.minExtractionInterval}ms`);
    
    return timeSinceLastExtraction >= this.minExtractionInterval && hasEnoughText;
  }
  
  async extractTerms() {
    if (!this.shouldExtract()) {
      return null;
    }
    
    const startTime = Date.now();
    this.lastExtraction = startTime;
    
    try {
      // Combine recent transcripts
      const combinedText = this.extractionWindow
        .map(t => t.text)
        .join(' ')
        .slice(-2000); // Limit to last 2000 chars for token efficiency
      
      if (combinedText.trim().length < 50) {
        return null; // Not enough meaningful text
      }
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Extract key terms from this transcript segment:\n\n${combinedText}` }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });
      
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);
      
      // Track token usage from response
      if (response.usage) {
        this.usageTracking.totalInputTokens += response.usage.prompt_tokens || 0;
        this.usageTracking.totalOutputTokens += response.usage.completion_tokens || 0;
        this.usageTracking.callCount += 1;
        
        // Calculate cost (we'll update with real pricing periodically)
        const inputCost = (response.usage.prompt_tokens || 0) * (0.15 / 1000000); // $0.15/1M tokens
        const outputCost = (response.usage.completion_tokens || 0) * (0.60 / 1000000); // $0.60/1M tokens
        this.usageTracking.totalCost += inputCost + outputCost;
        
        console.log(`[GPT-4o Mini] Tokens: ${response.usage.prompt_tokens} in, ${response.usage.completion_tokens} out, Cost: $${(inputCost + outputCost).toFixed(6)}`);
      }
      
      try {
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        const terms = Array.isArray(parsed.terms) ? parsed.terms : 
                     Array.isArray(parsed) ? parsed : [];
        
        console.log(`[GPT-4o Mini] Extracted ${terms.length} terms in ${latency}ms`);
        
        // Clear processed transcripts
        this.extractionWindow = [];
        
        return {
          terms,
          latency,
          timestamp: startTime,
          tokenUsage: response.usage
        };
      } catch (parseError) {
        console.error('[GPT-4o Mini] Failed to parse response:', parseError);
        return null;
      }
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, true);
      console.error('[GPT-4o Mini] Extraction error:', error.message);
      return null;
    }
  }
  
  updateMetrics(latency, isError) {
    this.performanceMetrics.totalExtractions++;
    this.performanceMetrics.totalLatency += latency;
    this.performanceMetrics.lastLatency = latency;
    this.performanceMetrics.averageLatency = 
      this.performanceMetrics.totalLatency / this.performanceMetrics.totalExtractions;
    
    if (isError) {
      this.performanceMetrics.errors++;
    }
    
    // Log warning if latency exceeds target
    if (latency > 500) {
      console.warn(`[GPT-4o Mini] Latency ${latency}ms exceeds 500ms target`);
    }
  }
  
  getMetrics() {
    return {
      ...this.performanceMetrics,
      ...this.usageTracking,
      windowSize: this.extractionWindow.length,
      lastExtraction: new Date(this.lastExtraction).toISOString()
    };
  }
  
  getUsageForMeeting() {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: this.usageTracking.totalInputTokens,
      outputTokens: this.usageTracking.totalOutputTokens,
      totalCost: this.usageTracking.totalCost,
      callCount: this.usageTracking.callCount
    };
  }
  
  reset() {
    this.extractionWindow = [];
    this.lastExtraction = Date.now();
    // Reset usage tracking for new meeting
    this.usageTracking = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      callCount: 0
    };
  }
}

module.exports = GPT4oMiniService;