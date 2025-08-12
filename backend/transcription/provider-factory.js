const WebSocket = require('ws');
const axios = require('axios');
const { EventEmitter } = require('events');

class TranscriptionProviderFactory extends EventEmitter {
  constructor() {
    super();
    this.providers = new Map();
    this.currentProvider = process.env.TRANSCRIPTION_PROVIDER || 'deepgram';
    this.activeConnection = null;
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
      this.providers.set('deepgram', {
        type: 'deepgram',
        apiKey: process.env.DEEPGRAM_API_KEY,
        name: 'Deepgram',
        description: 'Real-time streaming transcription with Nova-2 model',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          languages: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'zh'],
          maxAudioLength: 'unlimited'
        }
      });
    }

    // Initialize AssemblyAI
    if (process.env.ASSEMBLYAI_API_KEY) {
      this.providers.set('assemblyai', {
        type: 'assemblyai',
        apiKey: process.env.ASSEMBLYAI_API_KEY,
        name: 'AssemblyAI',
        description: 'Accurate transcription with speaker detection and summarization',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          summarization: true,
          sentimentAnalysis: true,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja'],
          maxAudioLength: 'unlimited'
        }
      });
    }

    // Initialize OpenAI Whisper
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('whisper', {
        type: 'whisper',
        apiKey: process.env.OPENAI_API_KEY,
        name: 'OpenAI Whisper',
        description: 'High-accuracy transcription with Whisper large-v3 model',
        features: {
          streaming: false, // Whisper API doesn't support streaming yet
          realtime: false,
          punctuation: true,
          diarization: false,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
          maxAudioLength: '25MB',
          translation: true // Can translate to English
        }
      });
    }

    // Initialize Google Speech-to-Text
    if (process.env.GOOGLE_SPEECH_API_KEY) {
      this.providers.set('google', {
        type: 'google',
        apiKey: process.env.GOOGLE_SPEECH_API_KEY,
        name: 'Google Speech-to-Text',
        description: 'Google Cloud Speech-to-Text with enhanced models',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'th'],
          maxAudioLength: 'unlimited',
          wordTimeOffsets: true
        }
      });
    }

    // Initialize Azure Speech Services
    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
      this.providers.set('azure', {
        type: 'azure',
        apiKey: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
        name: 'Azure Speech Services',
        description: 'Microsoft Azure Cognitive Services Speech-to-Text',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
          maxAudioLength: 'unlimited',
          customModels: true
        }
      });
    }

    // Initialize Rev.ai
    if (process.env.REVAI_API_KEY) {
      this.providers.set('revai', {
        type: 'revai',
        apiKey: process.env.REVAI_API_KEY,
        name: 'Rev.ai',
        description: 'Professional-grade transcription with high accuracy',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          languages: ['en'],
          maxAudioLength: 'unlimited',
          vocabularyCustomization: true
        }
      });
    }

    // Initialize Speechmatics
    if (process.env.SPEECHMATICS_API_KEY) {
      this.providers.set('speechmatics', {
        type: 'speechmatics',
        apiKey: process.env.SPEECHMATICS_API_KEY,
        name: 'Speechmatics',
        description: 'Enterprise speech recognition with 48 languages',
        features: {
          streaming: true,
          realtime: true,
          punctuation: true,
          diarization: true,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl'],
          maxAudioLength: 'unlimited',
          customDictionary: true
        }
      });
    }

    console.log(`[Transcription Provider] Initialized ${this.providers.size} providers`);
    console.log(`[Transcription Provider] Active provider: ${this.currentProvider}`);
  }

  async connect() {
    const provider = this.providers.get(this.currentProvider);
    
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not configured`);
    }

    switch (provider.type) {
      case 'deepgram':
        return await this.connectDeepgram(provider);
      case 'assemblyai':
        return await this.connectAssemblyAI(provider);
      case 'google':
        return await this.connectGoogle(provider);
      case 'azure':
        return await this.connectAzure(provider);
      case 'revai':
        return await this.connectRevAI(provider);
      case 'speechmatics':
        return await this.connectSpeechmatics(provider);
      case 'whisper':
        // Whisper doesn't use WebSocket
        console.log('[Transcription] Whisper API ready for batch processing');
        return true;
      default:
        throw new Error(`Unknown provider type: ${provider.type}`);
    }
  }

  async connectDeepgram(provider) {
    const url = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      model: 'nova-2',
      language: 'en',
      punctuate: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      vad_events: 'true'
    });

    this.activeConnection = new WebSocket(url, {
      headers: {
        'Authorization': `Token ${provider.apiKey}`
      }
    });

    this.activeConnection.on('open', () => {
      console.log('[Deepgram] WebSocket connected');
      this.emit('connected', { provider: 'deepgram' });
      this.startKeepAlive();
    });

    this.activeConnection.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      if (response.type === 'Results') {
        const transcript = response.channel.alternatives[0];
        this.emit('transcript', {
          text: transcript.transcript,
          isFinal: response.is_final,
          confidence: transcript.confidence,
          provider: 'deepgram'
        });
      } else if (response.type === 'UtteranceEnd') {
        this.emit('utteranceEnd', { provider: 'deepgram' });
      } else if (response.type === 'SpeechStarted') {
        this.emit('speechStarted', { provider: 'deepgram' });
      }
    });

    this.activeConnection.on('error', (error) => {
      console.error('[Deepgram] WebSocket error:', error);
      this.emit('error', { provider: 'deepgram', error });
    });

    this.activeConnection.on('close', () => {
      console.log('[Deepgram] WebSocket closed');
      this.emit('disconnected', { provider: 'deepgram' });
      this.stopKeepAlive();
    });

    return this.activeConnection;
  }

  async connectAssemblyAI(provider) {
    const url = 'wss://api.assemblyai.com/v2/realtime/ws?' + new URLSearchParams({
      sample_rate: '16000'
    });

    this.activeConnection = new WebSocket(url, {
      headers: {
        'Authorization': provider.apiKey
      }
    });

    this.activeConnection.on('open', () => {
      console.log('[AssemblyAI] WebSocket connected');
      this.emit('connected', { provider: 'assemblyai' });
      
      // Send session configuration
      this.activeConnection.send(JSON.stringify({
        audio_data: null,
        word_boost: [],
        encoding: 'pcm_s16le',
        sample_rate: 16000
      }));
    });

    this.activeConnection.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      if (response.message_type === 'PartialTranscript') {
        this.emit('transcript', {
          text: response.text,
          isFinal: false,
          confidence: response.confidence || 0.9,
          provider: 'assemblyai'
        });
      } else if (response.message_type === 'FinalTranscript') {
        this.emit('transcript', {
          text: response.text,
          isFinal: true,
          confidence: response.confidence || 0.95,
          provider: 'assemblyai'
        });
      }
    });

    this.activeConnection.on('error', (error) => {
      console.error('[AssemblyAI] WebSocket error:', error);
      this.emit('error', { provider: 'assemblyai', error });
    });

    return this.activeConnection;
  }

  async connectGoogle(provider) {
    // Google Speech-to-Text implementation
    // This would require the @google-cloud/speech package
    console.log('[Google] Streaming transcription ready');
    
    // For Google, we'd typically use their Node.js client library
    // This is a simplified example
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient({
      apiKey: provider.apiKey
    });

    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableSpeakerDiarization: true,
        diarizationSpeakerCount: 2,
        model: 'latest_long'
      },
      interimResults: true
    };

    this.activeConnection = client
      .streamingRecognize(request)
      .on('data', (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          this.emit('transcript', {
            text: data.results[0].alternatives[0].transcript,
            isFinal: data.results[0].isFinal,
            confidence: data.results[0].alternatives[0].confidence || 0.9,
            provider: 'google'
          });
        }
      })
      .on('error', (error) => {
        console.error('[Google] Stream error:', error);
        this.emit('error', { provider: 'google', error });
      });

    return this.activeConnection;
  }

  async connectAzure(provider) {
    // Azure Speech Services implementation
    const sdk = require('microsoft-cognitiveservices-speech-sdk');
    
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      provider.apiKey,
      provider.region
    );
    speechConfig.speechRecognitionLanguage = 'en-US';
    speechConfig.enableDictation();
    
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    this.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    this.recognizer.recognizing = (s, e) => {
      this.emit('transcript', {
        text: e.result.text,
        isFinal: false,
        confidence: 0.9,
        provider: 'azure'
      });
    };
    
    this.recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        this.emit('transcript', {
          text: e.result.text,
          isFinal: true,
          confidence: 0.95,
          provider: 'azure'
        });
      }
    };
    
    await this.recognizer.startContinuousRecognitionAsync();
    console.log('[Azure] Continuous recognition started');
    
    return this.recognizer;
  }

  async connectRevAI(provider) {
    const url = 'wss://api.rev.ai/speechtotext/v1/stream';

    this.activeConnection = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'audio/x-raw',
        'Content-Type-Options': 'sample_rate=16000;encoding=pcm_s16le;channels=1'
      }
    });

    this.activeConnection.on('open', () => {
      console.log('[Rev.ai] WebSocket connected');
      this.emit('connected', { provider: 'revai' });
    });

    this.activeConnection.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      if (response.type === 'partial') {
        this.emit('transcript', {
          text: response.value,
          isFinal: false,
          confidence: 0.9,
          provider: 'revai'
        });
      } else if (response.type === 'final') {
        this.emit('transcript', {
          text: response.value,
          isFinal: true,
          confidence: 0.95,
          provider: 'revai'
        });
      }
    });

    return this.activeConnection;
  }

  async connectSpeechmatics(provider) {
    const url = `wss://eu.rt.speechmatics.com/v2/en`;
    
    this.activeConnection = new WebSocket(url);

    this.activeConnection.on('open', () => {
      // Send authentication
      this.activeConnection.send(JSON.stringify({
        message: 'StartRecognition',
        audio_format: {
          type: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 16000
        },
        transcription_config: {
          language: 'en',
          enable_partials: true,
          enable_entities: true,
          diarization: 'speaker'
        },
        jwt: provider.apiKey
      }));
      
      console.log('[Speechmatics] WebSocket connected');
      this.emit('connected', { provider: 'speechmatics' });
    });

    this.activeConnection.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      if (response.message === 'AddPartialTranscript') {
        this.emit('transcript', {
          text: response.metadata.transcript,
          isFinal: false,
          confidence: 0.9,
          provider: 'speechmatics'
        });
      } else if (response.message === 'AddTranscript') {
        this.emit('transcript', {
          text: response.metadata.transcript,
          isFinal: true,
          confidence: response.metadata.confidence || 0.95,
          provider: 'speechmatics'
        });
      }
    });

    return this.activeConnection;
  }

  async transcribeFile(audioBuffer, options = {}) {
    const provider = this.providers.get(this.currentProvider);
    
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not configured`);
    }

    // For file-based transcription (useful for Whisper and others)
    switch (provider.type) {
      case 'whisper':
        return await this.transcribeWithWhisper(provider, audioBuffer, options);
      case 'deepgram':
        return await this.transcribeWithDeepgramREST(provider, audioBuffer, options);
      case 'assemblyai':
        return await this.transcribeWithAssemblyAIREST(provider, audioBuffer, options);
      default:
        throw new Error(`File transcription not implemented for ${provider.type}`);
    }
  }

  async transcribeWithWhisper(provider, audioBuffer, options) {
    const formData = new FormData();
    formData.append('file', audioBuffer, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', options.language || 'en');
    formData.append('response_format', 'json');
    
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          ...formData.getHeaders()
        }
      }
    );

    return {
      text: response.data.text,
      provider: 'whisper',
      isFinal: true,
      confidence: 0.95 // Whisper doesn't provide confidence scores
    };
  }

  async transcribeWithDeepgramREST(provider, audioBuffer, options) {
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${provider.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        params: {
          model: 'nova-2',
          language: options.language || 'en',
          punctuate: true,
          diarize: true,
          smart_format: true
        }
      }
    );

    const result = response.data.results.channels[0].alternatives[0];
    return {
      text: result.transcript,
      provider: 'deepgram',
      isFinal: true,
      confidence: result.confidence,
      words: result.words // Word-level timestamps
    };
  }

  async transcribeWithAssemblyAIREST(provider, audioBuffer, options) {
    // Upload the audio
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioBuffer,
      {
        headers: {
          'Authorization': provider.apiKey,
          'Content-Type': 'application/octet-stream'
        }
      }
    );

    // Request transcription
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadResponse.data.upload_url,
        speaker_labels: true,
        auto_chapters: true,
        entity_detection: true,
        sentiment_analysis: true
      },
      {
        headers: {
          'Authorization': provider.apiKey
        }
      }
    );

    // Poll for completion
    let transcript;
    while (true) {
      const pollingResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptResponse.data.id}`,
        {
          headers: {
            'Authorization': provider.apiKey
          }
        }
      );

      if (pollingResponse.data.status === 'completed') {
        transcript = pollingResponse.data;
        break;
      } else if (pollingResponse.data.status === 'error') {
        throw new Error('Transcription failed');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return {
      text: transcript.text,
      provider: 'assemblyai',
      isFinal: true,
      confidence: transcript.confidence,
      words: transcript.words,
      speakers: transcript.utterances,
      chapters: transcript.chapters,
      entities: transcript.entities,
      sentiment: transcript.sentiment_analysis_results
    };
  }

  sendAudio(audioData) {
    if (!this.activeConnection) {
      console.error('[Transcription] No active connection');
      return false;
    }

    const provider = this.providers.get(this.currentProvider);
    
    switch (provider.type) {
      case 'deepgram':
      case 'revai':
      case 'speechmatics':
        // These providers accept raw audio directly
        if (this.activeConnection.readyState === WebSocket.OPEN) {
          this.activeConnection.send(audioData);
          return true;
        }
        break;
        
      case 'assemblyai':
        // AssemblyAI needs base64 encoded audio
        if (this.activeConnection.readyState === WebSocket.OPEN) {
          const base64Audio = audioData.toString('base64');
          this.activeConnection.send(JSON.stringify({
            audio_data: base64Audio
          }));
          return true;
        }
        break;
        
      case 'google':
      case 'azure':
        // These use their own SDK methods
        if (this.activeConnection) {
          this.activeConnection.write(audioData);
          return true;
        }
        break;
    }

    return false;
  }

  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      if (this.activeConnection && this.activeConnection.readyState === WebSocket.OPEN) {
        this.activeConnection.send(JSON.stringify({ type: 'KeepAlive' }));
        console.log('[Transcription] Keepalive sent');
      }
    }, 10000);
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  disconnect() {
    this.stopKeepAlive();
    
    if (this.activeConnection) {
      if (this.activeConnection.close) {
        this.activeConnection.close();
      } else if (this.activeConnection.end) {
        this.activeConnection.end();
      }
      this.activeConnection = null;
    }

    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync();
      this.recognizer = null;
    }
  }

  setProvider(providerName) {
    if (this.providers.has(providerName)) {
      this.disconnect();
      this.currentProvider = providerName;
      console.log(`[Transcription Provider] Switched to ${providerName}`);
      return true;
    }
    
    console.error(`[Transcription Provider] Provider ${providerName} not available`);
    return false;
  }

  getAvailableProviders() {
    return Array.from(this.providers.entries()).map(([key, provider]) => ({
      id: key,
      name: provider.name,
      description: provider.description,
      features: provider.features,
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
    if (settings.transcriptionProvider && this.providers.has(settings.transcriptionProvider)) {
      this.setProvider(settings.transcriptionProvider);
    }
  }

  get isConnected() {
    if (!this.activeConnection) return false;
    
    if (this.activeConnection.readyState !== undefined) {
      return this.activeConnection.readyState === WebSocket.OPEN;
    }
    
    return !!this.activeConnection;
  }

  getMetrics() {
    return {
      provider: this.currentProvider,
      connected: this.isConnected,
      availableProviders: this.providers.size
    };
  }
}

module.exports = TranscriptionProviderFactory;