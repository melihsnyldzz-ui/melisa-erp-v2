// Owner-private Sites entry. Platform identity stays separate from simulated test roles.
import { createApplication } from './application.mjs';
import { createD1Store, createD1Sessions } from './d1-store.mjs';

const stages = new Set(['D1_BINDING', 'D1_TABLES_READ', 'D1_MIGRATION_COLUMNS_READ', 'D1_MIGRATION_SCHEMA', 'D1_TABLE_INVENTORY', 'D1_SCHEMA_REQUIRED', 'D1_STATE_SCHEMA', 'D1_SESSIONS_SCHEMA', 'D1_SEED_INSERT', 'D1_STATE_READ', 'STORE_INITIALIZE', 'SESSIONS_INITIALIZE', 'APPLICATION_REQUEST', 'ASSET_REQUEST']);
const codes = new Set(['INVALID_BINDING', 'FOREIGN_STORE', 'SCHEMA_NOT_READY', 'D1_OPERATION_FAILED', 'STORE_CLOSED', 'STORE_BUSY', 'STORE_CAPACITY']);
export function createWorker(assets = new Map(), { reportError = record => console.error(JSON.stringify(record)) } = {}) {
  return {
    async fetch(request, env) {
      // Hosted access is enforced by Sites; an authenticated visitor is also required here.
      if (!request.headers.get('oai-authenticated-user-id')) return new Response('ChatGPT ile yetkili özel Site erişimi gerekli.', { status: 401 });
      let response, stage = 'ASSET_REQUEST';
      const report = error => {
        const diagnosticId = crypto.randomUUID();
        const record = { event: 'MELISA_CLOUD_TEST_FAILURE', diagnosticId,
          stage: stages.has(error?.cloudStage) ? error.cloudStage : stage, code: codes.has(error?.code) ? error.code : 'UNEXPECTED_FAILURE' };
        const keys = ['application', 'cfCaseVariant', 'sqliteCaseVariant', 'migrationName', 'platformPrefix', 'other'];
        if (record.stage === 'D1_TABLE_INVENTORY' && error?.cloudInventory && keys.every(key => Number.isInteger(error.cloudInventory[key]) && error.cloudInventory[key] >= 0 && error.cloudInventory[key] <= 16)) {
          record.inventory = Object.fromEntries(keys.map(key => [key, error.cloudInventory[key]]));
        }
        const schema = error?.cloudInventorySchema, identifier = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value);
        if (record.stage === 'D1_TABLE_INVENTORY' && ['OBSERVED', 'UNAVAILABLE', 'COLUMN_LIMIT'].includes(schema?.state) && identifier(schema.table) &&
          Array.isArray(schema.columns) && schema.columns.length <= 8 && schema.columns.every(column => identifier(column.name) && typeof column.type === 'string' && /^[A-Z0-9_ (),]{0,32}$/.test(column.type) &&
            typeof column.notNull === 'boolean' && Number.isInteger(column.primaryKey) && column.primaryKey >= 0 && column.primaryKey <= 8)) {
          record.inventorySchema = { state: schema.state, table: schema.table, columns: schema.columns.map(column => ({ name: column.name, type: column.type, notNull: column.notNull, primaryKey: column.primaryKey })) };
        }
        try { reportError(record); } catch { /* Telemetry failure never changes the response. */ }
        return diagnosticId;
      };
      try {
        const path = new URL(request.url).pathname;
        if (path.startsWith('/api/cloud-test/')) {
          stage = 'STORE_INITIALIZE';
          if (!env.DB) throw Object.assign(new Error('Synthetic binding unavailable'), { cloudStage: 'D1_BINDING', code: 'INVALID_BINDING' });
          const store = await createD1Store(env.DB, { schemaManaged: true });
          stage = 'SESSIONS_INITIALIZE';
          const sessions = await createD1Sessions(env.DB, { schemaManaged: true });
          stage = 'APPLICATION_REQUEST';
          response = await createApplication({ store, sessions, onError: report })(request);
        } else if (['GET', 'HEAD'].includes(request.method)) {
          const alias = ({ '/': '/erp/cloud.html', '/erp/': '/erp/cloud.html', '/crm/': '/crm/cloud.html', '/terminal/': '/erp/cloud.html' })[path] ?? path;
          const asset = assets.get(alias);
          response = asset ? new Response(request.method === 'HEAD' ? null : asset.bytes, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-store' } }) : new Response('Synthetic route unavailable', { status: 404 });
        } else response = new Response('Method not allowed', { status: 405 });
      } catch (error) { response = new Response(JSON.stringify({ success: false, error: { code: 'CLOUD_TEST_UNAVAILABLE', message: 'Sentetik TEST ortamı şu anda hazır değil.', diagnosticId: report(error) } }),
        { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'");
      return response;
    },
  };
}
