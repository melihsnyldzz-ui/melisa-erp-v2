// Keep the remote Vega pool pinned to the network (tedious) driver. The local
// ERP database uses msnodesqlv8/Windows authentication in the same process.
import sql from 'mssql/tedious.js';
import { networkInterfaces } from 'node:os';
import { env } from './env.js';

let vegaPoolPromise;

function ipv4Number(value) {
  const parts = String(value || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((result, part) => ((result << 8) | part) >>> 0, 0);
}

function resolveVegaLocalAddress() {
  if (env.vega.localAddress) return env.vega.localAddress;
  const serverAddress = ipv4Number(env.vega.server);
  if (serverAddress === null) return undefined;

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const localAddress = ipv4Number(entry.address);
      const netmask = ipv4Number(entry.netmask);
      if (localAddress !== null && netmask !== null && (localAddress & netmask) === (serverAddress & netmask)) {
        return entry.address;
      }
    }
  }
  return undefined;
}

function vegaConfigurationError(message, code = 'VEGA_NOT_CONFIGURED') {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 503;
  return error;
}

export function getVegaSqlConfig() {
  if (!env.vega.enabled) {
    throw vegaConfigurationError('Vega read-only connection is not configured');
  }

  if (env.vega.database !== 'VEGA2026') {
    throw vegaConfigurationError('Vega connection target must be VEGA2026', 'VEGA_TARGET_INVALID');
  }

  const localAddress = resolveVegaLocalAddress();

  return {
    server: env.vega.server,
    port: env.vega.port,
    database: env.vega.database,
    user: env.vega.user,
    password: env.vega.password,
    options: {
      encrypt: env.vega.encrypt,
      trustServerCertificate: env.vega.trustServerCertificate,
      readOnlyIntent: true,
      ...(localAddress ? { localAddress } : {}),
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 15000,
    connectionTimeout: 10000,
  };
}

export async function getVegaSqlPool() {
  if (!vegaPoolPromise) {
    const pool = new sql.ConnectionPool(getVegaSqlConfig());
    vegaPoolPromise = pool.connect().catch((error) => {
      vegaPoolPromise = undefined;
      throw error;
    });
  }

  return vegaPoolPromise;
}

export async function closeVegaSqlPool() {
  if (vegaPoolPromise) {
    const pool = await vegaPoolPromise;
    vegaPoolPromise = undefined;
    await pool.close();
  }
}
