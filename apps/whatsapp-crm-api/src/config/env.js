import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: fileURLToPath(new URL('../../auto-reply.env.local', import.meta.url)), override: true });
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

function integerMapEnv(name) {
  const value = process.env[name];
  if (!value) return new Map();

  return new Map(value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(':').map((part) => Number(part.trim())))
    .filter(([left, right]) => Number.isInteger(left) && left > 0 && Number.isInteger(right) && right > 0));
}

export const env = {
  port: numberEnv('WHATSAPP_CRM_PORT', Number(process.env.PORT || 4200)),
  appName: process.env.WHATSAPP_CRM_APP_NAME || 'melisa-whatsapp-crm-api',
  nodeEnv: process.env.WHATSAPP_CRM_NODE_ENV || process.env.NODE_ENV || 'development',
  requestBodyLimit: process.env.WHATSAPP_CRM_REQUEST_BODY_LIMIT || '5mb',
  rateLimit: {
    windowMs: numberEnv('WHATSAPP_CRM_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: numberEnv('WHATSAPP_CRM_RATE_LIMIT_MAX', 2000),
  },
  cors: {
    origins: listEnv('WHATSAPP_CRM_CORS_ORIGINS', ['http://localhost:5173']),
  },
  erpApi: {
    baseUrl: (process.env.ERP_API_BASE_URL || 'http://localhost:4100').replace(/\/+$/, ''),
  },
  auth: {
    jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '',
  },
  crmAccess: {
    enabled: booleanEnv('WHATSAPP_CRM_SECONDARY_LOCK_ENABLED', false),
    passwordHash: process.env.WHATSAPP_CRM_ACCESS_PASSWORD_HASH || '',
    tokenExpiresIn: process.env.WHATSAPP_CRM_ACCESS_TOKEN_EXPIRES_IN || '8h',
    rateLimitWindowMs: numberEnv('WHATSAPP_CRM_ACCESS_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    rateLimitMax: numberEnv('WHATSAPP_CRM_ACCESS_RATE_LIMIT_MAX', 5),
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
    liveSendApproved: booleanEnv('WHATSAPP_LIVE_SEND_APPROVED', false),
    autoReply: {
      enabled: booleanEnv('WHATSAPP_AUTO_REPLY_ENABLED', false),
      keyword: process.env.WHATSAPP_AUTO_REPLY_KEYWORD || 'selam melisa',
      imagePath: process.env.WHATSAPP_AUTO_REPLY_IMAGE_PATH || '',
      evolutionInstance: process.env.WHATSAPP_AUTO_REPLY_EVOLUTION_INSTANCE || '',
      cooldownMs: numberEnv('WHATSAPP_AUTO_REPLY_COOLDOWN_MS', 24 * 60 * 60 * 1000),
    },
  },
  evolution: {
    apiUrl: (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'melisa-test',
    webhookPublicUrl: process.env.EVOLUTION_WEBHOOK_PUBLIC_URL || 'http://localhost:4200/webhooks/evolution',
    timeoutMs: numberEnv('EVOLUTION_TIMEOUT_MS', 20000),
  },
  chatwoot: {
    baseUrl: (process.env.CHATWOOT_BASE_URL || 'http://localhost:3100').replace(/\/+$/, ''),
    accountId: numberEnv('CHATWOOT_ACCOUNT_ID', 0),
    inboxId: numberEnv('CHATWOOT_INBOX_ID', 0),
    apiAccessToken: process.env.CHATWOOT_API_ACCESS_TOKEN || '',
    timeoutMs: numberEnv('CHATWOOT_TIMEOUT_MS', 20000),
    inboxReadEnabled: booleanEnv('CHATWOOT_INBOX_READ_ENABLED', false),
    inboxFallbackEnabled: booleanEnv('CHATWOOT_INBOX_FALLBACK_ENABLED', true),
    includeGroups: booleanEnv('CHATWOOT_INCLUDE_GROUPS', false),
    agentPersonnelMap: integerMapEnv('CHATWOOT_AGENT_PERSONNEL_MAP'),
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

  if (env.crmAccess.enabled && !env.crmAccess.passwordHash) {
    warnings.push('WHATSAPP_CRM_ACCESS_PASSWORD_HASH is not configured; CRM access will fail closed.');
  }

  if (env.whatsapp.sendEnabled && env.whatsapp.testNumberOnly && env.whatsapp.allowedTestNumbers.length < 1) {
    warnings.push('WHATSAPP_SEND_ENABLED=true but WHATSAPP_ALLOWED_TEST_NUMBERS is empty; send endpoint will fail closed.');
  }

  if (env.whatsapp.sendEnabled && !env.whatsapp.testNumberOnly && !env.whatsapp.liveSendApproved) {
    warnings.push('Live WhatsApp send is requested but WHATSAPP_LIVE_SEND_APPROVED is not true; send endpoint will fail closed.');
  }

  if (env.whatsapp.autoReply.enabled && !env.whatsapp.autoReply.imagePath) {
    warnings.push('WhatsApp auto reply is enabled but WHATSAPP_AUTO_REPLY_IMAGE_PATH is empty; auto reply will fail closed.');
  }

  if (env.whatsapp.autoReply.enabled && !env.whatsapp.autoReply.evolutionInstance) {
    warnings.push('WhatsApp auto reply is enabled but WHATSAPP_AUTO_REPLY_EVOLUTION_INSTANCE is empty; auto reply will fail closed.');
  }

  if (env.whatsapp.provider === 'chatwoot'
    && (!env.chatwoot.baseUrl || !env.chatwoot.accountId || !env.chatwoot.apiAccessToken)) {
    warnings.push('WHATSAPP_PROVIDER=chatwoot but Chatwoot API settings are incomplete; send endpoint will fail closed.');
  }

  if (env.chatwoot.inboxReadEnabled
    && (!env.chatwoot.baseUrl || !env.chatwoot.accountId || !env.chatwoot.apiAccessToken)) {
    warnings.push('CHATWOOT_INBOX_READ_ENABLED=true but Chatwoot API settings are incomplete; inbox will use its configured fallback.');
  }

  if (env.chatwoot.inboxReadEnabled && !env.chatwoot.inboxId) {
    warnings.push('CHATWOOT_INBOX_READ_ENABLED=true but CHATWOOT_INBOX_ID is empty; all account inboxes may be visible.');
  }

  if (env.nodeEnv === 'production' && env.cors.origins.some((origin) => origin.includes('localhost'))) {
    warnings.push('WHATSAPP_CRM_CORS_ORIGINS contains localhost in production.');
  }

  return warnings;
}
