const LLMProviderFactory = require('./provider-factory');

class ContextualIntelligenceService {
  constructor() {
    this.llmProvider = new LLMProviderFactory();
    
    // Per-meeting context management
    this.meetings = new Map(); // Store data per meetingId
    this.currentMeetingId = null;
    
    // Sliding windows for different purposes
    this.shortTermWindow = 30000; // 30 seconds for immediate context
    this.mediumTermWindow = 120000; // 2 minutes for current topic
    this.longTermWindow = 300000; // 5 minutes for broader context
    
    // Processing intervals
    this.lastProcessing = 0;
    this.minProcessingInterval = 5000; // Process every 5 seconds
    
    // Performance metrics
    this.metrics = {
      totalExtractions: 0,
      totalLatency: 0,
      averageLatency: 0,
      conceptsIdentified: 0,
      insightsGenerated: 0
    };
  }
  
  /**
   * Set the current active meeting
   */
  setCurrentMeeting(meetingId) {
    this.currentMeetingId = meetingId;
    if (!this.meetings.has(meetingId)) {
      this.meetings.set(meetingId, {
        conversationContext: [],
        conceptMap: new Map(),
        meetingGlossary: new Map(),
        topicFlow: [],
        lastProcessing: 0
      });
    }
  }
  
  /**
   * Get meeting data for current meeting
   */
  getMeetingData() {
    if (!this.currentMeetingId || !this.meetings.has(this.currentMeetingId)) {
      return null;
    }
    return this.meetings.get(this.currentMeetingId);
  }
  
  /**
   * Add transcript to context with timestamp
   */
  addTranscript(text, timestamp = Date.now()) {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      console.warn('[Contextual Intelligence] No active meeting set');
      return;
    }
    
    meetingData.conversationContext.push({
      text,
      timestamp,
      processed: false
    });
    
    // Clean old context beyond long-term window
    const cutoff = timestamp - this.longTermWindow;
    meetingData.conversationContext = meetingData.conversationContext.filter(c => c.timestamp > cutoff);
  }
  
  /**
   * Extract rich contextual information from recent conversation
   */
  async extractContextualInsights() {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return null;
    }
    
    const now = Date.now();
    if (now - meetingData.lastProcessing < this.minProcessingInterval) {
      return null;
    }
    
    meetingData.lastProcessing = now;
    const startTime = now;
    
    try {
      // Get different context windows
      const immediateContext = this.getContextWindow(this.shortTermWindow);
      const currentTopicContext = this.getContextWindow(this.mediumTermWindow);
      const broaderContext = this.getContextWindow(this.longTermWindow);
      
      // Skip if not enough context
      if (immediateContext.length < 20) {
        return null;
      }
      
      // Extract comprehensive insights
      const insights = await this.processContext(
        immediateContext,
        currentTopicContext,
        broaderContext
      );
      
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, insights);
      
      return {
        ...insights,
        latency,
        timestamp: startTime
      };
      
    } catch (error) {
      console.error('[Contextual Intelligence] Extraction error:', error);
      return null;
    }
  }
  
  /**
   * Process context to extract insights
   */
  async processContext(immediate, current, broader) {
    const prompt = `Analyze this meeting conversation and provide contextual intelligence.

IMMEDIATE CONTEXT (last 30 seconds):
${immediate}

CURRENT TOPIC (last 2 minutes):
${current.slice(-500)}

INSTRUCTIONS:
1. Extract KEY CONCEPTS as complete thoughts (not just keywords)
2. Identify the CURRENT TOPIC being discussed
3. Generate CONTEXTUAL DEFINITIONS based on how terms are used in THIS meeting
4. Suggest CLARIFYING QUESTIONS the listener might want to ask
5. Identify potential ACTION ITEMS or decisions
6. Detect any ACRONYMS or technical terms that need explanation

Output as JSON with this structure:
{
  "currentTopic": "Brief description of what's being discussed now",
  "concepts": [
    {
      "concept": "Complete concept or idea",
      "context": "How it relates to the discussion",
      "importance": "high|medium|low"
    }
  ],
  "contextualDefinitions": {
    "term": "Meeting-specific definition based on usage"
  },
  "suggestedQuestions": [
    "Relevant question to better understand the topic"
  ],
  "potentialActions": [
    "Detected action item or decision"
  ],
  "acronyms": {
    "ACRONYM": "Likely expansion based on context"
  },
  "needsClarification": [
    "Topics that seem unclear or contradictory"
  ]
}`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: 'You are a meeting intelligence assistant providing real-time contextual insights.' },
        { role: 'user', content: prompt }
      ],
      {
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: { type: "json_object" }
      }
    );
    
    const insights = JSON.parse(response.content);
    
    // Update internal knowledge base
    this.updateKnowledgeBase(insights);
    
    return insights;
  }
  
  /**
   * Get context window for specified duration
   */
  getContextWindow(duration) {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return '';
    }
    
    const cutoff = Date.now() - duration;
    return meetingData.conversationContext
      .filter(c => c.timestamp > cutoff)
      .map(c => c.text)
      .join(' ');
  }
  
  /**
   * Update internal knowledge base with new insights
   */
  updateKnowledgeBase(insights) {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return;
    }
    
    // Update meeting glossary with contextual definitions
    if (insights.contextualDefinitions) {
      Object.entries(insights.contextualDefinitions).forEach(([term, definition]) => {
        meetingData.meetingGlossary.set(term.toLowerCase(), {
          definition,
          timestamp: Date.now(),
          context: insights.currentTopic
        });
      });
    }
    
    // Track topic flow
    if (insights.currentTopic) {
      const lastTopic = meetingData.topicFlow[meetingData.topicFlow.length - 1];
      if (!lastTopic || lastTopic.topic !== insights.currentTopic) {
        meetingData.topicFlow.push({
          topic: insights.currentTopic,
          timestamp: Date.now()
        });
      }
    }
    
    // Map concept relationships
    if (insights.concepts) {
      insights.concepts.forEach(concept => {
        const key = concept.concept.toLowerCase();
        if (!meetingData.conceptMap.has(key)) {
          meetingData.conceptMap.set(key, {
            firstMention: Date.now(),
            mentions: [],
            relatedConcepts: new Set()
          });
        }
        
        const entry = meetingData.conceptMap.get(key);
        entry.mentions.push({
          timestamp: Date.now(),
          context: concept.context,
          importance: concept.importance
        });
        
        // Link related concepts
        insights.concepts.forEach(other => {
          if (other.concept !== concept.concept) {
            entry.relatedConcepts.add(other.concept);
          }
        });
      });
    }
  }
  
  /**
   * Generate talking points based on current context
   */
  async generateTalkingPoints(topic) {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return ['No meeting context available'];
    }
    
    const context = this.getContextWindow(this.mediumTermWindow);
    const glossary = Array.from(meetingData.meetingGlossary.entries())
      .map(([term, data]) => `${term}: ${data.definition}`)
      .join('\n');
    
    const prompt = `Based on this meeting context, generate 3-5 intelligent talking points or questions about "${topic}".

CONTEXT:
${context}

MEETING GLOSSARY:
${glossary}

Generate talking points that show understanding and move the conversation forward.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'user', content: prompt }
      ],
      {
        temperature: 0.5,
        maxTokens: 200
      }
    );
    
    return response.content
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, ''));
  }
  
  /**
   * Get meeting-specific definition for a term
   */
  getContextualDefinition(term) {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return null;
    }
    
    const normalizedTerm = term.toLowerCase();
    
    // Check meeting glossary first
    if (meetingData.meetingGlossary.has(normalizedTerm)) {
      return meetingData.meetingGlossary.get(normalizedTerm);
    }
    
    // Check if term appears in concepts
    if (meetingData.conceptMap.has(normalizedTerm)) {
      const concept = meetingData.conceptMap.get(normalizedTerm);
      if (concept.mentions.length > 0) {
        return {
          definition: `Referenced ${concept.mentions.length} times in this meeting`,
          context: concept.mentions[concept.mentions.length - 1].context,
          relatedConcepts: Array.from(concept.relatedConcepts)
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get rolling summary of recent discussion
   */
  async getRollingSummary(duration = 120000) {
    const context = this.getContextWindow(duration);
    
    if (context.length < 50) {
      return null;
    }
    
    const prompt = `Provide a brief 2-3 sentence summary of this meeting segment:
${context}

Focus on key points and decisions.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'user', content: prompt }
      ],
      {
        temperature: 0.3,
        maxTokens: 100
      }
    );
    
    return response.content;
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(latency, insights) {
    this.metrics.totalExtractions++;
    this.metrics.totalLatency += latency;
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.totalExtractions;
    
    if (insights) {
      if (insights.concepts) {
        this.metrics.conceptsIdentified += insights.concepts.length;
      }
      if (insights.suggestedQuestions || insights.potentialActions) {
        this.metrics.insightsGenerated++;
      }
    }
    
    if (latency > 500) {
      console.warn(`[Contextual Intelligence] Latency ${latency}ms exceeds target`);
    }
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    const meetingData = this.getMeetingData();
    const meetingMetrics = meetingData ? {
      glossarySize: meetingData.meetingGlossary.size,
      conceptsTracked: meetingData.conceptMap.size,
      topicsDiscussed: meetingData.topicFlow.length,
      contextSize: meetingData.conversationContext.length
    } : {
      glossarySize: 0,
      conceptsTracked: 0,
      topicsDiscussed: 0,
      contextSize: 0
    };
    
    return {
      ...this.metrics,
      ...meetingMetrics,
      currentMeetingId: this.currentMeetingId
    };
  }
  
  /**
   * Get topic flow for the current meeting
   */
  getTopicFlow() {
    const meetingData = this.getMeetingData();
    return meetingData ? meetingData.topicFlow : [];
  }
  
  /**
   * Get full meeting glossary for current meeting
   */
  getMeetingGlossary() {
    const meetingData = this.getMeetingData();
    if (!meetingData) {
      return [];
    }
    
    return Array.from(meetingData.meetingGlossary.entries()).map(([term, data]) => ({
      term,
      ...data
    }));
  }
  
  /**
   * Reset for new meeting - creates a new meeting context
   */
  reset(meetingId) {
    if (meetingId) {
      this.setCurrentMeeting(meetingId);
    } else if (this.currentMeetingId) {
      // Clear current meeting data
      this.meetings.delete(this.currentMeetingId);
      this.currentMeetingId = null;
    }
  }
  
  /**
   * Clear data for a specific meeting
   */
  clearMeeting(meetingId) {
    if (this.meetings.has(meetingId)) {
      this.meetings.delete(meetingId);
      if (this.currentMeetingId === meetingId) {
        this.currentMeetingId = null;
      }
      console.log(`[Contextual Intelligence] Cleared data for meeting ${meetingId}`);
    }
  }

  
  /**
   * Update LLM provider settings
   */
  updateLLMSettings(settings) {
    this.llmProvider.updateSettings(settings);
    console.log('[Contextual Intelligence] LLM settings updated');
  }
  
  /**
   * Get current LLM provider info
   */
  getLLMProvider() {
    return this.llmProvider.getActiveProvider();
  }
  
  /**
   * Set max context length
   */
  setMaxContextLength(length) {
    // This is already handled in the sliding windows
    // But we can adjust if needed
    console.log(`[Contextual Intelligence] Max context length set to ${length}`);
  }
}

module.exports = ContextualIntelligenceService;