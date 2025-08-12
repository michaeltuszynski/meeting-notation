// This file will be injected into the renderer process to handle audio capture
// It needs to be loaded by the frontend application

class RendererAudioCapture {
    constructor() {
        this.socket = null;
        this.mediaStream = null;
        this.audioContext = null;
        this.audioProcessor = null;
        this.isCapturing = false;
        this.metrics = {
            captureStart: null,
            chunksSent: 0,
            lastChunkTime: null
        };
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for main process commands
        if (window.electronAPI) {
            window.electronAPI.audio.onInitCapture((sourceId) => {
                console.log('[RendererAudio] Received init capture command:', sourceId);
                this.startCapture(sourceId);
            });

            window.electronAPI.audio.onStopCapture(() => {
                console.log('[RendererAudio] Received stop capture command');
                this.stopCapture();
            });

            window.electronAPI.audio.onRequestMetrics(() => {
                window.electronAPI.audio.sendMetrics(this.getMetrics());
            });

            window.electronAPI.audio.onCleanup(() => {
                this.cleanup();
            });
        }
    }

    async connectToBackend() {
        if (this.socket && this.socket.connected) {
            return;
        }

        // Use Socket.IO client from CDN or bundled version
        if (typeof io === 'undefined') {
            console.error('[RendererAudio] Socket.IO client not loaded');
            return;
        }

        const serverUrl = window.electronAPI?.system?.isDevelopment 
            ? 'http://localhost:9000' 
            : 'http://localhost:9000';

        this.socket = io(serverUrl, {
            transports: ['websocket'],
            reconnection: true
        });

        return new Promise((resolve, reject) => {
            this.socket.on('connect', () => {
                console.log('[RendererAudio] Connected to backend');
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('[RendererAudio] Connection error:', error);
                reject(error);
            });

            // Handle transcription updates
            this.socket.on('transcript:update', (transcript) => {
                const latency = Date.now() - this.metrics.captureStart;
                console.log(`[RendererAudio] Transcript (${latency}ms):`, transcript.text?.substring(0, 50));
                
                // Dispatch custom event for UI updates
                window.dispatchEvent(new CustomEvent('transcript:update', { 
                    detail: transcript 
                }));
            });

            // Handle extracted terms
            this.socket.on('terms:extracted', (terms) => {
                window.dispatchEvent(new CustomEvent('terms:extracted', { 
                    detail: terms 
                }));
            });

            // Handle contextual insights
            this.socket.on('contextual:insights', (insights) => {
                window.dispatchEvent(new CustomEvent('contextual:insights', { 
                    detail: insights 
                }));
            });
        });
    }

    async startCapture(sourceId) {
        if (this.isCapturing) {
            console.warn('[RendererAudio] Already capturing');
            return;
        }

        try {
            // Connect to backend first
            await this.connectToBackend();

            this.metrics.captureStart = Date.now();
            this.metrics.chunksSent = 0;

            // Get media stream with audio
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

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000 // Native sample rate, will be resampled server-side
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Create script processor for audio chunks
            this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.audioProcessor.onaudioprocess = (event) => {
                if (!this.isCapturing) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                const pcmData = this.float32ToInt16(inputData);
                
                // Send to backend via WebSocket
                if (this.socket && this.socket.connected) {
                    this.socket.emit('audio:chunk', {
                        audio: Array.from(pcmData),
                        sampleRate: this.audioContext.sampleRate,
                        channels: 1,
                        timestamp: Date.now()
                    });
                    
                    this.metrics.chunksSent++;
                    this.metrics.lastChunkTime = Date.now();
                    
                    // Log progress every 10 chunks
                    if (this.metrics.chunksSent % 10 === 0) {
                        const elapsed = Date.now() - this.metrics.captureStart;
                        console.log(`[RendererAudio] Sent ${this.metrics.chunksSent} chunks, ${elapsed}ms elapsed`);
                    }
                }
            };

            // Connect audio pipeline
            source.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);
            
            this.isCapturing = true;
            console.log('[RendererAudio] Started capturing from source:', sourceId);
            
            // Notify UI
            window.dispatchEvent(new CustomEvent('audio:capture-started', { 
                detail: { sourceId, timestamp: Date.now() } 
            }));
        } catch (error) {
            console.error('[RendererAudio] Error starting capture:', error);
            window.dispatchEvent(new CustomEvent('audio:capture-error', { 
                detail: { error: error.message } 
            }));
        }
    }

    stopCapture() {
        if (!this.isCapturing) {
            return;
        }

        try {
            // Stop all tracks
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            // Disconnect audio nodes
            if (this.audioProcessor) {
                this.audioProcessor.disconnect();
                this.audioProcessor = null;
            }

            // Close audio context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }

            // Notify backend
            if (this.socket && this.socket.connected) {
                this.socket.emit('audio:stop');
            }

            this.isCapturing = false;
            
            const totalTime = Date.now() - this.metrics.captureStart;
            console.log(`[RendererAudio] Stopped. Duration: ${totalTime}ms, Chunks: ${this.metrics.chunksSent}`);
            
            // Notify UI
            window.dispatchEvent(new CustomEvent('audio:capture-stopped', { 
                detail: { 
                    duration: totalTime,
                    chunksSent: this.metrics.chunksSent 
                } 
            }));
        } catch (error) {
            console.error('[RendererAudio] Error stopping capture:', error);
        }
    }

    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return int16Array;
    }

    getMetrics() {
        return {
            isCapturing: this.isCapturing,
            socketConnected: this.socket?.connected || false,
            captureStart: this.metrics.captureStart,
            chunksSent: this.metrics.chunksSent,
            lastChunkTime: this.metrics.lastChunkTime,
            latency: this.metrics.lastChunkTime 
                ? this.metrics.lastChunkTime - this.metrics.captureStart 
                : null
        };
    }

    cleanup() {
        this.stopCapture();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        console.log('[RendererAudio] Cleaned up');
    }
}

// Initialize when loaded
window.rendererAudioCapture = new RendererAudioCapture();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RendererAudioCapture;
}