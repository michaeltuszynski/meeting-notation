// State
let selectedSourceId = null;
let isStreaming = false;
let audioStream = null;
let audioContext = null;
let mediaRecorder = null;
let audioProcessor = null;

// DOM Elements
const backendStatus = document.getElementById('backend-status');
const streamingStatus = document.getElementById('streaming-status');
const sourcesList = document.getElementById('sources-list');
const refreshBtn = document.getElementById('refresh-sources');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const audioLevel = document.getElementById('audio-level');
const audioStats = document.getElementById('audio-stats');
const autoMinimize = document.getElementById('auto-minimize');
const sampleRateSelect = document.getElementById('sample-rate');

// Initialize
async function init() {
    await updateBackendStatus();
    await loadSources();
    
    // Set up event listeners
    refreshBtn.addEventListener('click', loadSources);
    startBtn.addEventListener('click', startStreaming);
    stopBtn.addEventListener('click', stopStreaming);
    
    // Listen for backend status updates
    window.audioAPI.onBackendStatus((status) => {
        updateBackendStatus(status);
    });
    
    // Listen for stop command from tray
    window.audioAPI.onStopStreaming(() => {
        stopStreaming();
    });
    
    // Periodically check backend status
    setInterval(updateBackendStatus, 5000);
}

// Load available audio sources
async function loadSources() {
    sourcesList.innerHTML = '<div class="loading">Loading sources...</div>';
    
    try {
        const sources = await window.audioAPI.getSources();
        
        if (sources.length === 0) {
            sourcesList.innerHTML = '<div class="loading">No sources available</div>';
            return;
        }
        
        sourcesList.innerHTML = '';
        
        sources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';
            sourceItem.dataset.sourceId = source.id;
            
            // Check if it's a meeting app
            const meetingApps = ['Zoom', 'Teams', 'Google Meet', 'Slack', 'Discord', 'Skype'];
            const isMeetingApp = meetingApps.some(app => source.name.includes(app));
            
            sourceItem.innerHTML = `
                <img src="${source.thumbnail}" class="source-icon" />
                <span class="source-name">${source.name}</span>
                ${isMeetingApp ? '<span class="source-badge">Meeting</span>' : ''}
            `;
            
            sourceItem.addEventListener('click', () => selectSource(source.id));
            sourcesList.appendChild(sourceItem);
        });
        
        // Auto-select first meeting app if available
        const firstMeetingApp = sources.find(s => 
            ['Zoom', 'Teams', 'Google Meet'].some(app => s.name.includes(app))
        );
        if (firstMeetingApp) {
            selectSource(firstMeetingApp.id);
        }
        
    } catch (error) {
        console.error('Error loading sources:', error);
        sourcesList.innerHTML = '<div class="loading">Error loading sources</div>';
    }
}

// Select audio source
function selectSource(sourceId) {
    // Update UI
    document.querySelectorAll('.source-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.sourceId === sourceId);
    });
    
    selectedSourceId = sourceId;
    startBtn.disabled = !selectedSourceId || isStreaming;
}

// Start streaming audio
async function startStreaming() {
    if (!selectedSourceId || isStreaming) return;
    
    try {
        // Get audio stream using the selected source
        const constraints = {
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: selectedSourceId
                }
            },
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: selectedSourceId
                }
            }
        };
        
        audioStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Remove video track, keep only audio
        const videoTrack = audioStream.getVideoTracks()[0];
        if (videoTrack) {
            audioStream.removeTrack(videoTrack);
            videoTrack.stop();
        }
        
        // Set up audio processing
        const sampleRate = parseInt(sampleRateSelect.value);
        audioContext = new AudioContext({ sampleRate });
        const source = audioContext.createMediaStreamSource(audioStream);
        
        // Create script processor for capturing audio chunks
        audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        let chunkCount = 0;
        audioProcessor.onaudioprocess = async (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate audio level for visualization
            let sum = 0;
            let max = 0;
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.abs(inputData[i]);
                sum += sample;
                max = Math.max(max, sample);
            }
            const avgLevel = sum / inputData.length;
            updateAudioLevel(avgLevel);
            
            // Convert Float32Array to Int16Array for transmission
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Send audio chunk to backend
            chunkCount++;
            if (chunkCount % 10 === 0) { // Send every 10th chunk to reduce load
                const result = await window.audioAPI.sendAudioChunk({
                    audio: Array.from(int16Data),
                    sampleRate: audioContext.sampleRate,
                    channels: 1
                });
                
                if (!result.success) {
                    console.error('Failed to send audio chunk:', result.error);
                }
                
                // Update stats
                audioStats.textContent = `Streaming (${Math.round(avgLevel * 1000)} level, ${chunkCount} chunks)`;
            }
        };
        
        // Connect audio nodes
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
        // Update streaming state
        isStreaming = true;
        await window.audioAPI.startStreaming(selectedSourceId);
        
        // Update UI
        updateStreamingUI();
        
        // Auto-minimize if enabled
        if (autoMinimize.checked) {
            setTimeout(() => {
                // The window will be minimized to tray by the main process
                // We just need to notify it that streaming has started
            }, 1000);
        }
        
        console.log('Started streaming audio');
        
    } catch (error) {
        console.error('Error starting stream:', error);
        alert('Failed to start audio capture. Please check permissions and try again.');
        stopStreaming();
    }
}

// Stop streaming audio
async function stopStreaming() {
    if (!isStreaming) return;
    
    // Stop audio processing
    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Update state
    isStreaming = false;
    await window.audioAPI.stopStreaming();
    
    // Update UI
    updateStreamingUI();
    updateAudioLevel(0);
    audioStats.textContent = 'Not streaming';
    
    console.log('Stopped streaming audio');
}

// Update audio level visualization
function updateAudioLevel(level) {
    const percentage = Math.min(100, level * 200); // Scale for visibility
    audioLevel.style.width = `${percentage}%`;
}

// Update backend connection status
async function updateBackendStatus(status) {
    if (!status) {
        status = await window.audioAPI.getBackendStatus();
    }
    
    if (status.connected) {
        backendStatus.textContent = 'Connected';
        backendStatus.className = 'status-value connected';
    } else {
        backendStatus.textContent = 'Disconnected';
        backendStatus.className = 'status-value disconnected';
    }
    
    // Disable start button if backend is not connected
    if (!status.connected && !isStreaming) {
        startBtn.disabled = true;
    } else if (selectedSourceId && !isStreaming) {
        startBtn.disabled = false;
    }
}

// Update UI based on streaming state
function updateStreamingUI() {
    if (isStreaming) {
        streamingStatus.textContent = 'Active';
        streamingStatus.className = 'status-value active';
        startBtn.disabled = true;
        stopBtn.disabled = false;
        refreshBtn.disabled = true;
        
        // Disable source selection
        document.querySelectorAll('.source-item').forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.6';
        });
    } else {
        streamingStatus.textContent = 'Inactive';
        streamingStatus.className = 'status-value inactive';
        startBtn.disabled = !selectedSourceId;
        stopBtn.disabled = true;
        refreshBtn.disabled = false;
        
        // Enable source selection
        document.querySelectorAll('.source-item').forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);