const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  audio: {
    getSources: () => ipcRenderer.invoke('audio:get-sources'),
    startCapture: (sourceId) => ipcRenderer.invoke('audio:start-capture', sourceId),
    stopCapture: () => ipcRenderer.invoke('audio:stop-capture'),
    getMetrics: () => ipcRenderer.invoke('audio:get-metrics'),
    
    // Event listeners for renderer-side audio processing
    onInitCapture: (callback) => {
      ipcRenderer.on('audio:init-capture', (event, sourceId) => callback(sourceId));
    },
    onStopCapture: (callback) => {
      ipcRenderer.on('audio:stop-capture', callback);
    },
    onRequestMetrics: (callback) => {
      ipcRenderer.on('audio:request-metrics', callback);
    },
    sendMetrics: (metrics) => {
      ipcRenderer.send('audio:metrics-response', metrics);
    },
    onCleanup: (callback) => {
      ipcRenderer.on('audio:cleanup', callback);
    },
    
    // Legacy event handlers
    onAudioData: (callback) => {
      ipcRenderer.on('audio:data', (event, data) => callback(data));
    }
  },
  system: {
    platform: process.platform,
    isDevelopment: process.env.NODE_ENV === 'development'
  }
});
