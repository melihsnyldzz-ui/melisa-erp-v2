import { fail } from '../utils/response.js';

export function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', 'Route not found', {
    requestId: req.requestId,
  });
}
