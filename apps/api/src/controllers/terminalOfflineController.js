import { loadTerminalOfflineContext } from '../services/terminalOfflineCatalogService.mjs';
import { fail, ok } from '../utils/response.js';

export async function getTerminalOfflineContext(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try { return ok(res, await loadTerminalOfflineContext({ terminalCode: req.query.terminalCode, actor: req.user }),
    { source: 'terminal-offline-download', readOnly: true }); }
  catch (error) { return fail(res, error.statusCode || 503, error.code || 'TERMINAL_OFFLINE_DOWNLOAD_FAILED',
    error.statusCode ? error.message : 'Cihaz satış verileri indirilemedi. Mevcut veriler korunuyor.'); }
}
