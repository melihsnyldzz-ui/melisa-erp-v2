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
    enabled: false,
  },
  auth: {
    jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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

  return warnings;
}
