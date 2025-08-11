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
        this.metrics = {
            totalLatency: 0,
            transcriptionCount: 0,
            avgLatency: 0
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
            
            if (transcript && transcript.trim() !== '') {
                const result = {
                    text: transcript,
                    isFinal: data.is_final,
                    confidence: data.channel?.alternatives[0]?.confidence || 0,
                    timestamp: Date.now(),
                    latency: latency,
                    words: data.channel?.alternatives[0]?.words || []
                };
                
                console.log(`Transcript (${latency}ms): ${transcript}`);
                this.emit('transcript', result);
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
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    resetMetrics() {
        this.metrics = {
            totalLatency: 0,
            transcriptionCount: 0,
            avgLatency: 0
        };
    }
}

module.exports = DeepgramService;