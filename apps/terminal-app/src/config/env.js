import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

export const terminalConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || 'http://localhost:4100',
  deviceName: process.env.EXPO_PUBLIC_DEVICE_NAME || extra.deviceName || 'Depo Terminal',
  terminalCode: process.env.EXPO_PUBLIC_TERMINAL_CODE || extra.terminalCode || 'TERM-V2-001',
};

export function getApiUrl(path) {
  const normalizedBase = terminalConfig.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${normalizedBase}${normalizedPath}`;
}
