import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'WHATSAPP_CRM_RATE_LIMITED', 'Too many requests'),
  });
}

export const crmAccessRateLimit = rateLimit({
  windowMs: env.crmAccess.rateLimitWindowMs,
  max: env.crmAccess.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `crm-unlock:${req.user?.id || ipKeyGenerator(req.ip)}`,
  handler: (req, res) => fail(
    res,
    429,
    'WHATSAPP_CRM_ACCESS_RATE_LIMITED',
    'Cok fazla hatali CRM sifresi denendi. Bir sure sonra tekrar deneyin.',
  ),
});
