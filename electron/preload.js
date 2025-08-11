const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meetingAPI', {
  audio: {
    startCapture: () => ipcRenderer.invoke('audio:start-capture'),
    stopCapture: () => ipcRenderer.invoke('audio:stop-capture'),
    onAudioData: (callback) => {
      ipcRenderer.on('audio:data', (event, data) => callback(data));
    }
  },
  system: {
    platform: process.platform
  }
});
