import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';

export function securityHeaders() {
  return helmet({
    crossOriginResourcePolicy: false,
  });
}

export function crmCors() {
  return cors({
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
  });
}

export function apiRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'WHATSAPP_CRM_RATE_LIMITED', 'Too many requests'),
  });
}
