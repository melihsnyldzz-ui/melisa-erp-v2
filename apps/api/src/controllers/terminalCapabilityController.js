import { getTerminalSaleCapabilities } from '../services/terminalSaleCapabilities.mjs';
import { ok } from '../utils/response.js';

export async function getTerminalSalesCapabilities(req, res) {
  res.set('Cache-Control', 'no-store');
  return ok(res, await getTerminalSaleCapabilities({ terminalCode: req.query.terminalCode, actor: req.user }),
    { source: 'terminal-sale-capabilities', readOnly: true });
}
