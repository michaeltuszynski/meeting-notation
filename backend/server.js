const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const DeepgramService = require('./transcription/deepgram');
const { AudioProcessor } = require('./utils/audio');
const GPT4oMiniService = require('./llm/gpt4omini');
const ContextualIntelligenceService = require('./llm/contextual-intelligence');
const TavilyService = require('./knowledge/tavily');
const PostgresService = require('./db/postgres');
const MeetingService = require('./services/meeting');
const StorageService = require('./services/storage');
const ReportService = require('./services/report');
const meetingRoutes = require('./routes/meetings');

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:4000' 
      : 'http://localhost:4000'
  },
  maxHttpBufferSize: 1e6 // 1MB for audio chunks
});

// Initialize database
const db = new PostgresService();
db.testConnection();

// Initialize services
const deepgramService = new DeepgramService(process.env.DEEPGRAM_API_KEY);
const gpt4oMiniService = new GPT4oMiniService();
const contextualIntelligence = new ContextualIntelligenceService();
const tavilyService = new TavilyService();
const meetingService = new MeetingService(db);
const storageService = new StorageService(db);
const reportService = new ReportService(db, storageService);
const audioProcessors = new Map(); // One processor per client

// Current active meeting
let activeMeetingId = null;

// API Routes - must be after service initialization
app.use('/api/meetings', meetingRoutes(meetingService, storageService, reportService));

// Connect to Deepgram on server start
deepgramService.connect().catch(err => {
  console.error('Failed to initialize Deepgram:', err);
});

// Deepgram event handlers
deepgramService.on('transcript', async (transcript) => {
  // Only process transcripts if there's an active meeting
  if (!activeMeetingId) {
    console.warn('Received transcript but no active meeting - ignoring');
    return;
  }
  
  // Broadcast transcript to all connected clients
  io.emit('transcript:update', transcript);
  
  // Save transcript to database
  if (transcript.text && transcript.text.trim()) {
    try {
      await storageService.saveTranscript(activeMeetingId, {
        text: transcript.text,
        isFinal: transcript.isFinal,
        confidence: transcript.confidence,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  }
  
  // Add transcript to both intelligence services
  if (transcript.text && transcript.text.trim()) {
    console.log(`[Intelligence] Processing transcript: "${transcript.text.substring(0, 50)}..."`);
    
    // Add to contextual intelligence for richer insights
    contextualIntelligence.addTranscript(transcript.text);
    
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
      
      // Fetch web definitions for terms not in context
      const termsNeedingDefinitions = extraction.terms.filter(term => {
        return !contextualIntelligence.getContextualDefinition(term);
      });
      
      if (termsNeedingDefinitions.length > 0) {
        const definitions = await tavilyService.searchTerms(termsNeedingDefinitions);
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

deepgramService.on('error', (error) => {
  console.error('Deepgram service error:', error);
  io.emit('transcription:error', { 
    message: 'Transcription service error', 
    timestamp: Date.now() 
  });
});

deepgramService.on('speechStarted', () => {
  io.emit('speech:started', { timestamp: Date.now() });
});

deepgramService.on('utteranceEnd', (data) => {
  io.emit('utterance:end', { timestamp: Date.now(), data });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Create audio processor for this client
  audioProcessors.set(socket.id, new AudioProcessor());
  
  // Send connection status and metrics
  socket.emit('service:status', {
    deepgram: deepgramService.isConnected,
    activeMeetingId,
    metrics: {
      deepgram: deepgramService.getMetrics(),
      gpt4oMini: gpt4oMiniService.getMetrics(),
      tavily: tavilyService.getMetrics()
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
        const meeting = await meetingService.endMeeting(activeMeetingId);
        io.emit('meeting:ended', meeting);
        console.log(`[Meeting] Ended meeting: ${activeMeetingId}`);
        activeMeetingId = null;
        storageService.clearSequenceCache(meeting.id);
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
      contextualIntelligence.setCurrentMeeting(meetingId);
      console.log(`[Meeting] Set context to meeting: ${meetingId}`);
    }
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
        
        const sent = deepgramService.sendAudio(bufferedData);
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
        deepgramService.sendAudio(remaining);
      }
    }
    console.log('Audio streaming stopped for client:', socket.id);
  });
  
  socket.on('metrics:request', () => {
    socket.emit('metrics:response', {
      deepgram: deepgramService.getMetrics(),
      gpt4oMini: gpt4oMiniService.getMetrics(),
      contextual: contextualIntelligence.getMetrics(),
      tavily: tavilyService.getMetrics()
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
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    audioProcessors.delete(socket.id);
  });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
