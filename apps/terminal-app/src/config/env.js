import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

function getDevServerApiBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  const host = String(hostUri || '').split(':')[0];

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return '';
  }

  return `http://${host}:4100`;
}

function normalizeApiBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

export const terminalConfig = {
  apiBaseUrl: normalizeApiBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL
    || extra.apiBaseUrl
    || getDevServerApiBaseUrl()
    || 'http://localhost:4100',
  ),
  deviceName: process.env.EXPO_PUBLIC_DEVICE_NAME || extra.deviceName || 'Depo Terminal',
  terminalCode: process.env.EXPO_PUBLIC_TERMINAL_CODE || extra.terminalCode || 'TERM-V2-001',
};

export function getApiUrl(path) {
  const normalizedBase = normalizeApiBaseUrl(terminalConfig.apiBaseUrl);
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${normalizedBase}${normalizedPath}`;
}
