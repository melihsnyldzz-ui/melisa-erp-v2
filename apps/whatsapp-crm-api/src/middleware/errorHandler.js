import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'WHATSAPP_CRM_INTERNAL_ERROR';
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'Unexpected WhatsApp CRM server error'
    : err.message || 'Unexpected WhatsApp CRM server error';

  logger.error('WhatsApp CRM error normalized', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    providerStatus: err.meta?.status,
    providerPayload: err.meta?.payload,
  });

  const meta = {
    requestId: req.requestId,
  };

  if (err.meta?.payload && env.nodeEnv !== 'production') {
    meta.provider = {
      status: err.meta.status,
      message: err.meta.payload?.message || err.meta.payload?.error || err.meta.payload?.response?.message,
    };
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
    meta,
  });
}
