import { Router } from 'express';
import { env } from '../config/env.js';
import { requireBionicReadOnly } from '../middleware/bionicReadOnlyAuth.js';
import {
  describeBionicTable,
  executeBionicReadOnlyQuery,
  getBionicSqlHealth,
  getBionicStockByCode,
  getBionicStockCodeCount,
  listBionicStockCodes,
  listBionicTables,
} from '../services/bionicReadOnlySqlService.js';

export const bionicReadOnlyRoutes = Router();

bionicReadOnlyRoutes.get('/bionic/openapi.json', (_req, res) => {
  const baseUrl = env.bionicReadOnly.publicBaseUrl.replace(/\/$/, '');
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Melisa ERP Read-Only Analytics',
      version: '1.1.0',
      description: 'Read-only SQL Server integration for bounded analytics and stock lookup. No write path is exposed.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        BionicReadKey: { type: 'apiKey', in: 'header', name: 'x-bionic-read-key' },
      },
      schemas: {
        QueryRequest: {
          type: 'object',
          required: ['sql'],
          properties: {
            sql: { type: 'string', description: 'One read-only SELECT or WITH...SELECT statement. No comments or multiple statements.' },
          },
        },
      },
    },
    security: [{ BionicReadKey: [] }],
    paths: {
      '/bionic/health': {
        get: {
          operationId: 'erp_readonly_health',
          summary: 'Check read-only ERP SQL availability',
          responses: { 200: { description: 'SQL is available' } },
        },
      },
      '/bionic/stock-codes/count': {
        get: {
          operationId: 'erp_stock_code_count',
          summary: 'Count distinct non-deleted ERP stock codes',
          responses: { 200: { description: 'Stock code count' } },
        },
      },
      '/bionic/stock-codes': {
        get: {
          operationId: 'erp_list_stock_codes',
          summary: 'List bounded ERP stock cards',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: env.bionicReadOnly.maxRows } },
          ],
          responses: { 200: { description: 'Stock cards' } },
        },
      },
      '/bionic/stock-codes/{stockCode}': {
        get: {
          operationId: 'erp_get_stock_by_code',
          summary: 'Get one ERP stock card with barcodes and images',
          parameters: [
            { name: 'stockCode', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Stock card' }, 404: { description: 'Stock code not found' } },
        },
      },
      '/bionic/tables': {
        get: {
          operationId: 'erp_list_tables',
          summary: 'List visible SQL tables and views before querying',
          parameters: [
            { name: 'schema', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: env.bionicReadOnly.maxTables } },
          ],
          responses: { 200: { description: 'Visible tables and views' } },
        },
      },
      '/bionic/tables/{schema}/{table}': {
        get: {
          operationId: 'erp_describe_table',
          summary: 'Describe columns for one SQL table or view',
          parameters: [
            { name: 'schema', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'table', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Column metadata' } },
        },
      },
      '/bionic/query': {
        post: {
          operationId: 'erp_execute_readonly_sql',
          summary: 'Execute one bounded read-only SELECT or CTE query',
          description: `Hard limited to ${env.bionicReadOnly.maxRows} rows and ${env.bionicReadOnly.queryTimeoutMs} ms. Write and unsafe SQL keywords are blocked.`,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/QueryRequest' } } },
          },
          responses: {
            200: { description: 'Query result' },
            400: { description: 'Unsafe or invalid SQL' },
          },
        },
      },
    },
  });
});

bionicReadOnlyRoutes.use('/bionic', requireBionicReadOnly);

bionicReadOnlyRoutes.get('/bionic/health', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getBionicSqlHealth(), meta: { readOnly: true } });
  } catch (error) {
    next(error);
  }
});

bionicReadOnlyRoutes.get('/bionic/stock-codes/count', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getBionicStockCodeCount(), meta: { readOnly: true } });
  } catch (error) {
    next(error);
  }
});

bionicReadOnlyRoutes.get('/bionic/stock-codes', async (req, res, next) => {
  try {
    const data = await listBionicStockCodes(req.query);
    res.json({ success: true, data, meta: { readOnly: true, count: data.length } });
  } catch (error) {
    next(error);
  }
});

bionicReadOnlyRoutes.get('/bionic/stock-codes/:stockCode', async (req, res, next) => {
  try {
    const data = await getBionicStockByCode(req.params.stockCode);
    if (!data) {
      return res.status(404).json({ success: false, error: { code: 'STOCK_CODE_NOT_FOUND', message: 'Stock code was not found' } });
    }
    return res.json({ success: true, data, meta: { readOnly: true } });
  } catch (error) {
    if (error?.code === 'INVALID_STOCK_CODE') {
      return res.status(400).json({ success: false, error: { code: error.code, message: error.message } });
    }
    return next(error);
  }
});

bionicReadOnlyRoutes.get('/bionic/tables', async (req, res, next) => {
  try {
    const data = await listBionicTables(req.query);
    res.json({ success: true, data, meta: { readOnly: true, count: data.length } });
  } catch (error) {
    next(error);
  }
});

bionicReadOnlyRoutes.get('/bionic/tables/:schema/:table', async (req, res, next) => {
  try {
    const data = await describeBionicTable(req.params.schema, req.params.table);
    res.json({ success: true, data, meta: { readOnly: true } });
  } catch (error) {
    if (error?.code === 'INVALID_IDENTIFIER') {
      return res.status(400).json({ success: false, error: { code: error.code, message: error.message } });
    }
    next(error);
  }
});

bionicReadOnlyRoutes.post('/bionic/query', async (req, res, next) => {
  try {
    const data = await executeBionicReadOnlyQuery(req.body?.sql);
    res.json({ success: true, data, meta: { readOnly: true } });
  } catch (error) {
    if (String(error?.code || '').startsWith('SQL_') || [
      'ONLY_SELECT_OR_CTE_ALLOWED',
      'MULTI_STATEMENT_SQL_NOT_ALLOWED',
      'WRITE_OR_UNSAFE_SQL_BLOCKED',
    ].includes(error?.code)) {
      return res.status(400).json({ success: false, error: { code: error.code, message: 'Read-only SQL policy blocked the query' } });
    }
    next(error);
  }
});
