import { app, BrowserWindow, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');
const webRoot = path.join(repoRoot, 'apps', 'web-admin');
const preloadPath = path.join(__dirname, 'preload.cjs');
const apiHealthUrl = process.env.MELISA_API_HEALTH_URL || 'http://localhost:4100/api/health';
const webUrl = process.env.MELISA_WEB_URL || 'http://localhost:5173/';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const managedProcesses = [];

function requestOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 2500 }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForUrl(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await requestOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function startProcessIfNeeded({ name, cwd, args, healthUrl, env = {} }) {
  if (await requestOk(healthUrl)) {
    return { started: false, ok: true };
  }

  const child = spawn(npmCommand, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
  });

  managedProcesses.push({ name, child });
  child.on('exit', () => {
    const index = managedProcesses.findIndex((item) => item.child === child);
    if (index >= 0) managedProcesses.splice(index, 1);
  });

  const ok = await waitForUrl(healthUrl);
  return { started: true, ok };
}

async function ensureLocalStack() {
  const apiState = await startProcessIfNeeded({
    name: 'api',
    cwd: apiRoot,
    args: ['run', 'start'],
    healthUrl: apiHealthUrl,
  });

  const webState = await startProcessIfNeeded({
    name: 'web-admin',
    cwd: webRoot,
    args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'],
    healthUrl: webUrl,
    env: {
      VITE_API_BASE_URL: 'http://localhost:4100',
      VITE_DEMO_MODE: 'false',
    },
  });

  return { apiState, webState };
}

function createMenu(mainWindow) {
  const template = [
    {
      label: 'Melisa ERP',
      submenu: [
        { label: 'Yenile', accelerator: 'F5', click: () => mainWindow.reload() },
        { label: 'Tam Ekran', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'Cikis', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Gorunum',
      submenu: [
        { label: 'Yaklas', role: 'zoomIn' },
        { label: 'Uzaklas', role: 'zoomOut' },
        { label: 'Normal Boyut', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Gelistirici Araclari', accelerator: 'Ctrl+Shift+I', role: 'toggleDevTools' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'Melisa ERP v2',
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  createMenu(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    await ensureLocalStack();
    await mainWindow.loadURL(webUrl);
  } catch (error) {
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="font-family:Arial;padding:24px;background:#f8fafc;color:#111827">
          <h2>Melisa ERP acilamadi</h2>
          <p>Local API veya Web Admin baslatilamadi.</p>
          <pre style="white-space:pre-wrap;background:#fff1f0;border:1px solid #f4b5ae;padding:12px">${String(error?.message || error)}</pre>
        </body>
      </html>
    `)}`);
  }
}

function stopManagedProcesses() {
  for (const item of managedProcesses) {
    try {
      item.child.kill();
    } catch {
      // Process may already be closed.
    }
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopManagedProcesses();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopManagedProcesses);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
