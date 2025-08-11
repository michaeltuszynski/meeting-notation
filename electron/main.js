const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../frontend/build/index.html')}`
  );
}

app.whenReady().then(createWindow);

ipcMain.handle('audio:start-capture', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return sources[0]?.id || null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
