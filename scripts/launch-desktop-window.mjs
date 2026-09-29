import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPort = Number(process.env.PORT) || 2000;
const appUrl = `http://localhost:${serverPort}`;
const SERVER_STARTUP_TIMEOUT_MS = 60000;

const chromiumBrowserCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const browserExecutablePath = chromiumBrowserCandidates.find((candidatePath) => fs.existsSync(candidatePath));
if (!browserExecutablePath) {
  console.error('No Microsoft Edge or Google Chrome installation was found to open the desktop window.');
  process.exit(1);
}

async function isServerHealthy() {
  try {
    const response = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServerToBeHealthy() {
  const deadline = Date.now() + SERVER_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isServerHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const serverAlreadyRunning = await isServerHealthy();
const serverProcess = serverAlreadyRunning
  ? null
  : spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(serverPort) },
    });

function stopServerWeStarted() {
  if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
}

serverProcess?.on('exit', (exitCode) => {
  if (exitCode !== null && exitCode !== 0) {
    console.error(`Server stopped unexpectedly with exit code ${exitCode}.`);
    process.exit(exitCode);
  }
});

if (!(await waitForServerToBeHealthy())) {
  console.error(`Server did not become ready at ${appUrl} within ${SERVER_STARTUP_TIMEOUT_MS / 1000}s.`);
  stopServerWeStarted();
  process.exit(1);
}

// A dedicated profile makes the browser start its own process, so this script can tell when the window closes.
const desktopProfileDirectory = path.join(projectRoot, '.desktop-profile');
const desktopWindowProcess = spawn(
  browserExecutablePath,
  [
    `--app=${appUrl}`,
    `--user-data-dir=${desktopProfileDirectory}`,
    '--window-size=1400,900',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  { stdio: 'ignore' }
);

function closeEverything() {
  if (desktopWindowProcess.exitCode === null) desktopWindowProcess.kill();
  stopServerWeStarted();
}

desktopWindowProcess.on('exit', () => {
  stopServerWeStarted();
  process.exit(0);
});
process.on('SIGINT', () => {
  closeEverything();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeEverything();
  process.exit(0);
});
