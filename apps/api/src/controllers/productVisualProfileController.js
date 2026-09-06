import { getProductVisualProfile } from '../services/productVisualProfileService.js';
import { fail, ok } from '../utils/response.js';

export async function getVegaProductVisualProfile(req, res) {
  try {
    return ok(res, await getProductVisualProfile(req.params.sourceId), { source: 'product-brain-derived', writePerformed: false });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VISUAL_PROFILE_UNAVAILABLE', 'Görsel bilgileri alınamadı.');
  }
}
