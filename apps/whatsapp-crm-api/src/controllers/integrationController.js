import { getChatwootPersonnelMapping } from '../services/chatwootPersonnelMappingService.js';
import { ok } from '../utils/response.js';

export async function getChatwootPersonnelMappingController(req, res, next) {
  try {
    const result = await getChatwootPersonnelMapping({ accessToken: req.erpAccessToken });
    return ok(res, result, { source: 'chatwoot-personnel-mapping', readOnly: true });
  } catch (error) {
    return next(error);
  }
}
