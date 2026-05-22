import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.API_PORT || process.env.PORT || 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v0.1.0',
  sql: {
    enabled: Boolean(process.env.SQL_SERVER && process.env.SQL_DATABASE && process.env.SQL_USER && process.env.SQL_PASSWORD),
    server: process.env.SQL_SERVER || '',
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
    database: process.env.SQL_DATABASE || '',
    user: process.env.SQL_USER || '',
    password: process.env.SQL_PASSWORD || '',
    encrypt: String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
    readOnly: String(process.env.SQL_READ_ONLY || 'true').toLowerCase() !== 'false',
  },
  vega: {
    enabled: false,
  },
};
