import { Router } from 'express';
import { requireExternalReadOnly } from '../middleware/externalReadOnlyAuth.js';
import {
  getBionicSqlHealth,
  getBionicStockByCode,
  getBionicStockCodeCount,
  listBionicStockCodes,
} from '../services/bionicReadOnlySqlService.js';

export const externalReadOnlyRoutes = Router();

function maxRows() {
  const parsed = Number(process.env.EXTERNAL_READ_ONLY_MAX_ROWS || 100);
  return Math.min(250, Math.max(1, Number.isFinite(parsed) ? parsed : 100));
}

function publicBaseUrl() {
  return String(process.env.EXTERNAL_READ_ONLY_PUBLIC_BASE_URL || 'https://replace-me.example.com').replace(/\/$/, '');
}

externalReadOnlyRoutes.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Melisa ERP External Read-Only Stock Gateway',
      version: '1.0.0',
      description: 'Whitelist-only stock access. No generic SQL, schema discovery, write, admin, auth, CRM, finance, or messaging endpoints are exposed by this gateway.',
    },
    servers: [{ url: publicBaseUrl() }],
    components: {
      securitySchemes: {
        MelisaReadKey: { type: 'apiKey', in: 'header', name: 'x-melisa-read-key' },
      },
    },
    security: [{ MelisaReadKey: [] }],
    paths: {
      '/health': {
        get: {
          operationId: 'melisa_stock_gateway_health',
          summary: 'Check read-only stock gateway health',
          responses: { 200: { description: 'Gateway is healthy' } },
        },
      },
      '/stock-codes/count': {
        get: {
          operationId: 'melisa_stock_code_count',
          summary: 'Count stock codes from the configured read-only stock source',
          parameters: [
            { name: 'source', in: 'query', schema: { type: 'string', enum: ['vega', 'melisa'], default: 'vega' } },
          ],
          responses: { 200: { description: 'Stock-code counts' } },
        },
      },
      '/stock-codes': {
        get: {
          operationId: 'melisa_list_stock_codes',
          summary: 'List bounded stock cards',
          parameters: [
            { name: 'source', in: 'query', schema: { type: 'string', enum: ['vega', 'melisa'], default: 'vega' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: maxRows() } },
          ],
          responses: { 200: { description: 'Stock cards' } },
        },
      },
      '/stock-codes/{stockCode}': {
        get: {
          operationId: 'melisa_get_stock_by_code',
          summary: 'Get one stock card',
          parameters: [
            { name: 'stockCode', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'source', in: 'query', schema: { type: 'string', enum: ['vega', 'melisa'], default: 'vega' } },
          ],
          responses: { 200: { description: 'Stock card' }, 404: { description: 'Stock code not found' } },
        },
      },
    },
  });
});

externalReadOnlyRoutes.use(requireExternalReadOnly);

function sourceOf(req) {
  const value = String(req.query?.source || 'vega').trim().toLowerCase();
  return value === 'melisa' ? 'melisa' : 'vega';
}

externalReadOnlyRoutes.get('/health', async (_req, res, next) => {
  try {
    const health = await getBionicSqlHealth();
    res.json({ success: true, data: health, meta: { readOnly: true, gateway: 'external-stock-only' } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes/count', async (req, res, next) => {
  try {
    const source = sourceOf(req);
    const data = await getBionicStockCodeCount({ source });
    res.json({ success: true, data, meta: { readOnly: true, source } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes', async (req, res, next) => {
  try {
    const source = sourceOf(req);
    const limit = Math.min(maxRows(), Math.max(1, Number(req.query.limit) || 50));
    const data = await listBionicStockCodes({ search: req.query.search, limit, source });
    res.json({ success: true, data, meta: { readOnly: true, source, count: data.length } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes/:stockCode', async (req, res, next) => {
  try {
    const source = sourceOf(req);
    const data = await getBionicStockByCode(req.params.stockCode, { source });
    if (!data) {
      return res.status(404).json({ success: false, error: { code: 'STOCK_CODE_NOT_FOUND', message: 'Stock code was not found' } });
    }
    return res.json({ success: true, data, meta: { readOnly: true, source } });
  } catch (error) {
    if (error?.code === 'INVALID_STOCK_CODE') {
      return res.status(400).json({ success: false, error: { code: error.code, message: error.message } });
    }
    return next(error);
  }
});
