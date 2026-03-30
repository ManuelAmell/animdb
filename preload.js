const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadImage: (data) => ipcRenderer.invoke('download-image', data)
});
