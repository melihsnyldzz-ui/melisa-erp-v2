import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');
const webRoot = path.join(repoRoot, 'apps', 'web-admin');
const preloadPath = path.join(__dirname, 'preload.cjs');
const windowIconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(repoRoot, 'apps', 'terminal-app', 'src', 'assets', 'branding', 'melisa-baby-icon.png');
const defaultApiBaseUrl = process.env.MELISA_API_BASE_URL || 'http://localhost:4100';
const packagedWebPort = Number(process.env.MELISA_DESKTOP_WEB_PORT || 5187);
const packagedWebUrl = `http://localhost:${packagedWebPort}/`;
const webUrl = process.env.MELISA_WEB_URL || (app.isPackaged ? packagedWebUrl : 'http://localhost:5173/');
const localPasswordlessLogin = process.env.MELISA_LOCAL_PASSWORDLESS_LOGIN || 'true';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const managedProcesses = [];
let packagedWebServer = null;
let activeApiBaseUrl = defaultApiBaseUrl;

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) throw new Error('Sunucu IP adresi bos birakilamaz.');

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Gecerli bir IP veya sunucu adresi girin. Ornek: 192.168.1.46:4100');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Sunucu adresi http veya https ile baslamalidir.');
  }

  if (!parsed.port) parsed.port = '4100';
  if (parsed.pathname !== '/' && parsed.pathname !== '/api') {
    throw new Error('Yalnizca IP/sunucu ve port girin; ek yol kullanmayin.');
  }

  return parsed.origin;
}

function getApiHealthUrl() {
  return `${activeApiBaseUrl}/api/health`;
}

function desktopSettingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

async function readDesktopSettings() {
  try {
    const saved = JSON.parse(await readFile(desktopSettingsPath(), 'utf8'));
    return { apiBaseUrl: normalizeApiBaseUrl(saved.apiBaseUrl || defaultApiBaseUrl) };
  } catch {
    return { apiBaseUrl: normalizeApiBaseUrl(defaultApiBaseUrl) };
  }
}

async function saveDesktopSettings(apiBaseUrl) {
  const normalized = normalizeApiBaseUrl(apiBaseUrl);
  const target = desktopSettingsPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({ apiBaseUrl: normalized }, null, 2)}\n`, 'utf8');
  return normalized;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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

async function resolvePackagedWebFile(root, requestPath) {
  const decodedPath = decodeURIComponent(requestPath).replace(/\\/g, '/');
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relativePath);

  if (!candidate.startsWith(`${path.resolve(root)}${path.sep}`) && candidate !== path.resolve(root)) {
    return null;
  }

  try {
    const details = await stat(candidate);
    if (details.isFile()) return candidate;
  } catch {
    // SPA routes fall back to index.html.
  }

  return path.join(root, 'index.html');
}

async function startPackagedWebServer() {
  if (packagedWebServer || process.env.MELISA_WEB_URL) return;

  const webAssetsRoot = path.join(process.resourcesPath, 'web-admin');
  await stat(path.join(webAssetsRoot, 'index.html'));

  packagedWebServer = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', packagedWebUrl);
      const filePath = await resolvePackagedWebFile(webAssetsRoot, requestUrl.pathname);
      if (!filePath) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Erisim reddedildi.');
        return;
      }

      const body = await readFile(filePath);
      const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
      response.writeHead(200, {
        'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('ERP arayuzu okunamadi.');
    }
  });

  await new Promise((resolve, reject) => {
    packagedWebServer.once('error', reject);
    packagedWebServer.listen(packagedWebPort, '127.0.0.1', resolve);
  });
}

async function ensureLocalStack() {
  const apiHealthUrl = getApiHealthUrl();
  if (app.isPackaged) {
    await startPackagedWebServer();
    return {
      apiState: { started: false, ok: await requestOk(apiHealthUrl) },
      webState: { started: true, ok: await waitForUrl(webUrl, 10000) },
    };
  }

  const apiState = await startProcessIfNeeded({
    name: 'api',
    cwd: apiRoot,
    args: ['run', 'start'],
    healthUrl: apiHealthUrl,
    env: {
      MELISA_LOCAL_PASSWORDLESS_LOGIN: localPasswordlessLogin,
    },
  });

  const webState = await startProcessIfNeeded({
    name: 'web-admin',
    cwd: webRoot,
    args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'],
    healthUrl: webUrl,
    env: {
      VITE_API_BASE_URL: activeApiBaseUrl,
      VITE_DEMO_MODE: 'false',
      VITE_LOCAL_PASSWORDLESS_LOGIN: localPasswordlessLogin,
    },
  });

  return { apiState, webState };
}

function createMenu(mainWindow) {
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    {
      label: 'Melisa ERP',
      submenu: [
        { label: 'Yenile', accelerator: 'F5', click: () => loadErp(mainWindow) },
        { label: 'Sunucu / IP Ayari', click: () => showConnectionSettings(mainWindow) },
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
        ...(!app.isPackaged
          ? /** @type {import('electron').MenuItemConstructorOptions[]} */ ([
              { type: 'separator' },
              { label: 'Gelistirici Araclari', accelerator: 'Ctrl+Shift+I', role: 'toggleDevTools' },
            ])
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function showConnectionSettings(mainWindow, error = '') {
  const errorMarkup = error
    ? `<div style="margin-top:14px;padding:12px;border:1px solid #f4b5ae;background:#fff1f0;color:#9f1d20;border-radius:8px">${escapeHtml(error)}</div>`
    : '';

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8">
        <title>Melisa ERP - Sunucu Ayari</title>
      </head>
      <body style="margin:0;font-family:Arial;background:#eef2f7;color:#111827">
        <main style="max-width:620px;margin:80px auto;padding:28px;background:white;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.12)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="display:grid;place-items:center;width:46px;height:46px;border-radius:10px;background:#dc333b;color:white;font-size:22px;font-weight:900">M</div>
            <div><h2 style="margin:0">ERP Sunucu / IP Ayari</h2><p style="margin:4px 0 0;color:#64748b">Uygulamanin baglanacagi ERP bilgisayarini belirleyin.</p></div>
          </div>
          <label for="apiBaseUrl" style="display:block;font-weight:700;margin-bottom:7px">IP adresi ve port</label>
          <input id="apiBaseUrl" value="${escapeHtml(activeApiBaseUrl)}" placeholder="192.168.1.46:4100" autocomplete="off" spellcheck="false" style="box-sizing:border-box;width:100%;padding:13px 14px;border:2px solid #94a3b8;border-radius:8px;font-size:18px;outline:none">
          <p style="margin:8px 0 0;color:#64748b;font-size:13px">Sadece IP yazarsaniz port otomatik olarak 4100 olur.</p>
          ${errorMarkup}
          <div id="message" style="min-height:22px;margin-top:12px;font-weight:700"></div>
          <div style="display:flex;gap:10px;margin-top:12px">
            <button id="save" style="border:0;border-radius:8px;padding:12px 18px;background:#16845b;color:white;font-weight:800;cursor:pointer">Kaydet ve Baglan</button>
            <button id="cancel" style="border:1px solid #94a3b8;border-radius:8px;padding:12px 18px;background:white;color:#334155;font-weight:700;cursor:pointer">Vazgec</button>
          </div>
        </main>
        <script>
          const input = document.getElementById('apiBaseUrl');
          const message = document.getElementById('message');
          document.getElementById('save').addEventListener('click', async () => {
            message.style.color = '#334155';
            message.textContent = 'Adres kaydediliyor...';
            const result = await window.melisaDesktop.saveApiBaseUrl(input.value);
            if (!result.ok) {
              message.style.color = '#b42318';
              message.textContent = result.error;
              input.focus();
              input.select();
              return;
            }
            message.style.color = '#16845b';
            message.textContent = 'Kaydedildi. Uygulama yeniden aciliyor...';
          });
          document.getElementById('cancel').addEventListener('click', () => location.href = ${JSON.stringify(webUrl)});
          input.focus();
          input.select();
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') document.getElementById('save').click();
          });
        </script>
      </body>
    </html>
  `)}`);
}

async function loadErp(mainWindow) {
  const apiHealthUrl = getApiHealthUrl();
  try {
    const { apiState, webState } = await ensureLocalStack();
    if (!apiState.ok) {
      throw new Error(`ERP API bulunamadi: ${apiHealthUrl}`);
    }
    if (!webState.ok) {
      throw new Error(`ERP arayuzu baslatilamadi: ${webUrl}`);
    }
    await mainWindow.loadURL(webUrl);
  } catch (error) {
    await showConnectionSettings(mainWindow, String(error?.message || error));
  }
}

async function createWindow() {
  activeApiBaseUrl = (await readDesktopSettings()).apiBaseUrl;
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'Melisa ERP v2',
    icon: windowIconPath,
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--melisa-api-base-url=${encodeURIComponent(activeApiBaseUrl)}`],
    },
  });

  createMenu(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await loadErp(mainWindow);
}

function stopManagedProcesses() {
  for (const item of managedProcesses) {
    try {
      item.child.kill();
    } catch {
      // Process may already be closed.
    }
  }

  if (packagedWebServer) {
    packagedWebServer.close();
    packagedWebServer = null;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('com.melisababy.erp.desktop');
  app.whenReady().then(() => {
    ipcMain.handle('desktop:save-api-base-url', async (_event, value) => {
      try {
        activeApiBaseUrl = await saveDesktopSettings(value);
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 350);
        return { ok: true, apiBaseUrl: activeApiBaseUrl };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });
    createWindow();
  });
  app.on('second-instance', () => {
    const [mainWindow] = BrowserWindow.getAllWindows();
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

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
