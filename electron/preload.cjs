const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopUpdater', {
  getState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onStateChange: (listener) => {
    const forwardState = (_event, state) => listener(state);
    ipcRenderer.on('updater:state', forwardState);
    return () => ipcRenderer.removeListener('updater:state', forwardState);
  },
});
