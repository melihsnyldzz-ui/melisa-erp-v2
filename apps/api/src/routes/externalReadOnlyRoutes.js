import { Router } from 'express';
import { requireExternalReadOnly } from '../middleware/externalReadOnlyAuth.js';
import {
  countVegaStockCodes,
  getVegaReadOnlyHealth,
  getVegaStockByCode,
  listVegaStockCodes,
} from '../services/vegaReadOnlyStockService.js';

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
      title: 'Melisa ERP External Read-Only Vega Stock Gateway',
      version: '1.1.0',
      description: 'Whitelist-only live Vega stock-card access. No generic SQL, schema discovery, write, admin, CRM, finance, or messaging endpoints are exposed.',
    },
    servers: [{ url: publicBaseUrl() }],
    components: {
      securitySchemes: {
        MelisaReadKey: { type: 'apiKey', in: 'header', name: 'x-melisa-read-key' },
      },
    },
    security: [{ MelisaReadKey: [] }],
    paths: {
      '/health': { get: { operationId: 'melisa_vega_stock_health', summary: 'Check live Vega read-only stock health', responses: { 200: { description: 'Gateway is healthy' } } } },
      '/stock-codes/count': { get: { operationId: 'melisa_vega_stock_code_count', summary: 'Count live Vega stock codes', responses: { 200: { description: 'Stock-code counts' } } } },
      '/stock-codes': {
        get: {
          operationId: 'melisa_vega_list_stock_codes',
          summary: 'List bounded live Vega stock cards',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: maxRows() } },
          ],
          responses: { 200: { description: 'Stock cards' } },
        },
      },
      '/stock-codes/{stockCode}': {
        get: {
          operationId: 'melisa_vega_get_stock_by_code',
          summary: 'Get one live Vega stock card',
          parameters: [{ name: 'stockCode', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Stock card' }, 404: { description: 'Stock code not found' } },
        },
      },
    },
  });
});

externalReadOnlyRoutes.use(requireExternalReadOnly);

externalReadOnlyRoutes.get('/health', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getVegaReadOnlyHealth(), meta: { readOnly: true, source: 'vega' } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes/count', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await countVegaStockCodes(), meta: { readOnly: true, source: 'vega' } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes', async (req, res, next) => {
  try {
    const limit = Math.min(maxRows(), Math.max(1, Number(req.query.limit) || 50));
    const data = await listVegaStockCodes({ search: req.query.search, limit });
    res.json({ success: true, data, meta: { readOnly: true, source: 'vega', count: data.length } });
  } catch (error) {
    next(error);
  }
});

externalReadOnlyRoutes.get('/stock-codes/:stockCode', async (req, res, next) => {
  try {
    const data = await getVegaStockByCode(req.params.stockCode);
    if (!data) return res.status(404).json({ success: false, error: { code: 'STOCK_CODE_NOT_FOUND', message: 'Stock code was not found' } });
    return res.json({ success: true, data, meta: { readOnly: true, source: 'vega' } });
  } catch (error) {
    if (error?.code === 'INVALID_STOCK_CODE') {
      return res.status(400).json({ success: false, error: { code: error.code, message: error.message } });
    }
    return next(error);
  }
});
