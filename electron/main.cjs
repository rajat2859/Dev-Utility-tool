const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const dotenv = require('dotenv');

const SERVER_STARTUP_TIMEOUT_MS = 60000;
const LOCAL_HOST = '127.0.0.1';

const appContentDirectory = app.isPackaged
  ? path.join(process.resourcesPath, 'app-content')
  : path.resolve(__dirname, '..');

let mainWindow = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probeServer = net.createServer();
    probeServer.once('error', reject);
    probeServer.listen(0, LOCAL_HOST, () => {
      const { port } = probeServer.address();
      probeServer.close(() => resolve(port));
    });
  });
}

function prepareUserConfigurationFile() {
  const configurationPath = path.join(app.getPath('userData'), '.env');
  const templatePath = path.join(appContentDirectory, '.env.example');
  if (!fs.existsSync(configurationPath) && fs.existsSync(templatePath)) {
    fs.mkdirSync(path.dirname(configurationPath), { recursive: true });
    fs.copyFileSync(templatePath, configurationPath);
  }
  dotenv.config({ path: configurationPath });
}

async function waitForServerToBeHealthy(serverUrl) {
  const deadline = Date.now() + SERVER_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${serverUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`The app server did not start within ${SERVER_STARTUP_TIMEOUT_MS / 1000} seconds.`);
}

async function startServer() {
  const serverPort = await findFreePort();
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(serverPort);
  process.env.HOST = LOCAL_HOST;
  process.chdir(appContentDirectory);
  prepareUserConfigurationFile();

  require('./build/server.cjs');

  const serverUrl = `http://${LOCAL_HOST}:${serverPort}`;
  await waitForServerToBeHealthy(serverUrl);
  return serverUrl;
}

function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Configuration Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
}

function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const keepInsideApp = (event, targetUrl) => {
    if (!targetUrl.startsWith(serverUrl)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  };
  mainWindow.webContents.on('will-navigate', keepInsideApp);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(serverUrl);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(buildApplicationMenu());
    try {
      createMainWindow(await startServer());
    } catch (startupError) {
      dialog.showErrorBox('Utility Tool Manager could not start', String(startupError.stack || startupError));
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
}
