const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;

class AudioProcessor {
    constructor() {
        this.buffer = Buffer.alloc(0);
        this.bufferThreshold = 4096;
    }

    /**
     * Convert audio data to format required by Deepgram
     * @param {Buffer} audioData - Raw audio data
     * @param {Object} options - Audio format options
     * @returns {Buffer} Processed audio buffer
     */
    processAudioChunk(audioData, options = {}) {
        const {
            inputSampleRate = 48000,
            inputChannels = 2,
            outputSampleRate = SAMPLE_RATE,
            outputChannels = CHANNELS
        } = options;

        // If the audio is already an array, convert it to Buffer with proper Int16 format
        if (Array.isArray(audioData)) {
            const int16Array = new Int16Array(audioData);
            audioData = Buffer.from(int16Array.buffer);
        }

        let processedData = audioData;

        // Convert stereo to mono if needed
        if (inputChannels === 2 && outputChannels === 1) {
            processedData = this.stereoToMono(processedData);
        }

        // Resample if needed (Deepgram expects 16000 Hz)
        if (inputSampleRate !== outputSampleRate) {
            processedData = this.resample(processedData, inputSampleRate, outputSampleRate);
        }

        return processedData;
    }

    /**
     * Convert stereo audio to mono
     * @param {Buffer} stereoData - Stereo audio buffer
     * @returns {Buffer} Mono audio buffer
     */
    stereoToMono(stereoData) {
        const monoData = Buffer.alloc(stereoData.length / 2);
        
        for (let i = 0; i < monoData.length / 2; i++) {
            const leftSample = stereoData.readInt16LE(i * 4);
            const rightSample = stereoData.readInt16LE(i * 4 + 2);
            const monoSample = Math.floor((leftSample + rightSample) / 2);
            monoData.writeInt16LE(monoSample, i * 2);
        }
        
        return monoData;
    }

    /**
     * Simple linear resampling
     * @param {Buffer} audioData - Audio buffer to resample
     * @param {number} fromRate - Original sample rate
     * @param {number} toRate - Target sample rate
     * @returns {Buffer} Resampled audio buffer
     */
    resample(audioData, fromRate, toRate) {
        const ratio = toRate / fromRate;
        const outputLength = Math.floor(audioData.length * ratio);
        const outputData = Buffer.alloc(outputLength);
        
        for (let i = 0; i < outputLength / 2; i++) {
            const sourceIndex = Math.floor(i / ratio);
            if (sourceIndex * 2 < audioData.length - 1) {
                const sample = audioData.readInt16LE(sourceIndex * 2);
                outputData.writeInt16LE(sample, i * 2);
            }
        }
        
        return outputData;
    }

    /**
     * Buffer audio chunks for optimal processing
     * @param {Buffer} chunk - New audio chunk
     * @returns {Buffer|null} Buffered data if threshold met, null otherwise
     */
    bufferChunk(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        
        if (this.buffer.length >= this.bufferThreshold) {
            const dataToSend = this.buffer;
            this.buffer = Buffer.alloc(0);
            return dataToSend;
        }
        
        return null;
    }

    /**
     * Flush any remaining buffered data
     * @returns {Buffer} Remaining buffered data
     */
    flush() {
        const remainingData = this.buffer;
        this.buffer = Buffer.alloc(0);
        return remainingData;
    }

    /**
     * Convert Float32Array to Int16 PCM
     * @param {Float32Array} float32Array - Float32 audio data
     * @returns {Buffer} Int16 PCM buffer
     */
    float32ToInt16(float32Array) {
        const int16Buffer = Buffer.alloc(float32Array.length * 2);
        
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            const int16Sample = Math.floor(sample * 32767);
            int16Buffer.writeInt16LE(int16Sample, i * 2);
        }
        
        return int16Buffer;
    }

    /**
     * Convert base64 audio to buffer
     * @param {string} base64Audio - Base64 encoded audio
     * @returns {Buffer} Audio buffer
     */
    base64ToBuffer(base64Audio) {
        return Buffer.from(base64Audio, 'base64');
    }

    /**
     * Calculate audio level/volume
     * @param {Buffer} audioData - Audio buffer
     * @returns {number} RMS level (0-1)
     */
    calculateAudioLevel(audioData) {
        let sum = 0;
        const samples = audioData.length / 2;
        
        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);
            sum += sample * sample;
        }
        
        const rms = Math.sqrt(sum / samples);
        return Math.min(1, rms / 32768);
    }

    /**
     * Check if audio contains speech (simple VAD)
     * @param {Buffer} audioData - Audio buffer
     * @param {number} threshold - Audio level threshold
     * @returns {boolean} True if speech detected
     */
    detectSpeech(audioData, threshold = 0.01) {
        const level = this.calculateAudioLevel(audioData);
        return level > threshold;
    }
}

module.exports = {
    AudioProcessor,
    SAMPLE_RATE,
    CHANNELS,
    BIT_DEPTH
};