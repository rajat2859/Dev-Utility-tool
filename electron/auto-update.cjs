const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_STATE_CHANNEL = 'updater:state';

let updateState = {
  isSupported: app.isPackaged,
  currentVersion: app.getVersion(),
  status: 'idle',
  latestVersion: null,
  downloadPercent: 0,
  lastCheckedAt: null,
  errorMessage: null,
};
let sendStateToWindow = () => {};

function changeUpdateState(changes) {
  updateState = { ...updateState, ...changes };
  sendStateToWindow(updateState);
}

function registerAutoUpdate(getMainWindow) {
  sendStateToWindow = (state) => getMainWindow()?.webContents.send(UPDATE_STATE_CHANNEL, state);

  autoUpdater.on('checking-for-update', () =>
    changeUpdateState({ status: 'checking', errorMessage: null, lastCheckedAt: new Date().toISOString() }));
  autoUpdater.on('update-available', ({ version }) =>
    changeUpdateState({ status: 'downloading', latestVersion: version, downloadPercent: 0 }));
  autoUpdater.on('update-not-available', ({ version }) =>
    changeUpdateState({ status: 'up-to-date', latestVersion: version }));
  autoUpdater.on('download-progress', ({ percent }) =>
    changeUpdateState({ downloadPercent: Math.round(percent) }));
  autoUpdater.on('update-downloaded', () =>
    changeUpdateState({ status: 'ready-to-install', downloadPercent: 100 }));
  autoUpdater.on('error', (updateError) =>
    changeUpdateState({ status: 'error', errorMessage: updateError.message }));

  ipcMain.handle('updater:get-state', () => updateState);
  ipcMain.handle('updater:check', () => {
    const isBusy = updateState.status === 'checking' || updateState.status === 'downloading';
    if (updateState.isSupported && !isBusy) autoUpdater.checkForUpdates().catch(() => {});
    return updateState;
  });
  ipcMain.handle('updater:install', () => {
    if (updateState.status === 'ready-to-install') autoUpdater.quitAndInstall();
  });
}

module.exports = { registerAutoUpdate };
