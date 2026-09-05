import express from 'express';
import crypto from 'node:crypto';
import {
  countVegaStockCodes,
  getVegaReadOnlyHealth,
  getVegaStockByCode,
  listVegaStockCodes,
} from './services/vegaReadOnlyStockService.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

const host = process.env.MCP_READ_ONLY_HOST || '127.0.0.1';
const port = Math.max(1, Number(process.env.MCP_READ_ONLY_PORT || 4113));
const optionalToken = String(process.env.MCP_READ_ONLY_TOKEN || '');
const maxRows = Math.min(100, Math.max(1, Number(process.env.MCP_READ_ONLY_MAX_ROWS || 50)));

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireOptionalToken(req, res, next) {
  if (!optionalToken) return next();
  const authorization = String(req.get('authorization') || '');
  const provided = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!secureEqual(provided, optionalToken)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

const tools = [
  {
    name: 'get_stock_count',
    title: 'Get Vega stock-code count',
    description: 'Count distinct live stock codes in the configured Vega stock-card table. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'search_products',
    title: 'Search Vega products',
    description: 'Search live Vega stock cards by stock code or product name. Returns a bounded list. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional stock-code or product-name search text.' },
        limit: { type: 'integer', minimum: 1, maximum: maxRows, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_product',
    title: 'Get Vega product',
    description: 'Get one live Vega stock card by exact stock code. Read-only.',
    inputSchema: {
      type: 'object',
      required: ['stockCode'],
      properties: { stockCode: { type: 'string', minLength: 1, maxLength: 120 } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'erp_readonly_health',
    title: 'Check Vega read-only health',
    description: 'Verify that the MCP can reach the configured Vega read-only database and stock-card table.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

async function callTool(name, args = {}) {
  if (name === 'get_stock_count') return countVegaStockCodes();
  if (name === 'search_products') {
    const limit = Math.min(maxRows, Math.max(1, Number(args.limit) || 20));
    return listVegaStockCodes({ search: args.query, limit });
  }
  if (name === 'get_product') {
    const product = await getVegaStockByCode(args.stockCode);
    if (!product) {
      const error = new Error('Stock code was not found');
      error.code = 'STOCK_CODE_NOT_FOUND';
      throw error;
    }
    return product;
  }
  if (name === 'erp_readonly_health') return getVegaReadOnlyHealth();
  const error = new Error('Unknown tool');
  error.code = 'UNKNOWN_TOOL';
  throw error;
}

app.get('/health', requireOptionalToken, async (_req, res) => {
  try {
    res.json({ ok: true, service: 'melisa-erp-readonly-mcp', data: await getVegaReadOnlyHealth() });
  } catch (error) {
    res.status(503).json({ ok: false, service: 'melisa-erp-readonly-mcp', error: error?.code || 'VEGA_UNAVAILABLE' });
  }
});

app.options('/mcp', (_req, res) => {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.status(204).end();
});

app.get('/mcp', requireOptionalToken, (_req, res) => {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.status(405).json({ error: 'Use POST for MCP Streamable HTTP requests' });
});

app.post('/mcp', requireOptionalToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const message = req.body;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return res.status(400).json(jsonRpcError(message?.id, -32600, 'Invalid Request'));
  }

  const id = message.id;
  try {
    if (message.method === 'initialize') {
      const requestedVersion = String(message.params?.protocolVersion || '2025-03-26');
      return res.json(jsonRpcResult(id, {
        protocolVersion: requestedVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'melisa-erp-readonly', version: '1.0.0' },
        instructions: 'Read-only Melisa Baby ERP/Vega stock access. Never claim a write capability. Live commercial truth comes from returned tool data.',
      }));
    }

    if (message.method === 'notifications/initialized' || message.method.startsWith('notifications/')) {
      return res.status(202).end();
    }

    if (message.method === 'ping') return res.json(jsonRpcResult(id, {}));
    if (message.method === 'tools/list') return res.json(jsonRpcResult(id, { tools }));

    if (message.method === 'tools/call') {
      const name = String(message.params?.name || '');
      const args = message.params?.arguments && typeof message.params.arguments === 'object' ? message.params.arguments : {};
      try {
        const data = await callTool(name, args);
        const text = JSON.stringify(data, null, 2);
        return res.json(jsonRpcResult(id, {
          content: [{ type: 'text', text }],
          structuredContent: data,
          isError: false,
        }));
      } catch (error) {
        const publicError = { code: error?.code || 'TOOL_FAILED', message: error?.code === 'STOCK_CODE_NOT_FOUND' ? 'Stock code was not found' : 'Read-only tool failed' };
        return res.json(jsonRpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(publicError) }],
          structuredContent: publicError,
          isError: true,
        }));
      }
    }

    return res.status(404).json(jsonRpcError(id, -32601, 'Method not found'));
  } catch (error) {
    console.error('[melisa-erp-readonly-mcp]', error?.code || error?.message || error);
    return res.status(500).json(jsonRpcError(id, -32603, 'Internal error'));
  }
});

app.use((_req, res) => res.status(404).json({ error: 'route_not_found' }));

const server = app.listen(port, host, () => {
  console.log(`[melisa-erp-readonly-mcp] listening on http://${host}:${port}/mcp`);
  console.log(`[melisa-erp-readonly-mcp] tools=${tools.map((tool) => tool.name).join(',')}; token=${optionalToken ? 'configured' : 'not-configured'}; read-only=true`);
});

function shutdown(signal) {
  console.log(`[melisa-erp-readonly-mcp] ${signal} received`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
