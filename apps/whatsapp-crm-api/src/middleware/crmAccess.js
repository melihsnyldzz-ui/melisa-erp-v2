import { verifyCrmAccessToken } from '../services/crmAccessService.js';

export function requireCrmUnlock(req, res, next) {
  try {
    verifyCrmAccessToken(req.get('x-crm-unlock-token') || '', req.user);
    return next();
  } catch (error) {
    return next(error);
  }
}
