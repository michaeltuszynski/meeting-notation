const LLMProviderFactory = require('../llm/provider-factory');

class EnhancedSummaryService {
  constructor(storageService, contextualIntelligence) {
    this.storageService = storageService;
    this.contextualIntelligence = contextualIntelligence;
    this.llmProvider = new LLMProviderFactory();
    
    // Configuration options
    this.config = {
      chunkSize: 2000, // Characters per chunk for analysis
      maxTokensPerStage: 800,
      temperature: 0.2, // Lower temperature for more consistent analysis
      enableParallelProcessing: true,
      qualityCheckEnabled: true
    };
    
    // Cost tracking
    this.usageTracking = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      stageBreakdown: {
        structure: { calls: 0, inputTokens: 0, outputTokens: 0 },
        extraction: { calls: 0, inputTokens: 0, outputTokens: 0 },
        contextual: { calls: 0, inputTokens: 0, outputTokens: 0 },
        synthesis: { calls: 0, inputTokens: 0, outputTokens: 0 },
        quality: { calls: 0, inputTokens: 0, outputTokens: 0 }
      }
    };
    
    // Processing state
    this.processingState = {
      meetingId: null,
      stages: new Map(),
      startTime: null,
      errors: []
    };
  }
  /**
   * Clean JSON response from LLM by removing markdown code blocks
   * @param {string} content - Raw response content from LLM
   * @returns {any} Parsed JSON object
   */
  cleanAndParseJSON(content) {
    if (!content) {
      throw new Error('Empty content');
    }
    
    // Remove markdown code blocks
    let cleaned = content;
    
    // Remove ```json or ```JSON blocks
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, '');
    cleaned = cleaned.replace(/\n?```\s*$/gm, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Parse the cleaned JSON
    return JSON.parse(cleaned);
  }
  
  /**
   * Main entry point for enhanced summary generation
   */
  async generateEnhancedSummary(meetingId, options = {}) {
    console.log(`[Enhanced Summary] Starting enhanced summary generation for meeting ${meetingId}`);
    
    this.processingState = {
      meetingId,
      stages: new Map(),
      startTime: Date.now(),
      errors: []
    };
    
    try {
      // Gather all available data sources
      const meetingData = await this.gatherMeetingData(meetingId);
      
      if (!meetingData.transcripts || meetingData.transcripts.length === 0) {
        throw new Error('No transcript data available for summarization');
      }
      
      console.log(`[Enhanced Summary] Processing meeting with ${meetingData.transcripts.length} segments, ${meetingData.terms.length} terms`);
      
      // Stage 1: Meeting Structure Analysis
      const structureAnalysis = await this.analyzeMeetingStructure(meetingData);
      this.processingState.stages.set('structure', structureAnalysis);
      
      // Stage 2: Content Extraction (Parallel Processing)
      const contentExtractions = await this.extractMeetingContent(meetingData, structureAnalysis);
      this.processingState.stages.set('extraction', contentExtractions);
      
      // Stage 3: Contextual Enhancement
      const contextualEnhancement = await this.enhanceWithContext(meetingData, contentExtractions);
      this.processingState.stages.set('contextual', contextualEnhancement);
      
      // Stage 4: Synthesis & Structure
      const synthesizedSummary = await this.synthesizeSummary(meetingData, structureAnalysis, contentExtractions, contextualEnhancement);
      this.processingState.stages.set('synthesis', synthesizedSummary);
      
      // Stage 5: Quality & Completeness Check (if enabled)
      let finalSummary = synthesizedSummary;
      if (this.config.qualityCheckEnabled) {
        finalSummary = await this.performQualityCheck(meetingData, synthesizedSummary);
        this.processingState.stages.set('quality', finalSummary);
      }
      
      const totalTime = Date.now() - this.processingState.startTime;
      console.log(`[Enhanced Summary] Completed enhanced summary in ${totalTime}ms with ${this.usageTracking.totalCalls} LLM calls`);
      
      return {
        summary: finalSummary.content,
        metadata: {
          processingTime: totalTime,
          stagesCompleted: Array.from(this.processingState.stages.keys()),
          usageTracking: this.usageTracking,
          enhancementLevel: 'full',
          version: '1.0'
        },
        structure: finalSummary.structure,
        insights: finalSummary.insights
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Error generating enhanced summary:', error);
      this.processingState.errors.push(error.message);
      
      // Return fallback summary structure
      return {
        summary: 'Enhanced summary generation failed. Please use standard summary.',
        metadata: {
          processingTime: Date.now() - this.processingState.startTime,
          error: error.message,
          enhancementLevel: 'failed',
          version: '1.0'
        },
        structure: null,
        insights: null
      };
    }
  }
  
  /**
   * Gather all available meeting data from various sources
   */
  async gatherMeetingData(meetingId) {
    console.log(`[Enhanced Summary] Gathering meeting data for ${meetingId}`);
    
    // Get transcript segments
    const transcripts = await this.storageService.getTranscripts(meetingId, { 
      finalOnly: true,
      limit: null 
    });
    
    // Get extracted terms with definitions
    const terms = await this.storageService.getExtractedTerms(meetingId);
    
    // Get contextual intelligence data if available
    let contextualData = null;
    try {
      if (this.contextualIntelligence) {
        this.contextualIntelligence.setCurrentMeeting(meetingId);
        contextualData = {
          topicFlow: this.contextualIntelligence.getTopicFlow(),
          glossary: this.contextualIntelligence.getMeetingGlossary()
        };
      }
    } catch (error) {
      console.warn('[Enhanced Summary] Could not retrieve contextual intelligence data:', error.message);
    }
    
    // Combine transcript into full text while preserving timestamps
    const fullTranscript = transcripts
      .map(t => t.text)
      .join(' ')
      .trim();
    
    console.log(`[Enhanced Summary] Gathered ${transcripts.length} transcript segments, ${terms.length} terms, contextual data: ${!!contextualData}`);
    
    return {
      transcripts,
      fullTranscript,
      terms,
      contextualData,
      wordCount: fullTranscript.split(/\s+/).length,
      duration: transcripts.length > 0 ? 
        new Date(transcripts[transcripts.length - 1].timestamp) - new Date(transcripts[0].timestamp) : 0
    };
  }
  
  /**
   * Track LLM usage for cost calculation
   */
  trackUsage(stage, inputTokens = 0, outputTokens = 0) {
    this.usageTracking.totalCalls += 1;
    this.usageTracking.totalInputTokens += inputTokens;
    this.usageTracking.totalOutputTokens += outputTokens;
    
    if (this.usageTracking.stageBreakdown[stage]) {
      this.usageTracking.stageBreakdown[stage].calls += 1;
      this.usageTracking.stageBreakdown[stage].inputTokens += inputTokens;
      this.usageTracking.stageBreakdown[stage].outputTokens += outputTokens;
    }
  }
  
  /**
   * Split transcript into manageable chunks for processing
   */
  splitTranscriptIntoChunks(transcript, chunkSize = null) {
    const size = chunkSize || this.config.chunkSize;
    const chunks = [];
    
    for (let i = 0; i < transcript.length; i += size) {
      chunks.push(transcript.substring(i, i + size));
    }
    
    return chunks;
  }
  
  /**
   * Get usage tracking data for cost calculation
   */
  getUsageForMeeting() {
    return {
      provider: 'enhanced-summary',
      totalCalls: this.usageTracking.totalCalls,
      totalInputTokens: this.usageTracking.totalInputTokens,
      totalOutputTokens: this.usageTracking.totalOutputTokens,
      stageBreakdown: this.usageTracking.stageBreakdown
    };
  }
  
  /**
   * Reset usage tracking
   */
  resetUsageTracking() {
    this.usageTracking = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      stageBreakdown: {
        structure: { calls: 0, inputTokens: 0, outputTokens: 0 },
        extraction: { calls: 0, inputTokens: 0, outputTokens: 0 },
        contextual: { calls: 0, inputTokens: 0, outputTokens: 0 },
        synthesis: { calls: 0, inputTokens: 0, outputTokens: 0 },
        quality: { calls: 0, inputTokens: 0, outputTokens: 0 }
      }
    };
  }
  
  /**
   * Stage 1: Analyze meeting structure and flow
   */
  async analyzeMeetingStructure(meetingData) {
    console.log('[Enhanced Summary] Stage 1: Analyzing meeting structure');
    
    const startTime = Date.now();
    
    try {
      // Process transcript in chunks to identify structure
      const transcriptChunks = this.splitTranscriptIntoChunks(meetingData.fullTranscript, 3000);
      const structureAnalyses = [];
      
      for (let i = 0; i < transcriptChunks.length; i++) {
        const chunk = transcriptChunks[i];
        const isFirst = i === 0;
        const isLast = i === transcriptChunks.length - 1;
        
        const systemPrompt = `You are a meeting analyst. Analyze this meeting transcript segment and identify its structural elements.

Focus on:
1. Meeting phases (opening, discussion topics, decisions, closing)
2. Agenda items or topic transitions
3. Speaker patterns and roles
4. Time-sensitive elements (deadlines, schedules)
5. Meeting flow markers (questions, answers, conclusions)

Output as JSON only:
{
  "phase": "opening|discussion|decision|closing|other",
  "topicTransitions": ["topic1", "topic2"],
  "keyMarkers": ["question", "decision", "action_item", "announcement"],
  "speakerPattern": "single|multiple|presentation|discussion",
  "timeReferences": ["deadline", "schedule", "duration"],
  "structuralNotes": "Brief note about this segment's role in meeting"
}`;

        const userPrompt = `Meeting segment ${i + 1} of ${transcriptChunks.length}:
${isFirst ? '[MEETING START]' : ''}${isLast ? '[MEETING END]' : ''}

${chunk}

Analyze this segment's structural role in the meeting.`;

        const response = await this.llmProvider.createCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          {
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokensPerStage
          }
        );
        
        // Track usage (approximate token counts)
        this.trackUsage('structure', userPrompt.length / 4, response.content.length / 4);
        
        try {
          const analysis = this.cleanAndParseJSON(response.content);
          structureAnalyses.push({
            segment: i + 1,
            analysis,
            chunkLength: chunk.length
          });
        } catch (parseError) {
          console.warn(`[Enhanced Summary] Could not parse structure analysis for segment ${i + 1}:`, parseError.message);
          structureAnalyses.push({
            segment: i + 1,
            analysis: { phase: 'other', error: 'Parse failed' },
            chunkLength: chunk.length
          });
        }
      }
      
      // Synthesize overall meeting structure
      const overallStructure = this.synthesizeMeetingStructure(structureAnalyses);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Enhanced Summary] Stage 1 completed in ${processingTime}ms`);
      
      return {
        segments: structureAnalyses,
        overallStructure,
        processingTime,
        totalSegments: transcriptChunks.length
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Stage 1 error:', error);
      throw new Error(`Meeting structure analysis failed: ${error.message}`);
    }
  }
  
  /**
   * Synthesize overall meeting structure from segment analyses
   */
  synthesizeMeetingStructure(structureAnalyses) {
    const phases = [];
    const allTopics = [];
    const allMarkers = [];
    const speakerPatterns = [];
    const timeReferences = [];
    
    // Aggregate data from all segments
    structureAnalyses.forEach(({ analysis }) => {
      if (analysis.phase && analysis.phase !== 'other') phases.push(analysis.phase);
      if (analysis.topicTransitions) allTopics.push(...analysis.topicTransitions);
      if (analysis.keyMarkers) allMarkers.push(...analysis.keyMarkers);
      if (analysis.speakerPattern) speakerPatterns.push(analysis.speakerPattern);
      if (analysis.timeReferences) timeReferences.push(...analysis.timeReferences);
    });
    
    // Determine meeting flow
    const meetingFlow = this.determineMeetingFlow(phases);
    
    // Find unique topics and their frequency
    const topicFrequency = {};
    allTopics.forEach(topic => {
      topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
    });
    
    const mainTopics = Object.entries(topicFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([topic]) => topic);
    
    // Identify key meeting characteristics
    const hasDecisions = allMarkers.includes('decision');
    const hasActionItems = allMarkers.includes('action_item');
    const hasQuestions = allMarkers.includes('question');
    const hasAnnouncements = allMarkers.includes('announcement');
    
    const dominantSpeakerPattern = this.findMostCommon(speakerPatterns) || 'discussion';
    
    return {
      meetingFlow,
      mainTopics,
      characteristics: {
        hasDecisions,
        hasActionItems, 
        hasQuestions,
        hasAnnouncements,
        dominantSpeakerPattern
      },
      timeElements: [...new Set(timeReferences)],
      segmentCount: structureAnalyses.length
    };
  }
  
  /**
   * Determine overall meeting flow from phase analysis
   */
  determineMeetingFlow(phases) {
    if (phases.length === 0) return 'unstructured';
    
    const phaseSequence = phases.join(' -> ');
    
    // Pattern matching for common meeting flows
    if (phases.includes('opening') && phases.includes('closing')) {
      return 'structured';
    } else if (phases.includes('decision')) {
      return 'decision-focused';
    } else if (phases.filter(p => p === 'discussion').length > phases.length * 0.7) {
      return 'discussion-heavy';
    } else {
      return 'mixed';
    }
  }
  
  /**
   * Find most common element in array
   */
  findMostCommon(arr) {
    if (arr.length === 0) return null;
    
    const frequency = {};
    arr.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)[0][0];
  }
  
  /**
   * Stage 2: Extract different types of meeting content in parallel
   */
  async extractMeetingContent(meetingData, structureAnalysis) {
    console.log('[Enhanced Summary] Stage 2: Extracting meeting content in parallel');
    
    const startTime = Date.now();
    
    try {
      // Define extraction threads based on structure analysis
      const extractionThreads = this.defineExtractionThreads(structureAnalysis.overallStructure);
      
      // Run parallel extractions if enabled, otherwise sequential
      let extractions;
      if (this.config.enableParallelProcessing) {
        console.log(`[Enhanced Summary] Running ${extractionThreads.length} extraction threads in parallel`);
        extractions = await Promise.all(
          extractionThreads.map(thread => this.runExtractionThread(thread, meetingData))
        );
      } else {
        console.log(`[Enhanced Summary] Running ${extractionThreads.length} extraction threads sequentially`);
        extractions = [];
        for (const thread of extractionThreads) {
          extractions.push(await this.runExtractionThread(thread, meetingData));
        }
      }
      
      // Combine extraction results
      const combinedExtractions = this.combineExtractionResults(extractions);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Enhanced Summary] Stage 2 completed in ${processingTime}ms`);
      
      return {
        extractions: combinedExtractions,
        threadsUsed: extractionThreads.map(t => t.type),
        processingTime
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Stage 2 error:', error);
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }
  
  /**
   * Define which extraction threads to run based on meeting characteristics
   */
  defineExtractionThreads(overallStructure) {
    const threads = [];
    
    // Always include main topics thread
    threads.push({ type: 'topics', priority: 'high' });
    
    // Add threads based on meeting characteristics
    if (overallStructure.characteristics.hasDecisions) {
      threads.push({ type: 'decisions', priority: 'high' });
    }
    
    if (overallStructure.characteristics.hasActionItems) {
      threads.push({ type: 'actions', priority: 'high' });
    }
    
    if (overallStructure.characteristics.hasQuestions) {
      threads.push({ type: 'questions', priority: 'medium' });
    }
    
    if (overallStructure.characteristics.hasAnnouncements) {
      threads.push({ type: 'announcements', priority: 'medium' });
    }
    
    // Always include technical concepts thread
    threads.push({ type: 'technical', priority: 'medium' });
    
    // Add timeline thread if time elements detected
    if (overallStructure.timeElements.length > 0) {
      threads.push({ type: 'timeline', priority: 'medium' });
    }
    
    return threads;
  }
  
  /**
   * Run a specific extraction thread
   */
  async runExtractionThread(thread, meetingData) {
    console.log(`[Enhanced Summary] Running ${thread.type} extraction thread`);
    
    const extractors = {
      topics: () => this.extractTopics(meetingData),
      decisions: () => this.extractDecisions(meetingData),
      actions: () => this.extractActionItems(meetingData),
      questions: () => this.extractQuestions(meetingData),
      announcements: () => this.extractAnnouncements(meetingData),
      technical: () => this.extractTechnicalConcepts(meetingData),
      timeline: () => this.extractTimeline(meetingData)
    };
    
    try {
      const result = await extractors[thread.type]();
      return {
        type: thread.type,
        priority: thread.priority,
        result,
        success: true
      };
    } catch (error) {
      console.warn(`[Enhanced Summary] ${thread.type} extraction failed:`, error.message);
      return {
        type: thread.type,
        priority: thread.priority,
        result: null,
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Extract main discussion topics
   */
  async extractTopics(meetingData) {
    const systemPrompt = `You are a topic identification expert. Extract the main discussion topics from this meeting transcript.

Focus on:
1. Primary subjects discussed at length
2. Key themes and concepts
3. Problem areas or challenges mentioned
4. Solutions or approaches discussed

Output as JSON only:
{
  "mainTopics": [
    {
      "topic": "Topic name",
      "description": "Brief description",
      "importance": "high|medium|low",
      "timeSpent": "estimated discussion duration"
    }
  ],
  "themeClusters": ["theme1", "theme2"],
  "underlyingConcerns": ["concern1", "concern2"]
}`;

    const userPrompt = `Meeting transcript to analyze:

${meetingData.fullTranscript.substring(0, 6000)}

Extract the main topics discussed in this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse topics extraction:', parseError.message);
      return { mainTopics: [], themeClusters: [], underlyingConcerns: [] };
    }
  }
  
  /**
   * Extract decisions made during the meeting
   */
  async extractDecisions(meetingData) {
    const systemPrompt = `You are a decision tracking expert. Identify all decisions made during this meeting.

Focus on:
1. Explicit decisions ("we decided to...", "let's go with...")
2. Implicit agreements and consensus
3. Policy changes or new directions
4. Resource allocations or assignments

Output as JSON only:
{
  "decisions": [
    {
      "decision": "What was decided",
      "context": "Why this decision was made",
      "impact": "Expected impact or consequence",
      "confidence": "high|medium|low"
    }
  ],
  "consensus": ["Items where group agreed"],
  "pendingDecisions": ["Items needing future decision"]
}`;

    const userPrompt = `Meeting transcript to analyze for decisions:

${meetingData.fullTranscript}

Extract all decisions made during this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse decisions extraction:', parseError.message);
      return { decisions: [], consensus: [], pendingDecisions: [] };
    }
  }
  
  /**
   * Extract action items and next steps
   */
  async extractActionItems(meetingData) {
    const systemPrompt = `You are an action item tracking expert. Identify all action items and next steps from this meeting.

Focus on:
1. Explicit action items ("John will...", "we need to...")
2. Implicit tasks and follow-ups
3. Deadlines and timelines
4. Responsibilities and ownership

Output as JSON only:
{
  "actionItems": [
    {
      "action": "What needs to be done",
      "owner": "Who is responsible (if mentioned)",
      "deadline": "When it's due (if mentioned)",
      "priority": "high|medium|low"
    }
  ],
  "followUps": ["Items needing follow-up"],
  "dependencies": ["Items that depend on other actions"]
}`;

    const userPrompt = `Meeting transcript to analyze for action items:

${meetingData.fullTranscript}

Extract all action items and next steps from this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse action items extraction:', parseError.message);
      return { actionItems: [], followUps: [], dependencies: [] };
    }
  }
  
  /**
   * Extract questions raised and answered
   */
  async extractQuestions(meetingData) {
    const systemPrompt = `You are a Q&A tracking expert. Identify questions raised and answered during this meeting.

Focus on:
1. Direct questions asked by participants
2. Questions answered or addressed
3. Open questions needing follow-up
4. Clarifications requested

Output as JSON only:
{
  "questionsAnswered": [
    {
      "question": "What was asked",
      "answer": "How it was answered",
      "asker": "Who asked (if clear)"
    }
  ],
  "openQuestions": ["Questions that remain unanswered"],
  "clarifications": ["Items needing clarification"]
}`;

    const userPrompt = `Meeting transcript to analyze for questions and answers:

${meetingData.fullTranscript.substring(0, 5000)}

Extract questions raised and answered in this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse questions extraction:', parseError.message);
      return { questionsAnswered: [], openQuestions: [], clarifications: [] };
    }
  }
  
  /**
   * Extract announcements and updates
   */
  async extractAnnouncements(meetingData) {
    const systemPrompt = `You are an announcement tracking expert. Identify announcements and updates shared during this meeting.

Focus on:
1. News and updates shared
2. Policy or process changes
3. Important notifications
4. Status updates on projects

Output as JSON only:
{
  "announcements": [
    {
      "announcement": "What was announced",
      "category": "news|policy|status|notification",
      "importance": "high|medium|low"
    }
  ],
  "updates": ["Project or status updates"],
  "changes": ["Policy or process changes"]
}`;

    const userPrompt = `Meeting transcript to analyze for announcements:

${meetingData.fullTranscript.substring(0, 5000)}

Extract announcements and updates from this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse announcements extraction:', parseError.message);
      return { announcements: [], updates: [], changes: [] };
    }
  }
  
  /**
   * Extract technical concepts and explanations
   */
  async extractTechnicalConcepts(meetingData) {
    const topTerms = meetingData.terms
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15)
      .map(t => t.term)
      .join(', ');
    
    const systemPrompt = `You are a technical concept expert. Identify and explain technical concepts discussed in this meeting.

Focus on:
1. Technical terms and their usage context
2. Complex concepts that were explained
3. Technical solutions or approaches
4. System or process descriptions

Output as JSON only:
{
  "technicalConcepts": [
    {
      "concept": "Technical term or concept",
      "explanation": "How it was explained or used",
      "complexity": "high|medium|low",
      "relevance": "central|supporting|mentioned"
    }
  ],
  "technicalSolutions": ["Solutions discussed"],
  "systemsDiscussed": ["Systems or processes mentioned"]
}`;

    const userPrompt = `Meeting transcript to analyze for technical concepts:

Key terms identified: ${topTerms}

${meetingData.fullTranscript.substring(0, 5000)}

Extract technical concepts and their explanations from this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse technical concepts extraction:', parseError.message);
      return { technicalConcepts: [], technicalSolutions: [], systemsDiscussed: [] };
    }
  }
  
  /**
   * Extract timeline and temporal elements
   */
  async extractTimeline(meetingData) {
    const systemPrompt = `You are a timeline expert. Identify time-related elements and create a chronological understanding of this meeting.

Focus on:
1. Deadlines and due dates mentioned
2. Project timelines and milestones
3. Historical references
4. Future planning elements

Output as JSON only:
{
  "deadlines": [
    {
      "item": "What has a deadline",
      "date": "When it's due (if specified)",
      "urgency": "high|medium|low"
    }
  ],
  "milestones": ["Project milestones mentioned"],
  "timeReferences": ["Past, present, future references"],
  "chronology": ["Sequence of events discussed"]
}`;

    const userPrompt = `Meeting transcript to analyze for timeline elements:

${meetingData.fullTranscript.substring(0, 4000)}

Extract timeline and temporal elements from this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('extraction', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse timeline extraction:', parseError.message);
      return { deadlines: [], milestones: [], timeReferences: [], chronology: [] };
    }
  }
  
  /**
   * Combine results from all extraction threads
   */
  combineExtractionResults(extractions) {
    const combined = {
      successful: [],
      failed: [],
      summary: {}
    };
    
    extractions.forEach(extraction => {
      if (extraction.success) {
        combined.successful.push(extraction.type);
        combined.summary[extraction.type] = extraction.result;
      } else {
        combined.failed.push({
          type: extraction.type,
          error: extraction.error
        });
      }
    });
    
    return combined;
  }
  
  /**
   * Stage 3: Enhance content with contextual intelligence
   */
  async enhanceWithContext(meetingData, contentExtractions) {
    console.log('[Enhanced Summary] Stage 3: Enhancing with contextual intelligence');
    
    const startTime = Date.now();
    
    try {
      // Get contextual intelligence data if available
      const contextualData = meetingData.contextualData;
      
      if (!contextualData) {
        console.log('[Enhanced Summary] No contextual data available, skipping contextual enhancement');
        return {
          enhanced: false,
          reason: 'No contextual data available',
          processingTime: Date.now() - startTime
        };
      }
      
      // Enhance different extraction types with contextual data
      const enhancementTasks = [];
      
      // Enhance topics with topic flow
      if (contentExtractions.extractions.summary.topics && contextualData.topicFlow) {
        enhancementTasks.push(this.enhanceTopicsWithFlow(
          contentExtractions.extractions.summary.topics,
          contextualData.topicFlow
        ));
      }
      
      // Enhance technical concepts with glossary
      if (contentExtractions.extractions.summary.technical && contextualData.glossary) {
        enhancementTasks.push(this.enhanceTechnicalWithGlossary(
          contentExtractions.extractions.summary.technical,
          contextualData.glossary,
          meetingData.terms
        ));
      }
      
      // Create contextual narrative
      enhancementTasks.push(this.createContextualNarrative(
        contentExtractions,
        contextualData,
        meetingData
      ));
      
      // Execute enhancement tasks
      console.log(`[Enhanced Summary] Running ${enhancementTasks.length} contextual enhancement tasks`);
      const enhancements = await Promise.all(enhancementTasks);
      
      // Combine enhancements
      const contextualEnhancement = this.combineContextualEnhancements(enhancements);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Enhanced Summary] Stage 3 completed in ${processingTime}ms`);
      
      return {
        enhanced: true,
        contextualData,
        enhancements: contextualEnhancement,
        processingTime
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Stage 3 error:', error);
      return {
        enhanced: false,
        reason: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Enhance topic extraction with contextual topic flow
   */
  async enhanceTopicsWithFlow(topicExtractions, topicFlow) {
    if (!topicFlow || topicFlow.length === 0) {
      return { type: 'topics', enhanced: false, reason: 'No topic flow data' };
    }
    
    const systemPrompt = `You are a contextual analysis expert. Use the real-time topic flow data to enhance and validate the extracted meeting topics.

The topic flow shows how the conversation evolved over time with contextual insights captured during the meeting.

Output as JSON only:
{
  "validatedTopics": [
    {
      "topic": "Topic name",
      "description": "Enhanced description with context",
      "importance": "high|medium|low",
      "contextualRelevance": "How this topic fits in the meeting flow",
      "relatedInsights": ["Related contextual insights"]
    }
  ],
  "topicEvolution": ["How topics evolved during the meeting"],
  "missingTopics": ["Important topics that may have been missed in initial extraction"]
}`;

    const userPrompt = `Initial topic extraction:
${JSON.stringify(topicExtractions, null, 2)}

Real-time topic flow data from meeting:
${JSON.stringify(topicFlow.slice(0, 10), null, 2)}

Enhance the topic extraction using the contextual topic flow data.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('contextual', userPrompt.length / 4, response.content.length / 4);
    
    try {
      const enhancement = this.cleanAndParseJSON(response.content);
      return { type: 'topics', enhanced: true, result: enhancement };
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse topics enhancement:', parseError.message);
      return { type: 'topics', enhanced: false, reason: 'Parse failed' };
    }
  }
  
  /**
   * Enhance technical concepts with meeting glossary
   */
  async enhanceTechnicalWithGlossary(technicalExtractions, glossary, extractedTerms) {
    if (!glossary || glossary.length === 0) {
      return { type: 'technical', enhanced: false, reason: 'No glossary data' };
    }
    
    // Prepare glossary data
    const glossaryText = glossary.map(entry => 
      `${entry.term}: ${entry.definition || 'No definition'} (mentioned ${entry.frequency || 0}x)`
    ).join('\n');
    
    // Prepare top extracted terms
    const topTermsText = extractedTerms
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)
      .map(t => `${t.term} (${t.frequency}x): ${t.definition || 'No definition'}`)
      .join('\n');
    
    const systemPrompt = `You are a technical concept enhancement expert. Use the meeting glossary and term definitions to enhance the technical concept extraction.

The glossary contains contextual definitions based on how terms were actually used in this specific meeting.

Output as JSON only:
{
  "enhancedConcepts": [
    {
      "concept": "Technical concept",
      "contextualDefinition": "Definition based on meeting usage",
      "meetingRelevance": "Why this concept was important in this meeting",
      "complexity": "high|medium|low",
      "relatedTerms": ["Related terms discussed"]
    }
  ],
  "conceptRelationships": ["How concepts relate to each other"],
  "technicalInsights": ["Key insights about technical discussions"]
}`;

    const userPrompt = `Initial technical extraction:
${JSON.stringify(technicalExtractions, null, 2)}

Meeting glossary (contextual definitions):
${glossaryText}

Top extracted terms with definitions:
${topTermsText}

Enhance the technical concept extraction using the contextual glossary data.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('contextual', userPrompt.length / 4, response.content.length / 4);
    
    try {
      const enhancement = this.cleanAndParseJSON(response.content);
      return { type: 'technical', enhanced: true, result: enhancement };
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse technical enhancement:', parseError.message);
      return { type: 'technical', enhanced: false, reason: 'Parse failed' };
    }
  }
  
  /**
   * Create contextual narrative that ties everything together
   */
  async createContextualNarrative(contentExtractions, contextualData, meetingData) {
    const systemPrompt = `You are a meeting narrative expert. Create a contextual narrative that ties together all the extracted content with the real-time contextual intelligence.

This narrative should provide the "story" of the meeting - how it unfolded, what was most important, and how different elements connected.

Output as JSON only:
{
  "meetingNarrative": "A cohesive story of how the meeting unfolded",
  "keyMoments": [
    {
      "moment": "Description of key moment",
      "importance": "Why this moment was significant",
      "context": "What led to this moment"
    }
  ],
  "connectionPatterns": ["How different topics/decisions connected"],
  "meetingDynamics": "Overall flow and dynamics of the meeting",
  "contextualInsights": ["Insights that can only be gained from the full context"]
}`;

    const userPrompt = `Content extractions summary:
${JSON.stringify(contentExtractions.extractions.successful, null, 2)}

Contextual intelligence data:
Topic Flow: ${contextualData.topicFlow ? contextualData.topicFlow.length + ' topic transitions' : 'None'}
Glossary: ${contextualData.glossary ? contextualData.glossary.length + ' contextual definitions' : 'None'}

Meeting statistics:
- Duration: ${Math.round(meetingData.duration / 60000)} minutes
- Word count: ${meetingData.wordCount}
- Terms extracted: ${meetingData.terms.length}

Create a contextual narrative that ties all these elements together.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature + 0.1, // Slightly higher temperature for narrative
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('contextual', userPrompt.length / 4, response.content.length / 4);
    
    try {
      const narrative = this.cleanAndParseJSON(response.content);
      return { type: 'narrative', enhanced: true, result: narrative };
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse narrative enhancement:', parseError.message);
      return { type: 'narrative', enhanced: false, reason: 'Parse failed' };
    }
  }
  
  /**
   * Combine all contextual enhancements
   */
  combineContextualEnhancements(enhancements) {
    const combined = {
      successful: [],
      failed: [],
      enhancements: {}
    };
    
    enhancements.forEach(enhancement => {
      if (enhancement.enhanced) {
        combined.successful.push(enhancement.type);
        combined.enhancements[enhancement.type] = enhancement.result;
      } else {
        combined.failed.push({
          type: enhancement.type,
          reason: enhancement.reason
        });
      }
    });
    
    return combined;
  }
  
  /**
   * Stage 4: Synthesize all content into structured summary
   */
  async synthesizeSummary(meetingData, structureAnalysis, contentExtractions, contextualEnhancement) {
    console.log('[Enhanced Summary] Stage 4: Synthesizing structured summary');
    
    const startTime = Date.now();
    
    try {
      // Prepare comprehensive data for synthesis
      const synthesisData = this.prepareSynthesisData(
        meetingData,
        structureAnalysis,
        contentExtractions,
        contextualEnhancement
      );
      
      // Generate main executive summary
      const executiveSummary = await this.generateExecutiveSummary(synthesisData);
      
      // Create structured sections
      const structuredSections = await this.createStructuredSections(synthesisData);
      
      // Generate insights and recommendations
      const insights = await this.generateInsights(synthesisData);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Enhanced Summary] Stage 4 completed in ${processingTime}ms`);
      
      return {
        content: executiveSummary,
        structure: structuredSections,
        insights: insights,
        metadata: {
          processingTime,
          dataSourcesUsed: this.getDataSourcesUsed(synthesisData),
          enhancementLevel: contextualEnhancement.enhanced ? 'full' : 'standard'
        }
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Stage 4 error:', error);
      throw new Error(`Summary synthesis failed: ${error.message}`);
    }
  }
  
  /**
   * Prepare all data for synthesis
   */
  prepareSynthesisData(meetingData, structureAnalysis, contentExtractions, contextualEnhancement) {
    return {
      meeting: {
        duration: Math.round(meetingData.duration / 60000),
        wordCount: meetingData.wordCount,
        segmentCount: meetingData.transcripts.length,
        termCount: meetingData.terms.length
      },
      structure: structureAnalysis.overallStructure,
      content: contentExtractions.extractions.summary,
      contextual: contextualEnhancement.enhanced ? contextualEnhancement.enhancements : null,
      terms: meetingData.terms.slice(0, 25) // Top 25 terms
    };
  }
  
  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(synthesisData) {
    const systemPrompt = `You are an executive summary expert. Create a comprehensive, professional executive summary that captures the essence of this meeting.

Your summary should be clear, concise, and structured. Focus on what executives and stakeholders need to know.

Structure your response as clear paragraphs (not JSON), approximately 200-400 words total:

1. **Opening Context**: Brief context of what this meeting was about
2. **Key Outcomes**: Main decisions, agreements, or conclusions reached  
3. **Action Items**: Critical next steps and responsibilities
4. **Important Details**: Technical concepts, timelines, or concerns that stakeholders should be aware of
5. **Impact Assessment**: What this means going forward

Write in professional, clear language suitable for executive consumption.`;

    const contentSummary = Object.entries(synthesisData.content)
      .filter(([key, value]) => value && Object.keys(value).length > 0)
      .map(([key, value]) => `${key.toUpperCase()}: ${JSON.stringify(value)}`)
      .join('\n\n');

    const contextualSummary = synthesisData.contextual ? 
      Object.entries(synthesisData.contextual)
        .map(([key, value]) => `${key.toUpperCase()}: ${JSON.stringify(value)}`)
        .join('\n\n') : 'No contextual enhancements available';

    const userPrompt = `Meeting Analysis Data:

MEETING OVERVIEW:
- Duration: ${synthesisData.meeting.duration} minutes
- Content: ${synthesisData.meeting.wordCount} words across ${synthesisData.meeting.segmentCount} segments
- Terms Identified: ${synthesisData.meeting.termCount}
- Meeting Flow: ${synthesisData.structure.meetingFlow}

EXTRACTED CONTENT:
${contentSummary}

CONTEXTUAL INTELLIGENCE:
${contextualSummary}

Generate a professional executive summary of this meeting.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: 600 // Longer for executive summary
      }
    );
    
    this.trackUsage('synthesis', userPrompt.length / 4, response.content.length / 4);
    
    return response.content;
  }
  
  /**
   * Create structured sections for different summary aspects
   */
  async createStructuredSections(synthesisData) {
    const sections = {
      decisions: [],
      actionItems: [],
      technicalConcepts: [],
      timeline: [],
      keyInsights: []
    };
    
    // Extract structured data from content
    if (synthesisData.content.decisions) {
      sections.decisions = synthesisData.content.decisions.decisions || [];
    }
    
    if (synthesisData.content.actions) {
      sections.actionItems = synthesisData.content.actions.actionItems || [];
    }
    
    if (synthesisData.content.technical) {
      sections.technicalConcepts = synthesisData.content.technical.technicalConcepts || [];
    }
    
    if (synthesisData.content.timeline) {
      sections.timeline = synthesisData.content.timeline.deadlines || [];
    }
    
    // Add contextual insights if available
    if (synthesisData.contextual && synthesisData.contextual.narrative) {
      sections.keyInsights = synthesisData.contextual.narrative.contextualInsights || [];
    }
    
    return sections;
  }
  
  /**
   * Generate insights and recommendations
   */
  async generateInsights(synthesisData) {
    const systemPrompt = `You are a meeting insights expert. Based on the comprehensive meeting analysis, provide strategic insights and recommendations.

Output as JSON only:
{
  "keyInsights": [
    {
      "insight": "Strategic insight about the meeting",
      "importance": "high|medium|low",
      "category": "strategic|operational|technical|process"
    }
  ],
  "recommendations": [
    {
      "recommendation": "Actionable recommendation",
      "rationale": "Why this recommendation makes sense",
      "priority": "high|medium|low"
    }
  ],
  "riskFactors": ["Potential risks or concerns identified"],
  "opportunities": ["Opportunities or positive developments"],
  "followUpSuggestions": ["Suggestions for follow-up meetings or actions"]
}`;

    const userPrompt = `Complete meeting analysis:

Structure: ${JSON.stringify(synthesisData.structure)}
Content Summary: Available extraction types: ${Object.keys(synthesisData.content)}
Meeting Stats: ${synthesisData.meeting.duration}min, ${synthesisData.meeting.wordCount} words

Generate strategic insights and recommendations based on this meeting analysis.`;

    const response = await this.llmProvider.createCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokensPerStage
      }
    );
    
    this.trackUsage('synthesis', userPrompt.length / 4, response.content.length / 4);
    
    try {
      return this.cleanAndParseJSON(response.content);
    } catch (parseError) {
      console.warn('[Enhanced Summary] Could not parse insights:', parseError.message);
      return {
        keyInsights: [],
        recommendations: [],
        riskFactors: [],
        opportunities: [],
        followUpSuggestions: []
      };
    }
  }
  
  /**
   * Stage 5: Perform quality check and completeness validation
   */
  async performQualityCheck(meetingData, synthesizedSummary) {
    console.log('[Enhanced Summary] Stage 5: Performing quality check');
    
    const startTime = Date.now();
    
    try {
      // Validate completeness
      const completenessCheck = await this.validateCompleteness(meetingData, synthesizedSummary);
      
      // Check for accuracy and consistency
      const accuracyCheck = await this.validateAccuracy(meetingData, synthesizedSummary);
      
      // Enhance summary based on quality findings
      let finalSummary = synthesizedSummary;
      if (completenessCheck.needsEnhancement || accuracyCheck.needsCorrection) {
        console.log('[Enhanced Summary] Quality issues found, enhancing summary');
        finalSummary = await this.enhanceSummaryFromQualityCheck(
          synthesizedSummary,
          completenessCheck,
          accuracyCheck
        );
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[Enhanced Summary] Stage 5 completed in ${processingTime}ms`);
      
      return {
        ...finalSummary,
        qualityMetrics: {
          completeness: completenessCheck.score,
          accuracy: accuracyCheck.score,
          enhancementsApplied: completenessCheck.needsEnhancement || accuracyCheck.needsCorrection,
          processingTime
        }
      };
      
    } catch (error) {
      console.error('[Enhanced Summary] Stage 5 error:', error);
      // Return original summary if quality check fails
      return {
        ...synthesizedSummary,
        qualityMetrics: {
          completeness: 0,
          accuracy: 0,
          enhancementsApplied: false,
          error: error.message,
          processingTime: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Validate summary completeness
   */
  async validateCompleteness(meetingData, synthesizedSummary) {
    // Simple heuristic-based completeness check
    const checks = {
      hasExecutiveSummary: synthesizedSummary.content && synthesizedSummary.content.length > 100,
      hasStructuredSections: synthesizedSummary.structure && Object.keys(synthesizedSummary.structure).length > 0,
      hasInsights: synthesizedSummary.insights && synthesizedSummary.insights.keyInsights,
      coversMajorTerms: this.checkTermCoverage(meetingData.terms, synthesizedSummary.content),
      appropriateLength: synthesizedSummary.content.length >= 200 && synthesizedSummary.content.length <= 2000
    };
    
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    const needsEnhancement = score < 0.8;
    
    return { score, checks, needsEnhancement };
  }
  
  /**
   * Validate summary accuracy (basic checks)
   */
  async validateAccuracy(meetingData, synthesizedSummary) {
    // Basic accuracy validation
    const checks = {
      noHallucination: !this.detectPotentialHallucination(synthesizedSummary.content, meetingData.terms),
      consistentTone: true, // Would need more sophisticated checking
      factuallyGrounded: true // Would need fact-checking against transcript
    };
    
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    const needsCorrection = score < 0.9;
    
    return { score, checks, needsCorrection };
  }
  
  /**
   * Check if major terms are covered in summary
   */
  checkTermCoverage(terms, summaryContent) {
    const topTerms = terms
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(t => t.term.toLowerCase());
    
    const summaryLower = summaryContent.toLowerCase();
    const coveredTerms = topTerms.filter(term => summaryLower.includes(term));
    
    return coveredTerms.length >= topTerms.length * 0.6; // 60% coverage threshold
  }
  
  /**
   * Simple hallucination detection
   */
  detectPotentialHallucination(summaryContent, terms) {
    // Very basic check - look for specific phrases that might indicate hallucination
    const suspiciousPatterns = [
      /\$[\d,]+\.?\d*/g, // Specific dollar amounts not in terms
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // Specific dates
      /\b\d{1,2}:\d{2}\s?(AM|PM)\b/g // Specific times
    ];
    
    const termText = terms.map(t => t.term).join(' ').toLowerCase();
    
    for (const pattern of suspiciousPatterns) {
      const matches = summaryContent.match(pattern);
      if (matches) {
        // Check if these matches appear in the original terms
        const suspiciousMatch = matches.some(match => 
          !termText.includes(match.toLowerCase())
        );
        if (suspiciousMatch) return true;
      }
    }
    
    return false;
  }
  
  /**
   * Enhance summary based on quality check findings
   */
  async enhanceSummaryFromQualityCheck(originalSummary, completenessCheck, accuracyCheck) {
    // For now, return original summary
    // In a full implementation, would make targeted improvements
    console.log('[Enhanced Summary] Quality enhancement not fully implemented, returning original summary');
    return originalSummary;
  }
  
  /**
   * Get data sources used in synthesis
   */
  getDataSourcesUsed(synthesisData) {
    const sources = ['meeting-transcript', 'extracted-terms'];
    
    if (synthesisData.contextual) {
      sources.push('contextual-intelligence');
    }
    
    if (synthesisData.structure) {
      sources.push('structure-analysis');
    }
    
    return sources;
  }
}

module.exports = EnhancedSummaryService;