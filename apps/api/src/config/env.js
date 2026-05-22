import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4100),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v0.1.0',
  sql: {
    enabled: false,
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || '',
    user: process.env.SQL_USER || '',
  },
  vega: {
    enabled: false,
  },
};
