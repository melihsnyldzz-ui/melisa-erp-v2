import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { historyPermissions } from '../services/vegaHistoryCore.mjs';
import { getVegaHistoryAccountLink, getVegaHistoryDocument, listVegaHistoryDocuments, listVegaHistoryLedger, listVegaHistoryParties } from '../services/vegaHistoryService.js';

function verifyHistoryScope(req, res, next, company) {
  try {
    const permissions = historyPermissions(company);
    let index = 0;
    const verify = error => error ? next(error) : index < permissions.length ? requirePermission(permissions[index++])(req, res, verify) : next();
    verify();
  } catch (error) { next(error); }
}
function requireHistoryScope(req, res, next) { verifyHistoryScope(req, res, next, req.query.company); }
function requireHistoryLinkScope(req, res, next) {
  // Permissions select only the company. The service validates the selected
  // source/period against its reviewed manifest before any archive read.
  verifyHistoryScope(req, res, next, { customer: 'F0102', supplier: 'F0103' }[req.query.entityType]);
}
const handle = service => async (req, res, next) => { try { res.json(await service(req.query)); } catch (error) { next(error); } };
// Mounted by the parent router under /api. No create/finalize/export/import route.
export const vegaHistoryRoutes = Router();
vegaHistoryRoutes.get('/vega-history/parties', requireAuth, requireHistoryScope, handle(listVegaHistoryParties));
vegaHistoryRoutes.get('/vega-history/documents', requireAuth, requireHistoryScope, handle(listVegaHistoryDocuments));
vegaHistoryRoutes.get('/vega-history/documents/detail', requireAuth, requireHistoryScope, handle(getVegaHistoryDocument));
vegaHistoryRoutes.get('/vega-history/ledger', requireAuth, requireHistoryScope, handle(listVegaHistoryLedger));
vegaHistoryRoutes.get('/vega-history/account-link', requireAuth, requireHistoryLinkScope, handle(getVegaHistoryAccountLink));
