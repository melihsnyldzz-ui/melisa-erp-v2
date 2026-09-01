import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.MELISA_P14_FIXTURE_PORT || 5197);
const requests = [];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function makeRows(kind, count) {
  const statuses = kind === 'offer'
    ? ['DRAFT', 'SENT', 'ACCEPTED', 'CANCELLED']
    : ['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED'];

  return Array.from({ length: count }, (_, index) => ({
    id: (kind === 'offer' ? 1400 : 2400) + index + 1,
    documentNo: `${kind === 'offer' ? 'TEK' : 'SIP'}-SENTETIK-${String(index + 1).padStart(3, '0')}`,
    documentDate: '2026-08-31',
    customerId: 500 + index,
    customerName: `Sentetik Avrupa Cari ${index + 1}`,
    status: statuses[index % statuses.length],
    documentCurrency: 'EUR',
    grandTotal: 1200 + index,
    amountTry: (1200 + index) * 48,
    itemCount: (index % 6) + 1,
  }));
}

function listPayload(kind, search) {
  const count = search === 'empty' ? 0 : search === 'partial' ? 100 : 4;
  const total = search === 'partial' ? 104 : count;
  const data = makeRows(kind, count);
  const meta = {
    page: 1,
    limit: 100,
    total,
    totalPages: Math.max(1, Math.ceil(total / 100)),
    hasNextPage: total > 100,
    hasPreviousPage: false,
    maxLimit: 100,
    source: 'synthetic-read-only',
    filters: { search },
  };

  if (search === 'brokenmeta') delete meta.total;
  return { success: true, data, meta };
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  requests.push({ method: request.method, path: url.pathname, search: url.search, at: new Date().toISOString() });

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { success: false, error: { code: 'SYNTHETIC_WRITE_BLOCKED', message: 'Sentetik fixture yalnız GET kabul eder.' } });
    return;
  }

  if (url.pathname === '/__audit') {
    const commercialWrites = requests.filter((entry) => (
      !['GET', 'OPTIONS'].includes(entry.method)
      && !entry.path.startsWith('/__')
    ));
    sendJson(response, 200, { requests, commercialWrites, commercialWriteCount: commercialWrites.length });
    return;
  }

  if (url.pathname === '/api/auth/me') {
    sendJson(response, 200, {
      success: true,
      data: {
        id: 'synthetic-sales-viewer',
        username: 'sentetik.satis',
        displayName: 'Sentetik Satış Görüntüleyici',
        role: { id: 1, code: 'synthetic-viewer', name: 'Sentetik Görüntüleyici' },
        permissions: ['sales.view'],
      },
      meta: { source: 'synthetic-auth' },
    });
    return;
  }

  const kind = url.pathname === '/api/sales-offers'
    ? 'offer'
    : url.pathname === '/api/sales-orders'
      ? 'order'
      : '';
  if (!kind) {
    sendJson(response, 404, { success: false, error: { code: 'SYNTHETIC_ROUTE_MISSING', message: 'Sentetik rota yok.' } });
    return;
  }

  const search = url.searchParams.get('search') || '';
  if (search === 'error') {
    sendJson(response, 503, { success: false, error: { code: 'SALES_PIPELINE_LIST_FAILED', message: 'Sentetik liste hatası' } });
    return;
  }

  const delayMs = search === 'slow' ? 1500 : 0;
  setTimeout(() => sendJson(response, 200, listPayload(kind, search)), delayMs);
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ status: 'READY', host, port, mode: 'SYNTHETIC_GET_ONLY' }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
