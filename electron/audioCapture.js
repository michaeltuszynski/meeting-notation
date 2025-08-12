const { desktopCapturer } = require('electron');
const { io } = require('socket.io-client');

class AudioCapture {
    constructor() {
        this.socket = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.audioProcessor = null;
        this.isCapturing = false;
        this.performanceMetrics = {
            captureStart: null,
            chunksSent: 0,
            avgLatency: 0
        };
    }

    /**
     * Initialize WebSocket connection to backend
     * @returns {Promise<void>}
     */
    async connect() {
        const serverUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:9000' 
            : 'http://localhost:9000';
        
        this.socket = io(serverUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        return new Promise((resolve, reject) => {
            this.socket.on('connect', () => {
                console.log('[AudioCapture] Connected to backend server');
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('[AudioCapture] Connection error:', error);
                reject(error);
            });

            this.socket.on('service:status', (status) => {
                console.log('[AudioCapture] Service status:', status);
            });

            this.socket.on('transcript:update', (transcript) => {
                const latency = Date.now() - this.performanceMetrics.captureStart;
                console.log(`[AudioCapture] Transcript received (${latency}ms):`, transcript.text?.substring(0, 50));
            });
        });
    }

    /**
     * Get available audio sources with system audio priority
     * @returns {Promise<Array>}
     */
    async getAudioSources() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
                fetchWindowIcons: true
            });

            // Prioritize system audio sources
            const priorityOrder = [
                'Entire Screen',
                'Screen 1',
                'Desktop',
                'BlackHole',
                'VB-Cable',
                'System Audio'
            ];

            const sortedSources = sources.sort((a, b) => {
                const aIndex = priorityOrder.findIndex(p => a.name.includes(p));
                const bIndex = priorityOrder.findIndex(p => b.name.includes(p));
                
                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });

            return sortedSources;
        } catch (error) {
            console.error('[AudioCapture] Error getting sources:', error);
            throw error;
        }
    }

    /**
     * Start audio capture from specified source
     * @param {string} sourceId - The source ID from desktopCapturer
     * @returns {Promise<void>}
     */
    async startCapture(sourceId) {
        if (this.isCapturing) {
            console.warn('[AudioCapture] Already capturing');
            return;
        }

        try {
            this.performanceMetrics.captureStart = Date.now();
            this.performanceMetrics.chunksSent = 0;

            // Get media stream with audio constraints optimized for speech
            const constraints = {
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                        maxWidth: 1,
                        maxHeight: 1
                    }
                }
            };

            // Create audio context for processing
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000 // Deepgram optimal sample rate
            });

            // Get user media
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create audio source and processor
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.audioProcessor.onaudioprocess = (event) => {
                if (!this.isCapturing) return;

                const inputData = event.inputBuffer.getChannelData(0);
                const pcmData = this.float32ToInt16(inputData);
                
                // Send audio chunk to backend
                if (this.socket && this.socket.connected) {
                    this.socket.emit('audio:chunk', {
                        audio: Array.from(pcmData),
                        sampleRate: this.audioContext.sampleRate,
                        channels: 1,
                        timestamp: Date.now()
                    });
                    
                    this.performanceMetrics.chunksSent++;
                    if (this.performanceMetrics.chunksSent % 10 === 0) {
                        const elapsed = Date.now() - this.performanceMetrics.captureStart;
                        console.log(`[AudioCapture] Sent ${this.performanceMetrics.chunksSent} chunks in ${elapsed}ms`);
                    }
                }
            };

            // Connect audio graph
            source.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);

            this.isCapturing = true;
            console.log('[AudioCapture] Started capturing audio');
            
            // Notify backend that streaming has started
            if (this.socket && this.socket.connected) {
                this.socket.emit('audio:start', {
                    sampleRate: this.audioContext.sampleRate,
                    channels: 1
                });
            }
        } catch (error) {
            console.error('[AudioCapture] Error starting capture:', error);
            throw error;
        }
    }

    /**
     * Stop audio capture and clean up resources
     */
    stopCapture() {
        if (!this.isCapturing) {
            console.warn('[AudioCapture] Not currently capturing');
            return;
        }

        try {
            // Stop media stream tracks
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            // Disconnect audio processor
            if (this.audioProcessor) {
                this.audioProcessor.disconnect();
                this.audioProcessor = null;
            }

            // Close audio context
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }

            // Notify backend
            if (this.socket && this.socket.connected) {
                this.socket.emit('audio:stop');
            }

            this.isCapturing = false;
            
            const totalTime = Date.now() - this.performanceMetrics.captureStart;
            console.log(`[AudioCapture] Stopped capturing. Total time: ${totalTime}ms, Chunks sent: ${this.performanceMetrics.chunksSent}`);
        } catch (error) {
            console.error('[AudioCapture] Error stopping capture:', error);
        }
    }

    /**
     * Convert Float32Array to Int16Array for PCM encoding
     * @param {Float32Array} float32Array - Input audio data
     * @returns {Int16Array} PCM encoded audio
     */
    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return int16Array;
    }

    /**
     * Disconnect from backend server
     */
    disconnect() {
        if (this.isCapturing) {
            this.stopCapture();
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        console.log('[AudioCapture] Disconnected from backend');
    }

    /**
     * Get performance metrics
     * @returns {Object} Current performance metrics
     */
    getMetrics() {
        return {
            ...this.performanceMetrics,
            isCapturing: this.isCapturing,
            socketConnected: this.socket?.connected || false
        };
    }
}

module.exports = AudioCapture;