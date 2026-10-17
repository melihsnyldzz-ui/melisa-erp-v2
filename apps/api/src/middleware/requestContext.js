import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger, requestLogPath } from '../utils/logger.js';

export function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const meta = {
      requestId,
      method: req.method,
      path: requestLogPath(req),
      statusCode: res.statusCode,
      durationMs,
      category: res.statusCode >= 500 ? 'api_error' : 'api_request',
    };

    if (durationMs >= env.slowRequestMs) {
      logger.warn('Slow API request', {
        ...meta,
        category: 'slow_request',
      });
      return;
    }

    if (res.statusCode >= 500) {
      logger.error('API request failed', meta);
      return;
    }

    logger.info('API request completed', meta);
  });

  next();
}
