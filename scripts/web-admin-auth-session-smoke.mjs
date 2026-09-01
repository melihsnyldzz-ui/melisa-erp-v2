import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shouldRetryWithRenewedSession } from '../apps/web-admin/src/services/authRetryPolicy.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const webRoot = resolve(repoRoot, 'apps/web-admin');
const apiClientSource = readFileSync(resolve(webRoot, 'src/services/apiClient.js'), 'utf8');
const checks = [];

function addCheck(name, passed) {
  checks.push([name, Boolean(passed)]);
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    clear: () => values.clear(),
    getItem: (key) => values.has(key) ? values.get(key) : null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

addCheck('expired access token on auth/me renews the stored session', shouldRetryWithRenewedSession({ path: '/api/auth/me', retryAuth: true }));
addCheck('expired access token on a business route renews the stored session', shouldRetryWithRenewedSession({ path: '/api/products', retryAuth: true }));
addCheck('an already retried request cannot renew twice', !shouldRetryWithRenewedSession({ path: '/api/auth/me', retryAuth: false }));
addCheck('login failure does not start a refresh loop', !shouldRetryWithRenewedSession({ path: '/api/auth/login', retryAuth: true }));
addCheck('refresh failure does not call refresh recursively', !shouldRetryWithRenewedSession({ path: '/api/auth/refresh', retryAuth: true }));
addCheck('logout failure does not renew the session being closed', !shouldRetryWithRenewedSession({ path: '/api/auth/logout', retryAuth: true }));
addCheck('terminal login failure remains an authentication result', !shouldRetryWithRenewedSession({ path: '/api/auth/terminal-login', retryAuth: true }));
addCheck('api client uses the centralized retry policy for 401 responses', apiClientSource.includes('shouldRetryWithRenewedSession({ path, retryAuth })'));
addCheck('stale access token alone cannot trigger passwordless admin renewal', !apiClientSource.includes('|| Boolean(getStoredAccessToken())'));

const accessTokenKey = 'melisaErpAccessToken';
const refreshTokenKey = 'melisaErpRefreshToken';
const localPasswordlessKey = 'melisaErpLocalPasswordlessSession';
const storage = createMemoryStorage();
const requests = [];
let scenario = 'refresh-success';
let expiredEventCount = 0;

const hadWindow = Object.hasOwn(globalThis, 'window');
const hadCustomEvent = Object.hasOwn(globalThis, 'CustomEvent');
const previousWindow = globalThis.window;
const previousCustomEvent = globalThis.CustomEvent;
const previousFetch = globalThis.fetch;
const previousApiBaseUrl = process.env.VITE_API_BASE_URL;
const previousDemoMode = process.env.VITE_DEMO_MODE;
const previousLocalPasswordlessLogin = process.env.VITE_LOCAL_PASSWORDLESS_LOGIN;

process.env.VITE_API_BASE_URL = 'http://auth.test';
process.env.VITE_DEMO_MODE = 'false';
process.env.VITE_LOCAL_PASSWORDLESS_LOGIN = 'true';

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
globalThis.window = {
  localStorage: storage,
  dispatchEvent(event) {
    if (event.type === 'melisa-auth-expired') expiredEventCount += 1;
    return true;
  },
};
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  const authorization = options.headers?.Authorization || '';
  requests.push({ path: url.pathname, authorization, method: options.method || 'GET' });

  if (url.pathname === '/api/auth/me') {
    if (authorization === 'Bearer renewed-access' || authorization === 'Bearer local-renewed-access') {
      return jsonResponse({ success: true, data: { username: 'renewed-user', permissions: [] } });
    }

    if (authorization === 'Bearer concurrent-renewed-access') {
      return jsonResponse({ success: true, data: { username: 'concurrent-user', permissions: [] } });
    }

    return jsonResponse({ success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Access token expired.' } }, 401);
  }

  if (url.pathname === '/api/auth/refresh') {
    if (scenario === 'refresh-failure') {
      return jsonResponse({ success: false, error: { code: 'AUTH_REFRESH_INVALID', message: 'Refresh token invalid.' } }, 401);
    }

    if (scenario === 'concurrent-refresh') {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
      return jsonResponse({ success: true, data: { accessToken: 'concurrent-renewed-access' } });
    }

    return jsonResponse({ success: true, data: { accessToken: 'renewed-access' } });
  }

  if (url.pathname === '/api/auth/local-passwordless-admin') {
    return jsonResponse({ success: true, data: { accessToken: 'local-renewed-access', localPasswordlessSession: true } });
  }

  throw new Error(`Unexpected request: ${url.pathname}`);
};

const requireFromWeb = createRequire(resolve(webRoot, 'package.json'));
const viteEntry = requireFromWeb.resolve('vite');
const { createServer } = await import(pathToFileURL(viteEntry).href);
let viteServer;

try {
  viteServer = await createServer({
    root: webRoot,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://auth.test'),
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify('false'),
      'import.meta.env.VITE_LOCAL_PASSWORDLESS_LOGIN': JSON.stringify('true'),
    },
  });
  const { fetchMe } = await viteServer.ssrLoadModule('/src/services/authApi.js');

  scenario = 'refresh-success';
  requests.length = 0;
  expiredEventCount = 0;
  storage.clear();
  storage.setItem(accessTokenKey, 'expired-access');
  storage.setItem(refreshTokenKey, 'kept-refresh');
  const restored = await fetchMe();
  addCheck('real fetchMe flow returns the user after silent renewal', restored.data.username === 'renewed-user');
  addCheck('real fetchMe flow calls me, refresh and me in order', requests.map((request) => request.path).join('>') === '/api/auth/me>/api/auth/refresh>/api/auth/me');
  addCheck('retried auth/me uses the renewed bearer token', requests.at(-1)?.authorization === 'Bearer renewed-access');
  addCheck('renewed access token is stored and existing refresh token is preserved', storage.getItem(accessTokenKey) === 'renewed-access' && storage.getItem(refreshTokenKey) === 'kept-refresh');
  addCheck('successful silent renewal does not emit session expiry', expiredEventCount === 0);

  scenario = 'refresh-failure';
  requests.length = 0;
  expiredEventCount = 0;
  storage.clear();
  storage.setItem(accessTokenKey, 'expired-access');
  storage.setItem(refreshTokenKey, 'invalid-refresh');
  await assert.rejects(() => fetchMe(), /Access token expired/);
  addCheck('failed refresh stops without a retry loop', requests.map((request) => request.path).join('>') === '/api/auth/me>/api/auth/refresh');
  addCheck('failed refresh clears tokens and emits expiry once', storage.getItem(accessTokenKey) === null && storage.getItem(refreshTokenKey) === null && expiredEventCount === 1);

  scenario = 'markerless-passwordless';
  requests.length = 0;
  expiredEventCount = 0;
  storage.clear();
  storage.setItem(accessTokenKey, 'stale-access-only');
  await assert.rejects(() => fetchMe(), /Access token expired/);
  addCheck('markerless session never calls local passwordless admin', !requests.some((request) => request.path === '/api/auth/local-passwordless-admin'));

  scenario = 'marked-passwordless';
  requests.length = 0;
  expiredEventCount = 0;
  storage.clear();
  storage.setItem(accessTokenKey, 'expired-local-access');
  storage.setItem(localPasswordlessKey, 'true');
  const localRestored = await fetchMe();
  addCheck('marked local passwordless session can renew safely', localRestored.data.username === 'renewed-user' && requests.some((request) => request.path === '/api/auth/local-passwordless-admin'));

  scenario = 'concurrent-refresh';
  requests.length = 0;
  expiredEventCount = 0;
  storage.clear();
  storage.setItem(accessTokenKey, 'expired-concurrent-access');
  storage.setItem(refreshTokenKey, 'concurrent-refresh');
  const concurrentUsers = await Promise.all([fetchMe(), fetchMe()]);
  addCheck('concurrent 401 responses share one refresh request', requests.filter((request) => request.path === '/api/auth/refresh').length === 1);
  addCheck('both concurrent requests recover with the renewed session', concurrentUsers.every((response) => response.data.username === 'concurrent-user'));
} finally {
  await viteServer?.close();
  globalThis.fetch = previousFetch;
  if (hadWindow) globalThis.window = previousWindow;
  else delete globalThis.window;
  if (hadCustomEvent) globalThis.CustomEvent = previousCustomEvent;
  else delete globalThis.CustomEvent;
  if (previousApiBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = previousApiBaseUrl;
  if (previousDemoMode === undefined) delete process.env.VITE_DEMO_MODE;
  else process.env.VITE_DEMO_MODE = previousDemoMode;
  if (previousLocalPasswordlessLogin === undefined) delete process.env.VITE_LOCAL_PASSWORDLESS_LOGIN;
  else process.env.VITE_LOCAL_PASSWORDLESS_LOGIN = previousLocalPasswordlessLogin;
}

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - Auth Session / ${name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
