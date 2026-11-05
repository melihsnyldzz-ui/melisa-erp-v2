import {assertEmptyLocalBuildEnvironment, assertEmptyLocalBrowserOrigin, EMPTY_LOCAL_API_BASE} from './emptyLocalInstallation.mjs';

const emptyLocalInstallation = assertEmptyLocalBuildEnvironment(import.meta.env);
if (emptyLocalInstallation && globalThis.window) {
  assertEmptyLocalBrowserOrigin(globalThis.window.location);
}
const desktopApiBaseUrl = globalThis.window?.melisaDesktop?.apiBaseUrl;

export const API_BASE_URL = (
  (emptyLocalInstallation ? EMPTY_LOCAL_API_BASE : desktopApiBaseUrl)
  || import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:4100'
).replace(/\/$/, '');

export const apiConfig = {
  baseUrl: API_BASE_URL,
  emptyLocalInstallation,
  demoMode: !emptyLocalInstallation && import.meta.env.VITE_DEMO_MODE === 'true',
  pilotMode: emptyLocalInstallation || import.meta.env.VITE_MELISA_PILOT === 'true',
  localPasswordlessLogin: !emptyLocalInstallation && import.meta.env.VITE_LOCAL_PASSWORDLESS_LOGIN === 'true',
};
