import {isSharedStableLocation,SHARED_STABLE_ORIGIN} from '../workflow/sharedStableTopology.mjs';
const desktopApiBaseUrl = globalThis.window?.melisaDesktop?.apiBaseUrl;

export const API_BASE_URL = (
  (isSharedStableLocation(globalThis.window?.location)?SHARED_STABLE_ORIGIN:null)
  || desktopApiBaseUrl
  || import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:4100'
).replace(/\/$/, '');

const vegaBridgeMode = import.meta.env.VITE_VEGA_BRIDGE_MODE === 'true';
export const apiConfig = {
  baseUrl: API_BASE_URL,
  vegaBridgeMode,
  vegaProductsMode: !vegaBridgeMode && import.meta.env.VITE_VEGA_PRODUCTS_MODE === 'true',
  vegaProductsBaseUrl: import.meta.env.VITE_VEGA_PRODUCTS_BASE_URL || 'https://vega-api.melisababy.com',
  demoMode: !vegaBridgeMode && import.meta.env.VITE_DEMO_MODE === 'true',
  localPasswordlessLogin: !vegaBridgeMode && import.meta.env.VITE_LOCAL_PASSWORDLESS_LOGIN === 'true',
};
