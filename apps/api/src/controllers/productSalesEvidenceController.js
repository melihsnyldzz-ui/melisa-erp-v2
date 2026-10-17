import { getVegaProductSalesEvidence } from '../services/vegaProductSalesEvidenceService.js';
import { fail, ok } from '../utils/response.js';

export function createProductSalesEvidenceController(readEvidence = getVegaProductSalesEvidence) {
  return async (req, res) => {
    try {
      const { data, meta } = await readEvidence(req.query);
      return ok(res, data, meta);
    } catch (error) {
      const known = /^VEGA_SALES_EVIDENCE_[A-Z_]+$/.test(error?.code ?? '') && [400, 404, 502].includes(error.statusCode);
      const code = known ? error.code : 'VEGA_SALES_EVIDENCE_UNAVAILABLE';
      const status = known ? error.statusCode : 404;
      return fail(res, status, code, code, { state: status === 404 ? 'UNAVAILABLE' : 'INVALID', writePerformed: false });
    }
  };
}

export const getProductSalesEvidence = createProductSalesEvidenceController();
