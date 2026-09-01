import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checks = [];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const webRoot = resolve(repoRoot, 'apps/web-admin');
const previousFetch = globalThis.fetch;
const previousDemoMode = process.env.VITE_DEMO_MODE;
const previousApiBaseUrl = process.env.VITE_API_BASE_URL;
let externalFetchCount = 0;
let viteServer;

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

process.env.VITE_DEMO_MODE = 'true';
process.env.VITE_API_BASE_URL = 'http://demo-must-not-call.test';
globalThis.fetch = async (input) => {
  externalFetchCount += 1;
  throw new Error(`Sentetik demo dış isteğe çıkmamalı: ${String(input)}`);
};

try {
  const requireFromWeb = createRequire(resolve(webRoot, 'package.json'));
  const viteEntry = requireFromWeb.resolve('vite');
  const { createServer } = await import(pathToFileURL(viteEntry).href);
  viteServer = await createServer({
    root: webRoot,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://demo-must-not-call.test'),
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify('true'),
      'import.meta.env.VITE_LOCAL_PASSWORDLESS_LOGIN': JSON.stringify('false'),
    },
  });

  const productApi = await viteServer.ssrLoadModule('/src/services/productApi.js');
  const productDetailApi = await viteServer.ssrLoadModule('/src/services/productDetailApi.js');
  const customerApi = await viteServer.ssrLoadModule('/src/services/customerApi.js');
  const customerDetailApi = await viteServer.ssrLoadModule('/src/services/customerDetailApi.js');
  const supplierApi = await viteServer.ssrLoadModule('/src/services/supplierApi.js');
  const invoiceDraftApi = await viteServer.ssrLoadModule('/src/services/invoiceDraftApi.js');
  const dashboardApi = await viteServer.ssrLoadModule('/src/services/dashboardApi.js');
  const demoSession = await viteServer.ssrLoadModule('/src/demo/demoSession.js');
  const movementApi = await viteServer.ssrLoadModule('/src/services/movementApi.js');

  const products = await productApi.fetchVegaProducts({ page: 1, limit: 20, activeOnly: true });
  const productDetail = await productDetailApi.fetchProductDetail(101);
  const productWrite = await productDetailApi.updateProduct(101, {});
  const customers = await customerApi.fetchCustomers({ page: 1, limit: 20, activeOnly: false });
  const customerWrite = await customerDetailApi.updateCustomer(202, {});
  const suppliers = await supplierApi.fetchSuppliers({ page: 1, limit: 20, activeOnly: true });
  const salesDraft = await invoiceDraftApi.fetchSalesInvoice(301);
  const salesDraftWrite = await invoiceDraftApi.updateSalesDraft(301, {});
  const purchaseDraft = await invoiceDraftApi.fetchPurchaseInvoice(401);
  const purchaseDraftWrite = await invoiceDraftApi.updatePurchaseDraft(401, {});
  const dashboard = await dashboardApi.fetchDashboardSummary();
  const dashboardAlerts = await dashboardApi.fetchDashboardAlerts();
  const sales = await movementApi.fetchVegaSalesStockExits({ page: 1, limit: 20 });
  const euroSales = await movementApi.fetchVegaSalesStockExits({ page: 1, limit: 20, currency: 'EUR' });
  const purchases = await movementApi.fetchVegaPurchaseInvoices({ page: 1, limit: 20 });
  const tryPurchases = await movementApi.fetchVegaPurchaseInvoices({ page: 1, limit: 20, currency: 'TRY' });
  const salesDetail = await movementApi.fetchVegaCustomerStockExitDocument(sales.data[0].customerSourceId, sales.data[0].sourceId);
  const purchaseDetail = await movementApi.fetchVegaSupplierPurchaseDocument(purchases.data[0].supplierSourceId, purchases.data[0].sourceId);

  addCheck('stock list has at least three local synthetic rows', products.data.length >= 3);
  addCheck('sales list has at least three local synthetic rows', sales.data.length >= 3);
  addCheck('purchase list has at least three local synthetic rows', purchases.data.length >= 3);
  addCheck('all demo responses identify a read-only synthetic source', [products, sales, purchases].every((response) => (
    response.meta?.source === 'synthetic-demo-read-only'
      && response.meta?.synthetic === true
      && response.meta?.readOnly === true
      && response.meta?.writePerformed === false
  )));
  addCheck('synthetic stock records are visibly separated from company codes', products.data.every((row) => row.stockCode.startsWith('DEMO-') && row.productName.startsWith('Sentetik Örnek')));
  addCheck('synthetic invoice ids and numbers are visibly marked', [...sales.data, ...purchases.data].every((row) => String(row.id).startsWith('DEMO-') && row.documentNo.startsWith('SENTETIK-')));
  addCheck('sales currency filter works locally', euroSales.data.length === 1 && euroSales.data[0].currency === 'EUR');
  addCheck('purchase currency filter works locally', tryPurchases.data.length === 1 && tryPurchases.data[0].currency === 'TRY');
  addCheck('selected synthetic sales document includes matching local lines', salesDetail.data?.sourceId === sales.data[0].sourceId && salesDetail.data?.lines?.length > 0);
  addCheck('selected synthetic purchase document includes matching local lines', purchaseDetail.data?.sourceId === purchases.data[0].sourceId && purchaseDetail.data?.lines?.length > 0);
  const activeDemoText = JSON.stringify({
    productDetail,
    customers,
    suppliers,
    salesDraft,
    purchaseDraft,
    dashboard,
    dashboardAlerts,
    demoUser: demoSession.demoUser,
  });
  addCheck('active demo samples use clear Turkish business text', ![
    'Zibin',
    'Takimi',
    'Parca',
    'Yenidogan',
    'Uretim',
    'Kiz Bebek',
    'Gurcistan',
    'Sirbistan',
    'Dusuk stok',
    'Demo renk karisik',
    'Demo alim',
    'average cost',
    '%52si',
    '11.2M TRY',
    'Wear C risk',
    'Demo Admin',
  ].some((fragment) => activeDemoText.includes(fragment)));
  addCheck('demo write messages clearly state that real records stay unchanged', [
    productWrite,
    customerWrite,
    salesDraftWrite,
    purchaseDraftWrite,
  ].every((response) => response.message?.includes('Demo işlemi kaydedilmedi') && response.message.includes('gerçek') && response.message.includes('değiştirilmedi')));
  addCheck('active demo business identifiers remain stable', productDetail.data.stockCode === 'STK-100245'
    && customers.data.some((row) => row.customerCode === 'CR-RO-001')
    && suppliers.data.some((row) => row.supplierCode === 'SUP-DEMO-501')
    && salesDraft.data.documentNo === 'SF-DEMO-0301'
    && purchaseDraft.data.documentNo === 'AF-DEMO-0401');
  addCheck('demo permission ids remain stable behind a Turkish user label', demoSession.demoUser.displayName === 'Demo Yöneticisi'
    && ['dashboard.view', 'sales.finalize', 'purchase.cancel', 'audit.view'].every((permission) => demoSession.demoPermissions.includes(permission)));
  addCheck('dashboard demo warnings use readable business language', dashboardAlerts.data.some((row) => row.subject.includes("%52'sini oluşturuyor"))
    && dashboardAlerts.data.some((row) => row.subject.includes('11,2 milyon TRY'))
    && dashboardAlerts.data.some((row) => row.subject.includes('C risk düzeyi')));
  addCheck('demo services perform zero external fetches', externalFetchCount === 0);

  const stockScreen = readFileSync(resolve(webRoot, 'src/modules/stock/StockListScreen.jsx'), 'utf8');
  const salesScreen = readFileSync(resolve(webRoot, 'src/modules/sales/VegaSalesInvoiceListScreen.jsx'), 'utf8');
  const purchaseScreen = readFileSync(resolve(webRoot, 'src/modules/purchase/VegaPurchaseInvoiceListScreen.jsx'), 'utf8');
  const productApiSource = readFileSync(resolve(webRoot, 'src/services/productApi.js'), 'utf8');
  const movementApiSource = readFileSync(resolve(webRoot, 'src/services/movementApi.js'), 'utf8');

  addCheck('all three screens show an explicit synthetic demo warning', [stockScreen, salesScreen, purchaseScreen].every((source) => source.includes('SENTETİK DEMO') && source.includes('şirket verisi değildir')));
  addCheck('synthetic stock remains read only', stockScreen.includes('const isReadOnlySource = isLiveVega || isSyntheticDemo') && stockScreen.includes('canBulkEdit = permissions.includes(\'product.edit\') && !isReadOnlySource'));
  addCheck('live Vega paths remain behind the unchanged non-demo branch', productApiSource.includes("return get('/api/vega/products'")
    && movementApiSource.includes("return get('/api/vega/sales/stock-exits'")
    && movementApiSource.includes("return get('/api/vega/purchases/invoices'"));
} finally {
  await viteServer?.close();
  globalThis.fetch = previousFetch;
  if (previousDemoMode === undefined) delete process.env.VITE_DEMO_MODE;
  else process.env.VITE_DEMO_MODE = previousDemoMode;
  if (previousApiBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = previousApiBaseUrl;
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Synthetic Demo / ${check.name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
