const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const DeepgramService = require('./transcription/deepgram');
const { AudioProcessor } = require('./utils/audio');
const GPT4oMiniService = require('./llm/gpt4omini');
const TavilyService = require('./knowledge/tavily');

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

// Initialize services
const deepgramService = new DeepgramService(process.env.DEEPGRAM_API_KEY);
const gpt4oMiniService = new GPT4oMiniService();
const tavilyService = new TavilyService();
const audioProcessors = new Map(); // One processor per client

// Connect to Deepgram on server start
deepgramService.connect().catch(err => {
  console.error('Failed to initialize Deepgram:', err);
});

// Deepgram event handlers
deepgramService.on('transcript', async (transcript) => {
  // Broadcast transcript to all connected clients
  io.emit('transcript:update', transcript);
  
  // Add transcript to GPT-4o Mini for term extraction
  if (transcript.text && transcript.text.trim()) {
    console.log(`[GPT-4o Mini] Adding transcript: "${transcript.text}"`);
    gpt4oMiniService.addTranscript(transcript.text);
    
    // Try to extract terms (will only extract if conditions are met)
    const extraction = await gpt4oMiniService.extractTerms();
    if (extraction) {
      io.emit('terms:extracted', extraction);
      console.log(`[Terms] Extracted: ${extraction.terms.join(', ')}`);
      
      // Fetch definitions for extracted terms
      const definitions = await tavilyService.searchTerms(extraction.terms);
      if (definitions.length > 0) {
        io.emit('definitions:updated', definitions);
        console.log(`[Knowledge] Found ${definitions.length} definitions`);
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
    metrics: {
      deepgram: deepgramService.getMetrics(),
      gpt4oMini: gpt4oMiniService.getMetrics(),
      tavily: tavilyService.getMetrics()
    }
  });
  
  let audioChunkCount = 0;
  socket.on('audio:chunk', async (data) => {
    try {
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
      tavily: tavilyService.getMetrics()
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
