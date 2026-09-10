import express from 'express';
import { externalReadOnlyRoutes } from './routes/externalReadOnlyRoutes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

const host = process.env.EXTERNAL_READ_ONLY_HOST || '127.0.0.1';
const port = Number(process.env.EXTERNAL_READ_ONLY_PORT || 4112);
const perMinute = Math.min(600, Math.max(1, Number(process.env.EXTERNAL_READ_ONLY_RATE_LIMIT_PER_MINUTE || 60)));
const windows = new Map();

app.use((req, res, next) => {
  const now = Date.now();
  const bucket = Math.floor(now / 60000);
  const key = `${req.ip}:${bucket}`;
  const count = (windows.get(key) || 0) + 1;
  windows.set(key, count);
  if (windows.size > 5000) {
    for (const candidate of windows.keys()) {
      if (!candidate.endsWith(`:${bucket}`)) windows.delete(candidate);
    }
  }
  if (count > perMinute) {
    return res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return next();
});

app.use('/', externalReadOnlyRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' } });
});

app.use((error, _req, res, _next) => {
  console.error('[external-readonly-gateway]', error?.code || error?.message || error);
  res.status(Number(error?.statusCode) || 500).json({
    success: false,
    error: { code: error?.code || 'INTERNAL_ERROR', message: 'Read-only gateway request failed' },
  });
});

const server = app.listen(port, host, () => {
  console.log(`[external-readonly-gateway] listening on http://${host}:${port}`);
  console.log('[external-readonly-gateway] whitelist: /openapi.json, /health, /stock-codes/count, /stock-codes, /stock-codes/:stockCode');
});

function shutdown(signal) {
  console.log(`[external-readonly-gateway] ${signal} received`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
