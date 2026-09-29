const { app, BrowserWindow, Menu, dialog, screen, shell } = require('electron');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const dotenv = require('dotenv');

const SERVER_STARTUP_TIMEOUT_MS = 60000;
const SERVER_HEALTH_POLL_INTERVAL_MS = 40;
const LOCAL_HOST = '127.0.0.1';
const RESPONSIVE_PREVIEW_PARTITION = 'persist:responsive-preview';
const DEFAULT_WINDOW_SIZE = { width: 1400, height: 900 };

const appContentDirectory = app.isPackaged
  ? path.join(process.resourcesPath, 'app-content')
  : path.resolve(__dirname, '..');

let mainWindow = null;
let appServerUrl = null;

// Caches V8-compiled code of the ~MB server bundle on disk so later launches skip the compile step.
require('node:module').enableCompileCache(path.join(app.getPath('userData'), 'compile-cache'));

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(windowStatePath, 'utf8'));
  } catch {
    return {};
  }
}

function isVisibleOnSomeDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea }) =>
    bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y);
}

function saveWindowState(window) {
  const windowState = { ...window.getNormalBounds(), isMaximized: window.isMaximized() };
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(windowState));
  } catch (writeError) {
    console.error('Could not save window state:', writeError);
  }
}

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
    await new Promise((resolve) => setTimeout(resolve, SERVER_HEALTH_POLL_INTERVAL_MS));
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

function createMainWindow() {
  const storedWindowState = readWindowState();
  const savedWindowState = isVisibleOnSomeDisplay(storedWindowState) ? storedWindowState : {};
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    ...savedWindowState,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  if (savedWindowState.isMaximized) mainWindow.maximize();
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  const keepInsideApp = (event, targetUrl) => {
    if (!targetUrl.startsWith(appServerUrl)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  };
  mainWindow.webContents.on('will-navigate', keepInsideApp);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, webviewParams) => {
    if (!/^https?:\/\//i.test(webviewParams.src)) {
      event.preventDefault();
      return;
    }
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(__dirname, 'preview-preload.cjs');
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webviewParams.partition = RESPONSIVE_PREVIEW_PARTITION;
  });
  mainWindow.webContents.on('did-attach-webview', (_event, previewContents) => {
    previewContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });

  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const splashIsVisible = new Promise((resolve) => mainWindow.once('ready-to-show', resolve));
  mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  return splashIsVisible.then(() => mainWindow.show());
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
      await createMainWindow();
      appServerUrl = await startServer();
      require('./auto-update.cjs').registerAutoUpdate(() => mainWindow);
      mainWindow?.loadURL(appServerUrl);
    } catch (startupError) {
      dialog.showErrorBox('Utility Tool Manager could not start', String(startupError.stack || startupError));
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
}
