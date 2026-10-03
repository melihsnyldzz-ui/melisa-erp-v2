import express from 'express';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';

const host = process.env.MELISA_MCP_HOST || '127.0.0.1';
const port = Number(process.env.MELISA_MCP_PORT || 4113);
const gatewayBaseUrl = String(process.env.MELISA_MCP_GATEWAY_URL || 'http://127.0.0.1:4112').replace(/\/$/, '');
const gatewayKey = process.env.EXTERNAL_READ_ONLY_API_KEY || '';

if (!gatewayKey) {
  throw new Error('EXTERNAL_READ_ONLY_API_KEY is required for the MCP bridge');
}

async function gatewayGet(pathname, query = {}) {
  const url = new URL(`${gatewayBaseUrl}${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-melisa-read-key': gatewayKey,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Gateway request failed with HTTP ${response.status}`);
    error.code = payload?.error?.code || 'GATEWAY_REQUEST_FAILED';
    throw error;
  }
  return payload?.data ?? payload;
}

function asToolResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function createServer() {
  const server = new McpServer(
    { name: 'melisa-erp-readonly', version: '1.0.0' },
    {
      instructions: [
        'This server is read-only.',
        'Use Vega as the stock source.',
        'Never claim to modify stock, prices, customers, sales, or ERP data.',
        'Prefer get_stock for exact stock-code questions and search_stock for product discovery.',
      ].join(' '),
    },
  );

  server.registerTool(
    'stock_count',
    {
      description: 'Read the current Vega stock-code totals, including active stock-card count.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => asToolResult(await gatewayGet('/stock-codes/count', { source: 'vega' })),
  );

  server.registerTool(
    'search_stock',
    {
      description: 'Search current Vega stock cards by stock code or product text. Returns a bounded list only.',
      inputSchema: z.object({
        search: z.string().trim().max(120).optional().describe('Stock code, brand, category, or product search text'),
        limit: z.number().int().min(1).max(50).default(20).describe('Maximum results, up to 50'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ search, limit }) => asToolResult(await gatewayGet('/stock-codes', { source: 'vega', search, limit })),
  );

  server.registerTool(
    'get_stock',
    {
      description: 'Read one current Vega stock card by exact stock code, including available stock, price, barcodes and other verified fields.',
      inputSchema: z.object({
        stockCode: z.string().trim().min(1).max(120).describe('Exact Vega stock code, for example 4677 MİOMİNİ'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ stockCode }) => asToolResult(await gatewayGet(`/stock-codes/${encodeURIComponent(stockCode)}`, { source: 'vega' })),
  );

  return server;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

const handler = createMcpHandler(createServer);
app.all('/mcp', toNodeHandler(handler));

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'melisa-erp-readonly-mcp', readOnly: true });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' } });
});

const httpServer = app.listen(port, host, () => {
  console.log(`[melisa-erp-readonly-mcp] listening on http://${host}:${port}/mcp`);
  console.log('[melisa-erp-readonly-mcp] tools: stock_count, search_stock, get_stock');
});

function shutdown(signal) {
  console.log(`[melisa-erp-readonly-mcp] ${signal} received`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
