export const EMPTY_LOCAL_INSTALLATION = '20261105';
export const EMPTY_LOCAL_API_BASE = 'http://127.0.0.1:4294';
export const EMPTY_LOCAL_WEB_ORIGIN = 'http://127.0.0.1:5294';
export const EMPTY_LOCAL_TITLE = 'Boş yerel kurulum — İlk açılış kontrolü';
export const emptyLocalScreenIds = new Set(['dashboard', 'stock-list', 'customer-list', 'supplier-list']);
const readPaths = new Set([
  '/api/auth/me',
  '/api/products',
  '/api/products/options',
  '/api/customers',
  '/api/suppliers',
  '/api/dashboard/summary',
  '/api/dashboard/alerts',
]);

// This profile is an exact, separate installation. It cannot adopt another API,
// browser origin, passwordless identity, demo data or a legacy integration.
export function assertEmptyLocalBuildEnvironment(environment, mode) {
  const selected = environment.VITE_EMPTY_LOCAL_INSTALLATION !== undefined;
  if (!selected && mode !== 'empty-local') return false;
  if (environment.VITE_EMPTY_LOCAL_INSTALLATION !== EMPTY_LOCAL_INSTALLATION
    || environment.VITE_API_BASE_URL !== EMPTY_LOCAL_API_BASE
    || environment.VITE_DEMO_MODE !== 'false'
    || environment.VITE_MELISA_PILOT !== 'true'
    || environment.VITE_LOCAL_PASSWORDLESS_LOGIN !== 'false'
    || ['VITE_VEGA_BRIDGE_MODE', 'VITE_VEGA_PRODUCTS_MODE'].some(key => environment[key] && environment[key] !== 'false')
    || environment.VITE_ERP_WORKFACE
    || environment.VITE_VEGA_PRODUCTS_BASE_URL && environment.VITE_VEGA_PRODUCTS_BASE_URL !== EMPTY_LOCAL_API_BASE) {
    throw Error('EMPTY_LOCAL_BUILD_PROFILE_REQUIRED');
  }
  return true;
}

export function assertEmptyLocalBrowserOrigin(location) {
  if (location?.origin !== EMPTY_LOCAL_WEB_ORIGIN || location.protocol !== 'http:'
    || location.hostname !== '127.0.0.1' || location.port !== '5294') {
    throw Error('EMPTY_LOCAL_BROWSER_ORIGIN_REQUIRED');
  }
}

export function assertEmptyLocalRequest(method, path) {
  if (!(method === 'GET' && readPaths.has(path)
    || method === 'POST' && path === '/api/auth/login')) {
    const error = new Error('İlk açılış kontrolü salt okunurdur. Bu işlem kullanıma açık değil.');
    error.code = 'EMPTY_LOCAL_READ_ONLY';
    error.status = 403;
    throw error;
  }
}
