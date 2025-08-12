const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TranscriptionProviderFactory = require('./transcription/provider-factory');
const { AudioProcessor } = require('./utils/audio');
const GPT4oMiniService = require('./llm/gpt4omini');
const ContextualIntelligenceService = require('./llm/contextual-intelligence');
const KnowledgeProviderFactory = require('./knowledge/provider-factory');
const PostgresService = require('./db/postgres');
const MeetingService = require('./services/meeting');
const StorageService = require('./services/storage');
const ReportService = require('./services/report');
const GlobalCorrectionService = require('./services/global-corrections');
const meetingRoutes = require('./routes/meetings');
const correctionsRoutes = require('./routes/corrections');
const ModelRegistry = require('./llm/model-registry');

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:4000', 'file://*'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 1e6 // 1MB for audio chunks
});

// Make io accessible in routes
app.set('io', io);

// Initialize database
const db = new PostgresService();
db.testConnection();

// Initialize services
const transcriptionService = new TranscriptionProviderFactory();
const gpt4oMiniService = new GPT4oMiniService();
const contextualIntelligence = new ContextualIntelligenceService();
const knowledgeService = new KnowledgeProviderFactory();
const meetingService = new MeetingService(db);
const storageService = new StorageService(db);
const reportService = new ReportService(db, storageService, contextualIntelligence);
const correctionService = new GlobalCorrectionService(db);
const modelRegistry = new ModelRegistry();
const audioProcessors = new Map(); // One processor per client

// Current active meeting
let activeMeetingId = null;

// Listen for meeting deletion events from routes
io.on('meeting:deleted', (data) => {
  // Always clear intelligence data for the deleted meeting, regardless of whether it's active
  contextualIntelligence.clearMeeting(data.meetingId);
  
  if (data.meetingId === activeMeetingId) {
    console.log(`[Server] Active meeting ${activeMeetingId} was deleted, clearing active state`);
    activeMeetingId = null;
    // Clear intelligence data for active meeting
    gpt4oMiniService.reset();
    console.log(`[Server] Cleared intelligence data for deleted active meeting`);
  }
});

// Middleware to make services available in routes
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  req.correctionService = correctionService;
  next();
});

// API Routes - must be after service initialization
app.use('/api/meetings', meetingRoutes(meetingService, storageService, reportService));
app.use('/api/corrections', correctionsRoutes);

// Connect to transcription service on server start
transcriptionService.connect().catch(err => {
  console.error('Failed to initialize transcription service:', err);
});

// Transcription event handlers
transcriptionService.on('transcript', async (transcript) => {
  // Only process transcripts if there's an active meeting
  if (!activeMeetingId) {
    console.warn('Received transcript but no active meeting - ignoring');
    return;
  }
  
  // Apply global corrections to the transcript
  let correctedTranscript = { ...transcript };
  if (transcript.text && transcript.text.trim()) {
    const correctionResult = correctionService.applyCorrections(transcript.text, activeMeetingId);
    
    if (correctionResult.hasChanges) {
      correctedTranscript.text = correctionResult.text;
      correctedTranscript.corrections = correctionResult.corrections;
      console.log(`[Corrections] Applied ${correctionResult.corrections.length} corrections to transcript`);
      
      // Emit correction event to clients
      io.emit('corrections:applied', {
        original: transcript.text,
        corrected: correctionResult.text,
        corrections: correctionResult.corrections,
        timestamp: Date.now()
      });
    }
  }
  
  // Broadcast corrected transcript to all connected clients
  io.emit('transcript:update', correctedTranscript);
  
  // Save corrected transcript to database
  if (correctedTranscript.text && correctedTranscript.text.trim()) {
    try {
      await storageService.saveTranscript(activeMeetingId, {
        text: correctedTranscript.text,
        isFinal: correctedTranscript.isFinal,
        confidence: correctedTranscript.confidence,
        timestamp: new Date(),
        originalText: transcript.text !== correctedTranscript.text ? transcript.text : null,
        corrections: correctedTranscript.corrections || null
      });
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  }
  
  // Add corrected transcript to both intelligence services
  if (correctedTranscript.text && correctedTranscript.text.trim()) {
    console.log(`[Intelligence] Processing corrected transcript: "${correctedTranscript.text.substring(0, 50)}..."`);
    
    // Add to contextual intelligence for richer insights (use corrected text)
    contextualIntelligence.addTranscript(correctedTranscript.text);
    
    // Extract contextual insights
    const insights = await contextualIntelligence.extractContextualInsights();
    if (insights) {
      io.emit('contextual:insights', insights);
      console.log(`[Contextual] Extracted insights - Topic: ${insights.currentTopic}`);
      
      // Save insights to database if meeting is active
      if (activeMeetingId && insights.concepts) {
        try {
          // Save concepts as enriched terms
          const conceptTerms = insights.concepts.map(c => c.concept);
          await storageService.saveExtractedTerms(activeMeetingId, conceptTerms);
          
          // Save contextual definitions
          if (insights.contextualDefinitions) {
            for (const [term, definition] of Object.entries(insights.contextualDefinitions)) {
              await storageService.saveTermDefinition(
                term,
                definition,
                [{ url: 'meeting-context', title: 'From Meeting Context' }]
              );
            }
          }
        } catch (error) {
          console.error('Error saving contextual insights:', error);
        }
      }
    }
    
    // Also use original term extraction for backwards compatibility
    gpt4oMiniService.addTranscript(transcript.text);
    const extraction = await gpt4oMiniService.extractTerms();
    if (extraction) {
      io.emit('terms:extracted', extraction);
      console.log(`[Terms] Extracted: ${extraction.terms.join(', ')}`);
      
      // Save extracted terms to database if meeting is active
      if (activeMeetingId) {
        try {
          await storageService.saveExtractedTerms(activeMeetingId, extraction.terms);
        } catch (error) {
          console.error('Error saving extracted terms:', error);
        }
      }
      
      // Fetch web definitions for terms not in context AND with frequency >= 3
      const termsNeedingDefinitions = [];
      
      for (const term of extraction.terms) {
        // Skip if already has contextual definition
        if (contextualIntelligence.getContextualDefinition(term)) {
          continue;
        }
        
        // Check frequency in database (only fetch definitions for terms with 3+ mentions)
        if (activeMeetingId) {
          try {
            const frequencyResult = await db.query(
              'SELECT frequency FROM extracted_terms WHERE meeting_id = $1 AND term = $2',
              [activeMeetingId, term]
            );
            
            const frequency = frequencyResult.rows.length > 0 ? frequencyResult.rows[0].frequency : 1;
            
            if (frequency >= 3) {
              termsNeedingDefinitions.push(term);
              console.log(`[Knowledge] Term "${term}" has ${frequency} mentions - queuing for definition`);
            } else {
              console.log(`[Knowledge] Term "${term}" has ${frequency} mentions - skipping definition (needs 3+)`);
            }
          } catch (error) {
            console.error(`Error checking frequency for term "${term}":`, error);
          }
        }
      }
      
      if (termsNeedingDefinitions.length > 0) {
        console.log(`[Knowledge] Fetching definitions for ${termsNeedingDefinitions.length} high-frequency terms: ${termsNeedingDefinitions.join(', ')}`);
        const definitions = await knowledgeService.searchTermDefinitions(termsNeedingDefinitions);
        if (definitions.length > 0) {
          io.emit('definitions:updated', definitions);
          console.log(`[Knowledge] Found ${definitions.length} web definitions`);
          
          // Save definitions to database
          for (const def of definitions) {
            try {
              await storageService.saveTermDefinition(
                def.term,
                def.definition.summary,
                def.definition.sources
              );
            } catch (error) {
              console.error('Error saving term definition:', error);
            }
          }
        }
      }
    }
  }
});

transcriptionService.on('error', (error) => {
  console.error('Deepgram service error:', error);
  io.emit('transcription:error', { 
    message: 'Transcription service error', 
    timestamp: Date.now() 
  });
});

transcriptionService.on('speechStarted', () => {
  io.emit('speech:started', { timestamp: Date.now() });
});

transcriptionService.on('utteranceEnd', (data) => {
  io.emit('utterance:end', { timestamp: Date.now(), data });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Create audio processor for this client
  audioProcessors.set(socket.id, new AudioProcessor());
  
  // Send connection status and metrics
  socket.emit('service:status', {
    deepgram: transcriptionService.isConnected,
    activeMeetingId,
    metrics: {
      deepgram: transcriptionService.getMetrics(),
      gpt4oMini: gpt4oMiniService.getMetrics(),
      knowledge: knowledgeService.getCurrentProvider()
    }
  });
  
  // Meeting management events
  socket.on('meeting:start', async (data) => {
    try {
      const meeting = await meetingService.createMeeting(data);
      activeMeetingId = meeting.id;
      
      // Set meeting context for contextual intelligence
      contextualIntelligence.setCurrentMeeting(meeting.id);
      gpt4oMiniService.reset();
      
      io.emit('meeting:started', meeting);
      console.log(`[Meeting] Started new meeting: ${meeting.id}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
      socket.emit('meeting:error', { message: 'Failed to start meeting' });
    }
  });
  
  socket.on('meeting:end', async () => {
    if (activeMeetingId) {
      try {
        // Collect usage data before resetting services
        const usageData = {
          llm: [gpt4oMiniService.getUsageForMeeting()],
          transcription: [transcriptionService.getActiveProvider().getUsageForMeeting()],
          knowledge: [knowledgeService.getActiveProvider().getUsageForMeeting()]
        };
        
        // Store usage data in database
        try {
          await meetingService.storeMeetingCosts(activeMeetingId, usageData);
          console.log(`[Meeting] Stored cost data for meeting ${activeMeetingId}`);
        } catch (error) {
          console.error('[Meeting] Error storing cost data:', error);
        }
        
        const meeting = await meetingService.endMeeting(activeMeetingId);
        io.emit('meeting:ended', meeting);
        console.log(`[Meeting] Ended meeting: ${activeMeetingId}`);
        activeMeetingId = null;
        storageService.clearSequenceCache(meeting.id);
        // Reset intelligence services when meeting ends
        contextualIntelligence.reset();
        gpt4oMiniService.reset();
        // Reset usage tracking on services
        transcriptionService.getActiveProvider().resetMetrics();
        knowledgeService.getActiveProvider().resetUsageTracking();
        console.log(`[Meeting] Reset intelligence services after ending meeting`);
      } catch (error) {
        console.error('Error ending meeting:', error);
        socket.emit('meeting:error', { message: 'Failed to end meeting' });
      }
    }
  });
  
  socket.on('meeting:getActive', async () => {
    socket.emit('meeting:active', activeMeetingId ? 
      await meetingService.getMeeting(activeMeetingId) : null);
  });
  
  // Handle switching meeting context (for viewing historical meetings)
  socket.on('meeting:setContext', (meetingId) => {
    if (meetingId) {
      // Reset services before switching context
      gpt4oMiniService.reset();
      contextualIntelligence.setCurrentMeeting(meetingId);
      console.log(`[Meeting] Switched context to meeting: ${meetingId}`);
      // Emit event to clear current intelligence data on frontend
      socket.emit('intelligence:reset');
    }
  });
  
  // Handle clearing transcript and intelligence data
  socket.on('transcript:clear', () => {
    console.log('[Meeting] Clearing transcript and intelligence data');
    // Reset intelligence services but keep meeting context
    gpt4oMiniService.reset();
    if (activeMeetingId) {
      // Clear the meeting data but keep the meeting ID active
      contextualIntelligence.reset(activeMeetingId);
    }
    // Notify frontend to clear intelligence displays
    socket.emit('intelligence:reset');
  });
  
  let audioChunkCount = 0;
  socket.on('audio:chunk', async (data) => {
    try {
      // Require active meeting for audio processing
      if (!activeMeetingId) {
        socket.emit('audio:error', {
          message: 'No active meeting. Please start a meeting before recording.',
          code: 'NO_ACTIVE_MEETING',
          timestamp: Date.now()
        });
        return;
      }
      
      const processor = audioProcessors.get(socket.id);
      if (!processor) {
        console.error('No audio processor for client:', socket.id);
        return;
      }
      
      audioChunkCount++;
      
      let audioBuffer;
      
      // Handle different audio data formats
      if (typeof data === 'string') {
        // Base64 encoded audio
        audioBuffer = processor.base64ToBuffer(data);
      } else if (data.audio) {
        // Object with audio property
        if (typeof data.audio === 'string') {
          audioBuffer = processor.base64ToBuffer(data.audio);
        } else if (Array.isArray(data.audio)) {
          // Convert array of Int16 values to Buffer
          const int16Array = new Int16Array(data.audio);
          audioBuffer = Buffer.from(int16Array.buffer);
        } else {
          audioBuffer = Buffer.from(data.audio);
        }
      } else {
        // Direct buffer/array
        audioBuffer = Buffer.from(data);
      }
      
      // Log audio stats every 10 chunks
      if (audioChunkCount % 10 === 0) {
        const audioLevel = processor.calculateAudioLevel(audioBuffer);
        console.log(`Received ${audioChunkCount} chunks | Audio level: ${(audioLevel * 100).toFixed(3)}% | Buffer size: ${audioBuffer.length}`);
      }
      
      // Process audio (convert format if needed)
      const processedAudio = processor.processAudioChunk(audioBuffer, {
        inputSampleRate: data.sampleRate || 48000,
        inputChannels: data.channels || 1
      });
      
      // Buffer and send to Deepgram
      const bufferedData = processor.bufferChunk(processedAudio);
      if (bufferedData) {
        const audioLevel = processor.calculateAudioLevel(bufferedData);
        console.log(`Sending to Deepgram - Audio level: ${(audioLevel * 100).toFixed(3)}% | Size: ${bufferedData.length} bytes`);
        
        const sent = transcriptionService.sendAudio(bufferedData);
        if (!sent) {
          socket.emit('transcription:warning', {
            message: 'Audio buffered, waiting for connection',
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      socket.emit('audio:error', {
        message: 'Failed to process audio',
        timestamp: Date.now()
      });
    }
  });
  
  socket.on('audio:stop', () => {
    const processor = audioProcessors.get(socket.id);
    if (processor) {
      // Flush any remaining buffered audio
      const remaining = processor.flush();
      if (remaining && remaining.length > 0) {
        transcriptionService.sendAudio(remaining);
      }
    }
    console.log('Audio streaming stopped for client:', socket.id);
  });
  
  socket.on('metrics:request', () => {
    socket.emit('metrics:response', {
      deepgram: transcriptionService.getMetrics(),
      gpt4oMini: gpt4oMiniService.getMetrics(),
      contextual: contextualIntelligence.getMetrics(),
      knowledge: knowledgeService.getCurrentProvider()
    });
  });
  
  // Interactive intelligence features
  socket.on('intelligence:talking-points', async (topic) => {
    try {
      const talkingPoints = await contextualIntelligence.generateTalkingPoints(topic);
      socket.emit('intelligence:talking-points-response', {
        topic,
        points: talkingPoints,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error generating talking points:', error);
      socket.emit('intelligence:error', { 
        message: 'Failed to generate talking points',
        timestamp: Date.now()
      });
    }
  });
  
  socket.on('intelligence:rolling-summary', async (duration) => {
    try {
      const summary = await contextualIntelligence.getRollingSummary(duration);
      socket.emit('intelligence:summary-response', {
        summary,
        duration,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      socket.emit('intelligence:error', {
        message: 'Failed to generate summary',
        timestamp: Date.now()
      });
    }
  });
  
  socket.on('intelligence:get-glossary', () => {
    const glossary = contextualIntelligence.getMeetingGlossary();
    socket.emit('intelligence:glossary-response', {
      glossary,
      timestamp: Date.now()
    });
  });
  
  socket.on('intelligence:get-topic-flow', () => {
    const topicFlow = contextualIntelligence.getTopicFlow();
    socket.emit('intelligence:topic-flow-response', {
      topics: topicFlow,
      timestamp: Date.now()
    });
  });

  // Get provider availability based on API keys
  socket.on('providers:check', () => {
    try {
      // Check which providers have valid API keys (not empty and not placeholder)
      const isValidKey = (key) => {
        return key && 
               key !== '' && 
               key !== 'PLACEHOLDER_UPDATE_ME' &&
               key !== 'your_api_key_here' &&
               !key.includes('your_') &&
               !key.includes('PLACEHOLDER');
      };
      
      const providerStatus = {
        llm: {
          openai: isValidKey(process.env.OPENAI_API_KEY),
          anthropic: isValidKey(process.env.ANTHROPIC_API_KEY),
          gemini: isValidKey(process.env.GEMINI_API_KEY)
        },
        transcription: {
          deepgram: isValidKey(process.env.DEEPGRAM_API_KEY),
          assemblyai: isValidKey(process.env.ASSEMBLYAI_API_KEY),
          whisper: isValidKey(process.env.OPENAI_API_KEY), // Uses OpenAI key
          google: isValidKey(process.env.GOOGLE_SPEECH_API_KEY),
          azure: isValidKey(process.env.AZURE_SPEECH_KEY) && isValidKey(process.env.AZURE_SPEECH_REGION),
          revai: isValidKey(process.env.REVAI_API_KEY),
          speechmatics: isValidKey(process.env.SPEECHMATICS_API_KEY)
        },
        knowledge: {
          tavily: isValidKey(process.env.TAVILY_API_KEY),
          exa: isValidKey(process.env.EXA_API_KEY),
          perplexity: isValidKey(process.env.PERPLEXITY_API_KEY),
          serpapi: isValidKey(process.env.SERPAPI_KEY),
          brave: isValidKey(process.env.BRAVE_API_KEY)
        }
      };
      
      socket.emit('providers:status', providerStatus);
    } catch (error) {
      console.error('Error checking provider status:', error);
      socket.emit('providers:status', { error: 'Failed to check provider status' });
    }
  });
  
  // Settings management
  socket.on('settings:get', () => {
    try {
      // Load settings from environment variables and defaults
      const settings = {
        deepgramApiKey: process.env.DEEPGRAM_API_KEY ? '***configured***' : '',
        openaiApiKey: process.env.OPENAI_API_KEY ? '***configured***' : '',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ? '***configured***' : '',
        geminiApiKey: process.env.GEMINI_API_KEY ? '***configured***' : '',
        tavilyApiKey: process.env.TAVILY_API_KEY ? '***configured***' : '',
        llmProvider: process.env.LLM_PROVIDER || 'openai',
        llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
        maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH) || 8000,
        enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
        autoSaveInterval: parseInt(process.env.AUTO_SAVE_INTERVAL) || 30,
        transcriptionConfidenceThreshold: parseFloat(process.env.TRANSCRIPTION_CONFIDENCE_THRESHOLD) || 0.8,
        enableContextualIntelligence: process.env.ENABLE_CONTEXTUAL_INTELLIGENCE !== 'false',
        enableKnowledgeRetrieval: process.env.ENABLE_KNOWLEDGE_RETRIEVAL !== 'false',
        cacheExpiryHours: parseInt(process.env.CACHE_EXPIRY_HOURS) || 24
      };

      socket.emit('settings:response', {
        success: true,
        settings
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      socket.emit('settings:response', {
        success: false,
        error: 'Failed to load settings'
      });
    }
  });

  socket.on('models:fetch', async (data) => {
    try {
      const { provider } = data;
      let apiKey;
      
      // Get the appropriate API key for the provider
      switch (provider) {
        case 'openai':
          apiKey = process.env.OPENAI_API_KEY;
          break;
        case 'anthropic':
          apiKey = process.env.ANTHROPIC_API_KEY;
          break;
        case 'gemini':
          apiKey = process.env.GEMINI_API_KEY;
          break;
      }
      
      const models = await modelRegistry.getAvailableModels(provider, apiKey);
      
      socket.emit('models:response', {
        success: true,
        provider,
        models
      });
    } catch (error) {
      console.error('Error fetching models:', error);
      socket.emit('models:response', {
        success: false,
        error: 'Failed to fetch models',
        provider: data.provider
      });
    }
  });

  socket.on('settings:save', (newSettings) => {
    try {
      console.log('[Settings] Received settings update:', {
        ...newSettings,
        deepgramApiKey: newSettings.deepgramApiKey ? '[REDACTED]' : 'empty',
        openaiApiKey: newSettings.openaiApiKey ? '[REDACTED]' : 'empty',
        anthropicApiKey: newSettings.anthropicApiKey ? '[REDACTED]' : 'empty',
        geminiApiKey: newSettings.geminiApiKey ? '[REDACTED]' : 'empty',
        tavilyApiKey: newSettings.tavilyApiKey ? '[REDACTED]' : 'empty'
      });

      // In a production environment, you would save these to a secure configuration store
      // For now, we'll just acknowledge receipt and provide guidance
      
      let requiresRestart = false;
      const warnings = [];

      // Check if API keys have changed (would require service restart)
      if (newSettings.deepgramApiKey && newSettings.deepgramApiKey !== '***configured***' && newSettings.deepgramApiKey !== process.env.DEEPGRAM_API_KEY) {
        warnings.push('Deepgram API key update requires service restart');
        requiresRestart = true;
      }
      
      if (newSettings.openaiApiKey && newSettings.openaiApiKey !== '***configured***' && newSettings.openaiApiKey !== process.env.OPENAI_API_KEY) {
        warnings.push('OpenAI API key update requires service restart');
        requiresRestart = true;
      }
      
      if (newSettings.anthropicApiKey && newSettings.anthropicApiKey !== '***configured***' && newSettings.anthropicApiKey !== process.env.ANTHROPIC_API_KEY) {
        warnings.push('Anthropic API key update requires service restart');
        requiresRestart = true;
      }
      
      if (newSettings.geminiApiKey && newSettings.geminiApiKey !== '***configured***' && newSettings.geminiApiKey !== process.env.GEMINI_API_KEY) {
        warnings.push('Gemini API key update requires service restart');
        requiresRestart = true;
      }
      
      if (newSettings.tavilyApiKey && newSettings.tavilyApiKey !== '***configured***' && newSettings.tavilyApiKey !== process.env.TAVILY_API_KEY) {
        warnings.push('Tavily API key update requires service restart');
        requiresRestart = true;
      }

      // Check if LLM provider or model has changed
      if (newSettings.llmProvider && newSettings.llmProvider !== (process.env.LLM_PROVIDER || 'openai')) {
        warnings.push('LLM provider changed - will take effect immediately');
        process.env.LLM_PROVIDER = newSettings.llmProvider;
      }
      
      if (newSettings.llmModel && newSettings.llmModel !== (process.env.LLM_MODEL || 'gpt-4o-mini')) {
        warnings.push('LLM model changed - will take effect immediately');
        process.env.LLM_MODEL = newSettings.llmModel;
      }

      // Apply runtime settings that don't require restart
      if (newSettings.maxContextLength && contextualIntelligence.setMaxContextLength) {
        contextualIntelligence.setMaxContextLength(newSettings.maxContextLength);
      }
      
      // Update LLM settings in contextual intelligence service
      contextualIntelligence.updateLLMSettings(newSettings);
      
      // Update transcription provider
      if (newSettings.transcriptionProvider) {
        const switched = transcriptionService.setProvider(newSettings.transcriptionProvider);
        if (switched) {
          warnings.push(`Transcription provider switched to ${newSettings.transcriptionProvider}`);
          // Reconnect with new provider
          transcriptionService.disconnect();
          transcriptionService.connect().catch(err => {
            console.error('Failed to connect to new transcription provider:', err);
          });
        }
      }
      
      // Update knowledge provider
      if (newSettings.knowledgeProvider) {
        const switched = knowledgeService.setProvider(newSettings.knowledgeProvider);
        if (switched) {
          warnings.push(`Knowledge provider switched to ${newSettings.knowledgeProvider}`);
        }
      }
      
      // Update provider API keys if needed
      knowledgeService.updateSettings(newSettings);
      
      // Get current provider info for confirmation
      const providerInfo = contextualIntelligence.getLLMProvider();
      console.log(`[Settings] LLM Provider updated to: ${providerInfo.provider} with model: ${providerInfo.model}`);

      socket.emit('settings:saved', {
        success: true,
        message: warnings.length > 0 
          ? `Settings saved. Note: ${warnings.join(', ')}`
          : 'Settings saved successfully',
        requiresRestart,
        warnings
      });

    } catch (error) {
      console.error('Error saving settings:', error);
      socket.emit('settings:saved', {
        success: false,
        error: 'Failed to save settings'
      });
    }
  });
  
  // Global correction events
  socket.on('corrections:add', async (data) => {
    try {
      const { original, corrected, options = {} } = data;
      const correction = await correctionService.addCorrection(original, corrected, options);
      
      // Broadcast new correction to all clients
      io.emit('corrections:added', correction);
      
      socket.emit('corrections:add-response', {
        success: true,
        correction
      });
    } catch (error) {
      console.error('Error adding correction via WebSocket:', error);
      socket.emit('corrections:add-response', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('corrections:remove', async (correctionId) => {
    try {
      const correction = await correctionService.removeCorrection(correctionId);
      
      // Broadcast correction removal to all clients
      io.emit('corrections:removed', correction);
      
      socket.emit('corrections:remove-response', {
        success: true,
        correction
      });
    } catch (error) {
      console.error('Error removing correction via WebSocket:', error);
      socket.emit('corrections:remove-response', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('corrections:get-suggestions', (term) => {
    try {
      const suggestions = correctionService.findSuggestions(term);
      socket.emit('corrections:suggestions-response', {
        term,
        suggestions,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error getting correction suggestions:', error);
      socket.emit('corrections:suggestions-response', {
        term,
        suggestions: [],
        error: error.message,
        timestamp: Date.now()
      });
    }
  });

  socket.on('corrections:get-all', async () => {
    try {
      const corrections = await correctionService.getAllCorrections();
      socket.emit('corrections:all-response', corrections);
    } catch (error) {
      console.error('Error getting all corrections:', error);
      socket.emit('corrections:all-response', []);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    audioProcessors.delete(socket.id);
  });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
