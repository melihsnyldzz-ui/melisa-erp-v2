import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
const runtimeSettingsKey = 'terminalRuntimeSettings';

function getDevServerApiBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  const host = String(hostUri || '').split(':')[0];

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return '';
  }

  return `http://${host}:4100`;
}

export function normalizeApiBaseUrl(value) {
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

export async function getRuntimeSettings() {
  const raw = await AsyncStorage.getItem(runtimeSettingsKey);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveRuntimeSettings(settings = {}) {
  const next = {
    apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl) || terminalConfig.apiBaseUrl,
  };
  await AsyncStorage.setItem(runtimeSettingsKey, JSON.stringify(next));
  return next;
}

export async function resetRuntimeSettings() {
  await AsyncStorage.removeItem(runtimeSettingsKey);
}

export async function getActiveApiBaseUrl() {
  const settings = await getRuntimeSettings();
  return normalizeApiBaseUrl(settings.apiBaseUrl || terminalConfig.apiBaseUrl);
}

export async function getApiUrl(path) {
  const normalizedBase = await getActiveApiBaseUrl();
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${normalizedBase}${normalizedPath}`;
}
