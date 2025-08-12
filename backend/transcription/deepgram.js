const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const EventEmitter = require('events');

class DeepgramService extends EventEmitter {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.deepgram = createClient(apiKey);
        this.connection = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.startTime = null;
        this.lastSpeaker = null;
        this.currentSegment = null;
        this.metrics = {
            totalLatency: 0,
            transcriptionCount: 0,
            avgLatency: 0
        };
        this.usageTracking = {
            totalAudioSeconds: 0,
            totalCost: 0,
            sessionStartTime: null,
            lastAudioTime: null
        };
    }

    async connect() {
        try {
            console.log('Connecting to Deepgram Nova-2...');
            
            this.connection = this.deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                punctuate: true,
                profanity_filter: false,
                interim_results: true,
                utterance_end_ms: 1000,
                vad_events: true,
                diarize: true,
                encoding: 'linear16',
                sample_rate: 16000,
                channels: 1
            });

            this.setupEventHandlers();
            this.setupKeepAlive();
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            console.log('Connected to Deepgram successfully');
            this.emit('connected');
            
        } catch (error) {
            console.error('Failed to connect to Deepgram:', error);
            this.emit('error', error);
            await this.handleReconnect();
        }
    }
    
    setupKeepAlive() {
        // Send keepalive message every 8 seconds to prevent timeout
        this.keepAliveInterval = setInterval(() => {
            if (this.connection && this.isConnected) {
                try {
                    this.connection.keepAlive();
                    console.log('Keepalive sent to Deepgram');
                } catch (error) {
                    console.error('Error sending keepalive:', error);
                }
            }
        }, 8000);
    }

    setupEventHandlers() {
        if (!this.connection) return;

        this.connection.on(LiveTranscriptionEvents.Open, () => {
            console.log('Deepgram WebSocket opened');
            this.isConnected = true;
            this.emit('open');
        });

        this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const latency = this.startTime ? Date.now() - this.startTime : 0;
            
            if (latency > 0) {
                this.metrics.totalLatency += latency;
                this.metrics.transcriptionCount++;
                this.metrics.avgLatency = this.metrics.totalLatency / this.metrics.transcriptionCount;
                
                if (latency > 300) {
                    console.warn(`⚠️ Deepgram latency exceeded 300ms: ${latency}ms`);
                }
            }

            const transcript = data.channel?.alternatives[0]?.transcript;
            const words = data.channel?.alternatives[0]?.words || [];
            
            if (transcript && transcript.trim() !== '') {
                // Process speaker information from words
                const speakerData = this.processSpeakerData(words);
                
                const result = {
                    text: transcript,
                    isFinal: data.is_final,
                    confidence: data.channel?.alternatives[0]?.confidence || 0,
                    timestamp: Date.now(),
                    latency: latency,
                    words: words,
                    speakers: speakerData.speakers,
                    speakerSegments: speakerData.segments,
                    speakerChanges: speakerData.changes
                };
                
                console.log(`Transcript (${latency}ms) [${speakerData.speakers.length} speakers]: ${transcript}`);
                this.emit('transcript', result);
                
                // Emit specific speaker events if there are speaker changes
                if (speakerData.changes.length > 0) {
                    this.emit('speakerChange', {
                        changes: speakerData.changes,
                        timestamp: Date.now(),
                        isFinal: data.is_final
                    });
                }
            }
            
            this.startTime = null;
        });

        this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
            console.log('Deepgram metadata:', data);
        });

        this.connection.on(LiveTranscriptionEvents.Error, (error) => {
            console.error('Deepgram error:', error);
            this.emit('error', error);
            this.handleReconnect();
        });

        this.connection.on(LiveTranscriptionEvents.Warning, (warning) => {
            console.warn('Deepgram warning:', warning);
        });

        this.connection.on(LiveTranscriptionEvents.Close, (event) => {
            console.log('Deepgram WebSocket closed', event);
            this.isConnected = false;
            this.emit('closed');
            this.handleReconnect();
        });

        this.connection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
            this.emit('utteranceEnd', data);
        });

        this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
            console.log('Speech detected');
            this.emit('speechStarted');
        });
    }

    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Reconnecting to Deepgram in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    sendAudio(audioData) {
        if (!this.isConnected || !this.connection) {
            console.warn('Cannot send audio: Deepgram not connected');
            return false;
        }

        try {
            this.startTime = Date.now();
            this.connection.send(audioData);
            
            // Track usage for cost calculation
            if (!this.usageTracking.sessionStartTime) {
                this.usageTracking.sessionStartTime = Date.now();
            }
            this.usageTracking.lastAudioTime = Date.now();
            
            // Estimate audio duration from buffer size (16kHz, 16-bit, mono)
            // 8192 bytes = 4096 samples = ~256ms at 16kHz
            const estimatedSeconds = audioData.length / (16000 * 2); // 2 bytes per sample
            this.usageTracking.totalAudioSeconds += estimatedSeconds;
            
            // Calculate cost (Nova-2 pricing: $0.0043 per minute)
            const costPerSecond = 0.0043 / 60;
            this.usageTracking.totalCost += estimatedSeconds * costPerSecond;
            
            return true;
        } catch (error) {
            console.error('Error sending audio to Deepgram:', error);
            this.emit('error', error);
            return false;
        }
    }

    disconnect() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        
        if (this.connection) {
            console.log('Disconnecting from Deepgram...');
            this.connection.finish();
            this.connection = null;
            this.isConnected = false;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            ...this.usageTracking,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    getUsageForMeeting() {
        return {
            provider: 'deepgram',
            model: 'nova-2',
            durationSeconds: this.usageTracking.totalAudioSeconds,
            totalCost: this.usageTracking.totalCost,
            sessionStartTime: this.usageTracking.sessionStartTime,
            lastAudioTime: this.usageTracking.lastAudioTime
        };
    }

    processSpeakerData(words) {
        const speakers = new Set();
        const segments = [];
        const changes = [];
        
        if (!words || words.length === 0) {
            return { speakers: [], segments: [], changes: [] };
        }
        
        let currentSpeaker = null;
        let segmentStart = null;
        let segmentWords = [];
        
        words.forEach((word, index) => {
            const speakerId = word.speaker !== undefined ? word.speaker : 0;
            speakers.add(speakerId);
            
            // Detect speaker change
            if (currentSpeaker !== speakerId) {
                // Finish previous segment if exists
                if (currentSpeaker !== null && segmentWords.length > 0) {
                    const segmentEnd = segmentWords[segmentWords.length - 1].end || segmentWords[segmentWords.length - 1].start;
                    segments.push({
                        speaker: currentSpeaker,
                        startTime: segmentStart,
                        endTime: segmentEnd,
                        text: segmentWords.map(w => w.word).join(' '),
                        words: segmentWords,
                        confidence: segmentWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / segmentWords.length
                    });
                }
                
                // Track global speaker change for notifications and database
                if (this.lastSpeaker !== null && this.lastSpeaker !== speakerId) {
                    console.log(`Speaker change detected: ${this.lastSpeaker} → ${speakerId} at ${word.start}s`);
                    // Record actual speaker-to-speaker transitions
                    changes.push({
                        fromSpeaker: this.lastSpeaker,
                        toSpeaker: speakerId,
                        timestamp: word.start || 0,
                        wordIndex: index
                    });
                } else if (this.lastSpeaker === null) {
                    // Record initial speaker detection
                    changes.push({
                        fromSpeaker: null,
                        toSpeaker: speakerId,
                        timestamp: word.start || 0,
                        wordIndex: index
                    });
                }
                
                // Start new segment
                currentSpeaker = speakerId;
                segmentStart = word.start || 0;
                segmentWords = [];
                
                // Update last speaker
                this.lastSpeaker = speakerId;
            }
            
            segmentWords.push(word);
        });
        
        // Finish final segment
        if (currentSpeaker !== null && segmentWords.length > 0) {
            const segmentEnd = segmentWords[segmentWords.length - 1].end || segmentWords[segmentWords.length - 1].start;
            segments.push({
                speaker: currentSpeaker,
                startTime: segmentStart,
                endTime: segmentEnd,
                text: segmentWords.map(w => w.word).join(' '),
                words: segmentWords,
                confidence: segmentWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / segmentWords.length
            });
        }
        
        return {
            speakers: Array.from(speakers).sort(),
            segments: segments,
            changes: changes
        };
    }

    resetMetrics() {
        this.metrics = {
            totalLatency: 0,
            transcriptionCount: 0,
            avgLatency: 0
        };
        this.usageTracking = {
            totalAudioSeconds: 0,
            totalCost: 0,
            sessionStartTime: null,
            lastAudioTime: null
        };
        this.lastSpeaker = null;
        this.currentSegment = null;
    }
}

module.exports = DeepgramService;