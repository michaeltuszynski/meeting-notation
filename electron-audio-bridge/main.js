const { app, BrowserWindow, ipcMain, desktopCapturer, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const io = require('socket.io-client');

let mainWindow;
let tray;
let socket;
let isStreaming = false;

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:9000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Meeting Audio Bridge'
  });

  mainWindow.loadFile('index.html');

  // Hide instead of close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Connect to backend
  connectToBackend();
}

function connectToBackend() {
  console.log(`Connecting to backend at ${BACKEND_URL}`);
  
  socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
  });

  socket.on('connect', () => {
    console.log('Connected to backend');
    mainWindow.webContents.send('backend-status', { connected: true });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from backend');
    mainWindow.webContents.send('backend-status', { connected: false });
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    mainWindow.webContents.send('backend-status', { 
      connected: false, 
      error: error.message 
    });
  });
}

function createTray() {
  // Create a simple tray icon (you can add a proper icon file later)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Audio Bridge',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: isStreaming ? 'Stop Streaming' : 'Not Streaming',
      enabled: isStreaming,
      click: () => {
        if (isStreaming) {
          mainWindow.webContents.send('stop-streaming');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Meeting Audio Bridge');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.show();
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Audio Bridge',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: isStreaming ? '🔴 Stop Streaming' : '⚪ Not Streaming',
      enabled: isStreaming,
      click: () => {
        if (isStreaming) {
          mainWindow.webContents.send('stop-streaming');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      fetchWindowIcons: true
    });
    
    // Filter and format sources
    const audioSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
    
    // Prioritize meeting apps
    const priorityApps = ['Zoom', 'Teams', 'Google Meet', 'Slack', 'Discord'];
    const sortedSources = audioSources.sort((a, b) => {
      const aPriority = priorityApps.findIndex(app => a.name.includes(app));
      const bPriority = priorityApps.findIndex(app => b.name.includes(app));
      
      if (aPriority !== -1 && bPriority === -1) return -1;
      if (aPriority === -1 && bPriority !== -1) return 1;
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      
      return a.name.localeCompare(b.name);
    });
    
    return sortedSources;
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

ipcMain.handle('start-streaming', async (event, sourceId) => {
  console.log('Starting audio stream for source:', sourceId);
  isStreaming = true;
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle('stop-streaming', async () => {
  console.log('Stopping audio stream');
  isStreaming = false;
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle('send-audio-chunk', async (event, audioData) => {
  if (socket && socket.connected) {
    socket.emit('audio:chunk', audioData);
    return { success: true };
  }
  return { success: false, error: 'Backend not connected' };
});

ipcMain.handle('get-backend-status', async () => {
  return {
    url: BACKEND_URL,
    connected: socket && socket.connected
  };
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});