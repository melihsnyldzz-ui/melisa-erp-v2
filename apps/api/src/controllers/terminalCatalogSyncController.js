import { terminalCatalogSync } from '../services/terminalCatalogSync.mjs';
import { fail, ok } from '../utils/response.js';
const errorResponse = (res, error) => fail(res, error.statusCode || 503, error.code || 'CATALOG_SYNC_FAILED', error.statusCode ? error.message : 'Güncelleme hizmeti kullanılamıyor.');
export async function getTerminalCatalogVersion(req, res) {
  try { res.set('Cache-Control', 'no-store'); return ok(res, await terminalCatalogSync.version(req.query, req.user), { readOnly: true }); }
  catch (error) { return errorResponse(res, error); }
}
export function startTerminalCatalogSync(req, res) {
  try { return ok(res.status(202), terminalCatalogSync.start(req.body || {}, req.user), { readOnly: true }); }
  catch (error) { return errorResponse(res, error); }
}
export function getTerminalCatalogSyncPage(req, res) {
  try { return ok(res, terminalCatalogSync.page(req.params.jobId, req.query, req.user), { readOnly: true }); }
  catch (error) { return errorResponse(res, error); }
}
