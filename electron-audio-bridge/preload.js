const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('audioAPI', {
  // Get available audio sources
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // Start/stop streaming
  startStreaming: (sourceId) => ipcRenderer.invoke('start-streaming', sourceId),
  stopStreaming: () => ipcRenderer.invoke('stop-streaming'),
  
  // Send audio data
  sendAudioChunk: (audioData) => ipcRenderer.invoke('send-audio-chunk', audioData),
  
  // Backend connection status
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  
  // Listen for backend status updates
  onBackendStatus: (callback) => {
    ipcRenderer.on('backend-status', (event, status) => callback(status));
  },
  
  // Listen for stop streaming command from tray
  onStopStreaming: (callback) => {
    ipcRenderer.on('stop-streaming', () => callback());
  }
});