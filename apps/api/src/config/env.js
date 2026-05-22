import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export const env = {
  port: Number(process.env.API_PORT || process.env.PORT || 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v0.1.0',
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
