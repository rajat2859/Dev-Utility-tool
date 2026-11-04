const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_STATE_CHANNEL = 'updater:state';
const STARTUP_CHECK_DELAY_MS = 15_000;
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

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

  const checkForUpdates = () => {
    const isBusy = ['checking', 'downloading', 'ready-to-install', 'installing'].includes(updateState.status);
    if (updateState.isSupported && !isBusy) autoUpdater.checkForUpdates().catch(() => {});
    return updateState;
  };

  ipcMain.handle('updater:get-state', () => updateState);
  ipcMain.handle('updater:check', checkForUpdates);
  ipcMain.handle('updater:install', () => {
    if (updateState.status !== 'ready-to-install') return;
    changeUpdateState({ status: 'installing' });
    // Let the IPC reply reach the renderer before the app quits into the installer.
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });

  // Check in the background so updates arrive without a manual click;
  // a downloaded update also installs silently on the next normal quit.
  setTimeout(checkForUpdates, STARTUP_CHECK_DELAY_MS);
  setInterval(checkForUpdates, PERIODIC_CHECK_INTERVAL_MS);
}

module.exports = { registerAutoUpdate };
