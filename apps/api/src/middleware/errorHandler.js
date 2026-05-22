import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'Unexpected server error'
    : err.message || 'Unexpected server error';

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
