import { apiConfig } from '../config/apiConfig.js';
import { createVegaProductClient } from './vegaProductClient.js';
import { createVegaProductStorage } from './vegaProductStorage.js';

function browserStorage(name) {
  try { return globalThis.window?.[name]; } catch { return undefined; }
}

export const vegaProductAccess = apiConfig.vegaProductsMode ? createVegaProductClient({
  allowLocalTest: import.meta.env.VITE_TEST_READ_ONLY === 'true',
  baseUrl: apiConfig.vegaProductsBaseUrl,
  storage: createVegaProductStorage(browserStorage('localStorage'), browserStorage('sessionStorage')),
  onExpired: () => window.dispatchEvent(new CustomEvent('melisa-vega-products-expired')),
}) : null;
