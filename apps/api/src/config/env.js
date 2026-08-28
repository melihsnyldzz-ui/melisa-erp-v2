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
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

export const env = {
  port: Number(process.env.API_PORT || process.env.PORT || 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v0.1.0',
  appName: process.env.APP_NAME || 'melisa-erp-api',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '2mb',
  slowRequestMs: numberEnv('SLOW_REQUEST_MS', 1500),
  cors: {
    origins: listEnv('CORS_ORIGINS', ['http://localhost:5187', 'http://localhost:19006']),
  },
  rateLimit: {
    enabled: String(process.env.RATE_LIMIT_ENABLED || 'true').toLowerCase() !== 'false',
    windowMs: numberEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: numberEnv('RATE_LIMIT_MAX', 300),
  },
  sql: {
    trustedConnection: String(process.env.SQL_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true',
    enabled: Boolean(
      process.env.SQL_SERVER
        && process.env.SQL_DATABASE
        && (
          String(process.env.SQL_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true'
          || (process.env.SQL_USER && process.env.SQL_PASSWORD)
        ),
    ),
    server: process.env.SQL_SERVER || '',
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
    database: process.env.SQL_DATABASE || '',
    odbcDriver: process.env.SQL_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server',
    user: process.env.SQL_USER || '',
    password: process.env.SQL_PASSWORD || '',
    encrypt: String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    readOnly: String(process.env.SQL_READ_ONLY || 'true').toLowerCase() !== 'false',
  },
  vega: {
    enabled: Boolean(
      process.env.VEGA_SQL_SERVER
        && process.env.VEGA_SQL_DATABASE
        && process.env.VEGA_SQL_USER
        && process.env.VEGA_SQL_PASSWORD,
    ),
    server: process.env.VEGA_SQL_SERVER || '',
    localAddress: process.env.VEGA_SQL_LOCAL_ADDRESS || '',
    port: process.env.VEGA_SQL_PORT ? Number(process.env.VEGA_SQL_PORT) : 1433,
    database: process.env.VEGA_SQL_DATABASE || '',
    user: process.env.VEGA_SQL_USER || '',
    password: process.env.VEGA_SQL_PASSWORD || '',
    companyCode: process.env.VEGA_COMPANY_CODE || 'F0102',
    periodCode: process.env.VEGA_PERIOD_CODE || 'D0007',
    year: Number(process.env.VEGA_YEAR || 2026),
    encrypt: String(process.env.VEGA_SQL_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.VEGA_SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
  },
  auth: {
    jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    localPasswordlessLogin: String(process.env.MELISA_LOCAL_PASSWORDLESS_LOGIN || 'false').toLowerCase() === 'true',
  },
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'evolution',
    enabled: String(process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true',
    sendApproved: String(process.env.WHATSAPP_SEND_APPROVED || 'false').toLowerCase() === 'true',
    baseUrl: process.env.WHATSAPP_API_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    instance: process.env.WHATSAPP_INSTANCE || '',
    publicApiUrl: process.env.WHATSAPP_PUBLIC_API_URL || process.env.PUBLIC_API_URL || 'http://localhost:4100',
    timeoutMs: numberEnv('WHATSAPP_TIMEOUT_MS', 20000),
    sendDelayMs: numberEnv('WHATSAPP_SEND_DELAY_MS', 1200),
  },
  nakliyat: {
    enabled: booleanEnv('NAKLIYAT_ENABLED', (process.env.NODE_ENV || 'development') !== 'production'),
    baseUrl: process.env.NAKLIYAT_API_BASE_URL || 'http://127.0.0.1:44555',
    serviceEmail: process.env.NAKLIYAT_SERVICE_EMAIL || '',
    servicePassword: process.env.NAKLIYAT_SERVICE_PASSWORD || '',
    timeoutMs: numberEnv('NAKLIYAT_TIMEOUT_MS', 20000),
    allowProductionRates: booleanEnv('NAKLIYAT_ALLOW_PRODUCTION_RATES', false),
    allowDraftCreate: booleanEnv('NAKLIYAT_ALLOW_DRAFT_CREATE', false),
    allowCustomerQuoteCreate: booleanEnv('NAKLIYAT_ALLOW_CUSTOMER_QUOTE_CREATE', false),
    allowFinalize: booleanEnv('NAKLIYAT_ALLOW_FINALIZE', false),
  },
  receiptPrinting: {
    enabled: String(process.env.TERMINAL_RECEIPT_PRINT_ENABLED || 'true').toLowerCase() !== 'false',
    mode: process.env.TERMINAL_RECEIPT_PRINT_MODE || (process.platform === 'win32' ? 'windows' : 'disabled'),
    printerName: process.env.TERMINAL_RECEIPT_PRINTER_NAME || '',
    timeoutMs: numberEnv('TERMINAL_RECEIPT_PRINT_TIMEOUT_MS', 20000),
  },
};

export function getStartupWarnings() {
  const warnings = [];

  if (env.nodeEnv === 'production') {
    if (!env.auth.jwtSecret || env.auth.jwtSecret.length < 32) {
      warnings.push('JWT_ACCESS_SECRET is missing or shorter than 32 characters');
    }

    if (!env.auth.refreshSecret || env.auth.refreshSecret.length < 32) {
      warnings.push('JWT_REFRESH_SECRET is missing or shorter than 32 characters');
    }

    if (!env.sql.enabled) {
      warnings.push('SQL connection is not configured');
    }

    if (env.sql.trustServerCertificate) {
      warnings.push('SQL_TRUST_SERVER_CERTIFICATE=true should be reviewed for production');
    }

    if (env.cors.origins.some((origin) => origin.includes('localhost'))) {
      warnings.push('CORS_ORIGINS contains localhost in production');
    }
  }

  if (!env.auth.jwtSecret) {
    warnings.push('JWT access secret is not configured; auth endpoints will fail closed');
  }

  if (!env.auth.refreshSecret) {
    warnings.push('JWT refresh secret is not configured; refresh endpoints will fail closed');
  }


  if (env.nakliyat.enabled && (!env.nakliyat.serviceEmail || !env.nakliyat.servicePassword)) {
    warnings.push('Nakliyat read-only health is enabled, but service credentials are missing; quote operations will fail closed');
  }

  return warnings;
}
