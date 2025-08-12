const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const AudioCapture = require('./audioCapture');

let mainWindow;
let audioCapture = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Required for audio capture
    }
  });

  // Enable audio permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // In development, load from the webpack dev server
  const isDev = process.env.NODE_ENV !== 'production';
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:4000'
      : `file://${path.join(__dirname, '../frontend/build/index.html')}`
  );

  // Initialize audio capture in renderer context
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Window loaded, audio capture ready');
    // Open DevTools in development for debugging
    if (process.env.NODE_ENV !== 'production') {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(createWindow);

// Audio capture IPC handlers
ipcMain.handle('audio:get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      fetchWindowIcons: true
    });

    // Format sources for frontend
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail?.toDataURL()
    }));
  } catch (error) {
    console.error('[Main] Error getting audio sources:', error);
    throw error;
  }
});

ipcMain.handle('audio:start-capture', async (event, sourceId) => {
  try {
    // Send source ID to renderer for capture
    mainWindow.webContents.send('audio:init-capture', sourceId);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error starting capture:', error);
    throw error;
  }
});

ipcMain.handle('audio:stop-capture', async () => {
  try {
    mainWindow.webContents.send('audio:stop-capture');
    return { success: true };
  } catch (error) {
    console.error('[Main] Error stopping capture:', error);
    throw error;
  }
});

ipcMain.handle('audio:get-metrics', async () => {
  // Request metrics from renderer process
  return new Promise((resolve) => {
    mainWindow.webContents.send('audio:request-metrics');
    ipcMain.once('audio:metrics-response', (event, metrics) => {
      resolve(metrics);
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Clean up audio capture
  if (mainWindow) {
    mainWindow.webContents.send('audio:cleanup');
  }
});
