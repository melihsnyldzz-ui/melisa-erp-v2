import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {normalizeOperationQuarantineError} from '../services/operationQuarantineError.mjs';

export function errorHandler(err, req, res, next) {
  err=normalizeOperationQuarantineError(err);
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'Unexpected server error'
    : err.message || 'Unexpected server error';

  logger.error('API error normalized', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    category: err.category || 'api_error',
  });

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
    meta: {
      requestId: req.requestId,
    },
  });
}
