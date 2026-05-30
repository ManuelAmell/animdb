const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

// Ensure data/covers directory exists
const coversDir = path.join(app.getPath('userData'), 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

ipcMain.handle('download-image', async (event, { url, id }) => {
  if (!url || !url.startsWith('http')) return url;
  
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const filename = `cover_${id}${ext}`;
  const localPath = path.join(coversDir, filename);

  return new Promise((resolve) => {
    const file = fs.createWriteStream(localPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        // Return a path that Electron can load
        // In some cases, we might need a custom protocol, but let's try direct path first
        resolve(`file://${localPath}`);
      });
    }).on('error', (err) => {
      fs.unlink(localPath, () => {});
      resolve(url); // Fallback to original URL
    });
  });
});

app.whenReady().then(() => {
  createWindow();

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
