import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const safetyModulePath = resolve(repoRoot, 'apps/web-admin/src/modules/stock/stockCountSafety.js');
const {
  canApplyStockCount,
  isValidCountedQuantity,
  isValidStockCountReason,
} = await import(pathToFileURL(safetyModulePath).href);

const stockScreen = read('apps/web-admin/src/modules/stock/StockCountScreen.jsx');
const stockStyles = read('apps/web-admin/src/styles/stock-count.css');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const main = read('apps/web-admin/src/main.jsx');
const movementApi = read('apps/web-admin/src/services/movementApi.js');
const movementRoutes = read('apps/api/src/routes/movementRoutes.js');
const movementService = read('apps/api/src/services/movementService.js');
const permissionArchitecture = read('docs/erp-v2/auth-permission-architecture.md');

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return start >= 0 && end > start ? source.slice(start, end) : '';
}

function inOrder(source, markers) {
  let cursor = -1;
  return markers.every((marker) => {
    const next = source.indexOf(marker, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
}

const routeBlock = sourceSlice(workspace, "'stock-count': {", "'bulk-product-create': {");
const routePermissionKeys = routeBlock
  .match(/permissionKeys:\s*\[([^\]]+)\]/)?.[1]
  ?.match(/'[^']+'/g)
  ?.map((value) => value.slice(1, -1)) || [];
const routeAllows = (permissions) => routePermissionKeys.every((permission) => permissions.includes(permission));
const serviceBlock = sourceSlice(
  movementService,
  'export async function applyStockCountAdjustment',
  'function todaySqlDate',
);

const enabledInput = {
  selectedProduct: { id: 1 },
  countedQuantity: '12.500',
  note: 'Raf sayımı farkı',
  isCountConfirmed: true,
  isApplying: false,
};

const checks = [
  ['quantity accepts zero', isValidCountedQuantity(0)],
  ['quantity accepts a three-decimal value', isValidCountedQuantity('12.500')],
  ['quantity rejects an empty value', !isValidCountedQuantity('')],
  ['quantity rejects whitespace instead of coercing it to zero', !isValidCountedQuantity('   ')],
  ['quantity rejects negative values', !isValidCountedQuantity('-0.001')],
  ['quantity rejects non-numeric values', !isValidCountedQuantity('stok')],
  ['quantity rejects infinity', !isValidCountedQuantity(Infinity)],
  ['reason accepts meaningful text', isValidStockCountReason('Raf sayımı')],
  ['reason rejects whitespace', !isValidStockCountReason('   ')],
  ['apply gate opens only for the complete reviewed state', canApplyStockCount(enabledInput)],
  ['apply gate rejects a missing product', !canApplyStockCount({ ...enabledInput, selectedProduct: null })],
  ['apply gate rejects a missing reason', !canApplyStockCount({ ...enabledInput, note: '' })],
  ['apply gate rejects an unconfirmed count', !canApplyStockCount({ ...enabledInput, isCountConfirmed: false })],
  ['apply gate stays closed while a request is running', !canApplyStockCount({ ...enabledInput, isApplying: true })],
  ['workspace requires product view and explicit stock adjustment together', routeBlock.includes("permissionKeys: ['product.view', 'stock.adjust']") && routeBlock.includes("permissionMode: 'all'")],
  ['workspace permission matrix rejects no permissions', !routeAllows([])],
  ['workspace permission matrix rejects view-only access', !routeAllows(['product.view'])],
  ['workspace permission matrix rejects edit-only access', !routeAllows(['product.edit'])],
  ['workspace permission matrix rejects product view and edit without stock adjustment', !routeAllows(['product.view', 'product.edit'])],
  ['workspace permission matrix accepts view and explicit stock adjustment', routeAllows(['product.view', 'stock.adjust'])],
  ['workspace all-mode is fail-closed for every required permission', workspace.includes("route.permissionKeys.every((permissionKey) => permissions.includes(permissionKey))")],
  ['screen keeps a second submit-time quantity guard', stockScreen.includes('if (!isValidCountedQuantity(countedQuantity))')],
  ['screen keeps a second submit-time reason guard', stockScreen.includes('if (!isValidStockCountReason(note))')],
  ['screen keeps a second submit-time human confirmation guard', stockScreen.includes('if (!isCountConfirmed)')],
  ['screen sends the reviewed current-stock snapshot', stockScreen.includes('expectedCurrentQuantity: selectedProduct.stockQuantity')],
  ['screen requires a reason and a checked review before enabling apply', stockScreen.includes('disabled={!isApplyEnabled}') && stockScreen.includes('!isValidStockCountReason(note)')],
  ['screen resets confirmation after product, quantity, note, success, or failure changes', (stockScreen.match(/setIsCountConfirmed\(false\)/g) || []).length >= 5],
  ['screen labels the action as a real stock change', stockScreen.includes('Gerçek stok değişikliği') && stockScreen.includes('Onayla ve Sayımı Uygula')],
  ['stock count stylesheet is loaded last for targeted overrides', main.lastIndexOf("import './styles/stock-count.css';") > main.lastIndexOf("import './styles/management-reports-ux.css';")],
  ['simple mode restores only the stock count work grid', stockStyles.includes('.simple-mode-shell .stock-count-screen .dashboard-main-grid') && stockStyles.includes('display: grid !important;')],
  ['wide result table is contained by its local horizontal scroller', stockStyles.includes('.stock-count-screen .table-shell') && stockStyles.includes('overflow-x: auto;') && stockStyles.includes('min-width: 760px;')],
  ['stock summaries render as scoped visual cards', stockStyles.includes('.stock-count-screen .summary-card {') && stockStyles.includes('grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));')],
  ['web client keeps the stock adjustment behind an explicit POST helper', movementApi.includes("post('/api/stock-count/adjust', payload)")],
  ['backend route authenticates and requires product view and stock adjustment', movementRoutes.includes("post('/stock-count/adjust', requireAuth, requirePermission('product.view'), requirePermission('stock.adjust'), postStockCountAdjustment)")],
  ['backend rejects missing reason and stale stock snapshots', serviceBlock.includes('STOCK_COUNT_REASON_REQUIRED') && serviceBlock.includes('STOCK_COUNT_STALE') && serviceBlock.includes('expectedCurrentQuantity') && serviceBlock.includes('409')],
  ['backend locks the product before comparing the reviewed snapshot', inOrder(serviceBlock, ['WITH (UPDLOCK, ROWLOCK)', 'currentQuantity !== expectedCurrentQuantity', 'UPDATE dbo.products'])],
  ['write guard and accounting lock precede stock mutation', inOrder(serviceBlock, ['assertMelisaWriteEnabled()', 'await transaction.begin()', 'assertAccountingPeriodOpen', 'UPDATE dbo.products'])],
  ['stock, movement, audit, and commit stay in one transaction', inOrder(serviceBlock, ['UPDATE dbo.products', 'INSERT INTO dbo.stock_movements', 'writeAuditLog(new sqlDriver.Request(transaction)', 'await transaction.commit()'])],
  ['count movement uses the stock_count source supported by the schema', serviceBlock.includes("N'stock_count'") && !serviceBlock.includes("N'adjustment'")],
  ['failure path rolls the transaction back', serviceBlock.includes('await transaction.rollback();')],
  ['audit snapshot includes quantity, difference, movement, and reason', inOrder(serviceBlock, ['stockQuantity: countedQuantity', 'difference', 'movementId', 'note'])],
  ['architecture still identifies stock adjustment as a separate critical permission', permissionArchitecture.includes('`stock.adjust`')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - Stock count safety / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
