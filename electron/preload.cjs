const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Add any IPC methods here if needed
  sendMessage: (channel, data) => ipcRenderer.send(channel, data),
  onMessage: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});
