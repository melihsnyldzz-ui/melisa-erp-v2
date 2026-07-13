import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

export const env = {
  port: numberEnv('WHATSAPP_CRM_PORT', Number(process.env.PORT || 4200)),
  appName: process.env.WHATSAPP_CRM_APP_NAME || 'melisa-whatsapp-crm-api',
  nodeEnv: process.env.WHATSAPP_CRM_NODE_ENV || process.env.NODE_ENV || 'development',
  requestBodyLimit: process.env.WHATSAPP_CRM_REQUEST_BODY_LIMIT || '5mb',
  cors: {
    origins: listEnv('WHATSAPP_CRM_CORS_ORIGINS', ['http://localhost:5173']),
  },
  erpApi: {
    baseUrl: (process.env.ERP_API_BASE_URL || 'http://localhost:4100').replace(/\/+$/, ''),
  },
  auth: {
    jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '',
  },
  postgres: {
    url: process.env.WHATSAPP_CRM_POSTGRES_URL || '',
    poolMax: numberEnv('WHATSAPP_CRM_POSTGRES_POOL_MAX', 8),
    idleTimeoutMs: numberEnv('WHATSAPP_CRM_POSTGRES_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMs: numberEnv('WHATSAPP_CRM_POSTGRES_CONNECTION_TIMEOUT_MS', 5000),
  },
  redis: {
    url: process.env.WHATSAPP_CRM_REDIS_URL || '',
  },
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'evolution',
    webhookSecret: process.env.WHATSAPP_CRM_WEBHOOK_SECRET || '',
    sendEnabled: booleanEnv('WHATSAPP_SEND_ENABLED', false),
    testNumberOnly: booleanEnv('WHATSAPP_TEST_NUMBER_ONLY', true),
    allowedTestNumbers: listEnv('WHATSAPP_ALLOWED_TEST_NUMBERS'),
  },
  evolution: {
    apiUrl: (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'melisa-test',
    webhookPublicUrl: process.env.EVOLUTION_WEBHOOK_PUBLIC_URL || 'http://localhost:4200/webhooks/evolution',
  },
};

export function getStartupWarnings() {
  const warnings = [];

  if (!env.auth.jwtSecret) {
    warnings.push('JWT_ACCESS_SECRET is not configured; CRM user auth will fail closed.');
  }

  if (!env.whatsapp.webhookSecret) {
    warnings.push('WHATSAPP_CRM_WEBHOOK_SECRET is not configured; webhook endpoint will fail closed.');
  }

  if (env.whatsapp.sendEnabled) {
    warnings.push('WHATSAPP_SEND_ENABLED=true requires explicit test-number approval before any send endpoint is added.');
  }

  if (env.nodeEnv === 'production' && env.cors.origins.some((origin) => origin.includes('localhost'))) {
    warnings.push('WHATSAPP_CRM_CORS_ORIGINS contains localhost in production.');
  }

  return warnings;
}
