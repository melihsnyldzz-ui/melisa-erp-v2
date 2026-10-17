import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { vegaProductAccess } from './vegaProductAccess.js';
import { normalizePage, sourceId, verifyDetail } from '../modules/vega/vegaReadModel.js';
const prefix = '/api/vega-read';
export async function fetchVegaBridgeProducts({ mode = 'list', query = '', cursor } = {}, options = {}) {
  let path = `${prefix}/products`;
  const params = { limit: 50 };
  if (mode === 'search') { path += '/search'; params.q = query; }
  else if (mode === 'barcode') path += `/barcode/${encodeURIComponent(query)}`;
  else if (cursor) params.cursor = cursor;
  const response = await (apiConfig.vegaProductsMode ? vegaProductAccess.get : get)(path, params, options);
  return normalizePage(response, 'stock-card', { barcode: mode === 'barcode', cursor });
}
export async function fetchVegaBridgeProduct(id, options = {}) {
  return verifyDetail(await (apiConfig.vegaProductsMode ? vegaProductAccess.get : get)(`${prefix}/products/${sourceId(id)}`, {}, options), 'stock-card', id);
}
export async function fetchVegaBridgeAccounts({ cursor } = {}, options = {}) {
  return normalizePage(await get(`${prefix}/accounts`, { limit: 50, cursor }, options), 'account-card', { cursor });
}
export async function fetchVegaBridgeAccount(id, options = {}) {
  return verifyDetail(await get(`${prefix}/accounts/${sourceId(id)}`, {}, options), 'account-card', id);
}
export function fetchVegaBridgeHealth(options = {}) { return get('/health', {}, options); }
