import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { created, fail, ok } from '../utils/response.js';
import { getTerminalCustomerRoutes, createTerminalCustomerRoute, updateTerminalCustomerRoute, updateTerminalCustomerRouteAssignments } from '../services/terminalCustomerRoutesService.mjs';

export function createTerminalCustomerRoutesRouter({
  authenticate = requireAuth,
  authorize = requirePermission,
  overview = getTerminalCustomerRoutes,
  create = createTerminalCustomerRoute,
  update = updateTerminalCustomerRoute,
  assign = updateTerminalCustomerRouteAssignments,
} = {}) {
  const router = Router();
  const path = '/terminal-admin/customer-routes';
  const handler = (operation, response = ok) => async (req, res) => {
    try { return response(res, await operation(req), { source: 'sql-terminal-customer-routes' }); }
    catch (cause) { return fail(res, cause.statusCode || 503, cause.statusCode ? cause.code : 'TERMINAL_ROUTES_REQUEST_FAILED', cause.statusCode ? cause.message : 'Terminal rota işlemi tamamlanamadı.'); }
  };
  const guards = [authenticate, authorize('settings.manage')];
  router.get(path, ...guards, handler(() => overview()));
  router.post(path, ...guards, handler((req) => create(req.body, req.user), created));
  router.put(`${path}/assignments`, ...guards, handler((req) => assign(req.body, req.user)));
  router.put(`${path}/:routeId`, ...guards, handler((req) => update(req.params.routeId, req.body, req.user)));
  return router;
}

export const terminalCustomerRoutesRoutes = createTerminalCustomerRoutesRouter();
