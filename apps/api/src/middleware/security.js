import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';

export function securityHeaders() {
  return helmet({
    crossOriginResourcePolicy: false,
  });
}

export function apiRateLimit() {
  if (!env.rateLimit.enabled) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'RATE_LIMITED', 'Too many requests'),
  });
}

export function corsOptions() {
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.nodeEnv !== 'production' || env.cors.origins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin is not allowed'));
    },
    credentials: true,
  };
}
