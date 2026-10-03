const desktopApiBaseUrl = globalThis.window?.melisaDesktop?.apiBaseUrl;

export const API_BASE_URL = (
  desktopApiBaseUrl
  || import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:4100'
).replace(/\/$/, '');

export const apiConfig = {
  baseUrl: API_BASE_URL,
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  pilotMode: import.meta.env.VITE_MELISA_PILOT === 'true',
  localPasswordlessLogin: import.meta.env.VITE_LOCAL_PASSWORDLESS_LOGIN === 'true',
};
