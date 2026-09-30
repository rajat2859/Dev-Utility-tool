const { ipcRenderer } = require('electron');

window.addEventListener('message', (event) => {
  if (event.data?.source === 'rp-probe') ipcRenderer.sendToHost('rp-probe', event.data);
});

ipcRenderer.on('rp-host', (_event, message) => {
  window.postMessage({ source: 'rp-host', ...message }, '*');
});
