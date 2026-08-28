import { unlockCrmAccess } from '../services/crmAccessService.js';
import { recordCrmAccessAudit } from '../services/crmAccessAuditService.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/response.js';

export async function postCrmAccessUnlock(req, res, next) {
  try {
    const result = unlockCrmAccess({ password: req.body?.password, user: req.user });
    const audit = await recordCrmAccessAudit({
      success: true,
      user: req.user,
      requestId: req.requestId,
      ipAddress: req.ip,
    });
    return ok(res, result, { audit });
  } catch (error) {
    try {
      await recordCrmAccessAudit({
        success: false,
        user: req.user,
        requestId: req.requestId,
        ipAddress: req.ip,
        reason: error.code || 'WHATSAPP_CRM_ACCESS_DENIED',
      });
    } catch (auditError) {
      logger.error('WhatsApp CRM denied-access audit could not be persisted', {
        requestId: req.requestId,
        errorCode: auditError.code || 'CRM_ACCESS_AUDIT_FAILED',
      });
    }
    return next(error);
  }
}
