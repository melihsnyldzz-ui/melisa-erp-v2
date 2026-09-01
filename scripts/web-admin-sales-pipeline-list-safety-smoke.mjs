import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canCreateSalesPipelineDocument,
  requestOpenNewSalesPipelineDocument,
} from '../apps/web-admin/src/modules/sales/salesPipelineListPermissions.js';
import { getSalesPipelineListOutputState } from '../apps/web-admin/src/modules/sales/salesPipelineListSafety.js';
import { kindFromRequest } from '../apps/api/src/controllers/salesPipelineController.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Source block could not be found: ${startMarker}`);
  }
  return source.slice(start, end);
}

const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const listScreen = read('apps/web-admin/src/modules/sales/SalesPipelineListScreen.jsx');
const listPermissions = read('apps/web-admin/src/modules/sales/salesPipelineListPermissions.js');
const pipelineApi = read('apps/web-admin/src/services/salesPipelineApi.js');
const pipelineRoutes = read('apps/api/src/routes/salesPipelineRoutes.js');
const pipelineController = read('apps/api/src/controllers/salesPipelineController.js');
const mainEntry = read('apps/web-admin/src/main.jsx');
const listCss = read('apps/web-admin/src/styles/sales-pipeline-list.css');

const offerListRoute = sourceSlice(workspace, "'sales-offers': {", "'sales-offer': {");
const orderListRoute = sourceSlice(workspace, "'sales-orders': {", "'sales-order': {");
const listApiImport = sourceSlice(listScreen, "import { fetchSalesOffers", "import { exportRowsToExcel");

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}

check('undefined permissions fail closed', !canCreateSalesPipelineDocument());
check('null permissions fail closed', !canCreateSalesPipelineDocument(null));
check('sales.view alone remains read-only', !canCreateSalesPipelineDocument(['sales.view']));
check('sales.edit alone cannot open a new document', !canCreateSalesPipelineDocument(['sales.edit']));
check('sales.create enables new document navigation', canCreateSalesPipelineDocument(['sales.view', 'sales.create']));

let navigationCalls = [];
const denied = requestOpenNewSalesPipelineDocument({
  type: 'offer',
  permissions: ['sales.view'],
  onOpenScreen: (...args) => navigationCalls.push(args),
});
check('unauthorized request does not navigate', !denied.opened && denied.code === 'SALES_CREATE_PERMISSION_REQUIRED' && navigationCalls.length === 0);

const missingNavigation = requestOpenNewSalesPipelineDocument({
  type: 'offer',
  permissions: ['sales.create'],
});
check('missing navigation callback fails closed', !missingNavigation.opened && missingNavigation.code === 'SALES_PIPELINE_NAVIGATION_UNAVAILABLE');

const invalidType = requestOpenNewSalesPipelineDocument({
  type: 'invoice',
  permissions: ['sales.create'],
  onOpenScreen: (...args) => navigationCalls.push(args),
});
check('unknown pipeline type fails closed', !invalidType.opened && invalidType.code === 'SALES_PIPELINE_TYPE_INVALID' && navigationCalls.length === 0);

const offerOpened = requestOpenNewSalesPipelineDocument({
  type: 'offer',
  permissions: ['sales.view', 'sales.create'],
  onOpenScreen: (...args) => navigationCalls.push(args),
});
const orderOpened = requestOpenNewSalesPipelineDocument({
  type: 'order',
  permissions: ['sales.view', 'sales.create'],
  onOpenScreen: (...args) => navigationCalls.push(args),
});
check('authorized offer navigation targets only sales-offer', offerOpened.opened && offerOpened.screenId === 'sales-offer' && navigationCalls[0]?.[0] === 'sales-offer');
check('authorized order navigation targets only sales-order', orderOpened.opened && orderOpened.screenId === 'sales-order' && navigationCalls[1]?.[0] === 'sales-order');

for (const [label, routeBlock, type] of [
  ['offer', offerListRoute, 'offer'],
  ['order', orderListRoute, 'order'],
]) {
  check(`${label} list route requires sales.view`, routeBlock.includes("permissionKeys: ['sales.view']"));
  check(`${label} list route receives workspace permissions`, routeBlock.includes('permissions') && routeBlock.includes('permissions={permissions}'));
  check(`${label} list route keeps the expected screen type`, routeBlock.includes(`type="${type}"`));
}

check('list component defaults missing permissions to read-only', listScreen.includes('permissions = []'));
check('list component derives create capability from the safety helper', listScreen.includes('canCreateSalesPipelineDocument(permissions)'));
check('new button is disabled without create capability', listScreen.includes('disabled={!canCreate}'));
check('new button uses the fail-closed handler', listScreen.includes('onClick={openNewDocument}') && listScreen.includes('requestOpenNewSalesPipelineDocument'));
check('read-only users receive plain business language', listScreen.includes('listesi salt okunur') && listScreen.includes('satış oluşturma yetkisi gerekir'));
check('read-only list remains useful', listScreen.includes('görüntüleyebilir ve süzebilirsiniz'));
check('list UI imports only read operations from pipeline API', listApiImport.includes('fetchSalesOffers') && listApiImport.includes('fetchSalesOrders') && !/create|update|change|convert/i.test(listApiImport));
check('list UI has no direct mutation call', !/createSalesOffer|createSalesOrder|updateSalesOffer|updateSalesOrder|changeSales|convertSales/.test(listScreen));

const completeOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: { total: 1 } });
const partialOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: { total: 2 } });
const missingMetaOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: null });
const invalidMetaOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: { total: 0 } });
const loadingOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: { total: 1 }, isLoading: true });
const errorOutput = getSalesPipelineListOutputState({ rows: [{ id: 1 }], meta: { total: 1 }, errorMessage: 'Sentetik hata' });
check('verified complete list enables output', completeOutput.canUseOutput && completeOutput.isCompleteList && completeOutput.hasValidTotal);
check('verified partial list disables output', !partialOutput.canUseOutput && partialOutput.hasPartialList);
check('missing total metadata fails closed', !missingMetaOutput.canUseOutput && !missingMetaOutput.hasValidTotal);
check('total smaller than rendered rows fails closed', !invalidMetaOutput.canUseOutput && !invalidMetaOutput.hasValidTotal);
check('loading list disables output', !loadingOutput.canUseOutput);
check('error list disables output', !errorOutput.canUseOutput);

check('offer list API uses GET', pipelineApi.includes("return get('/api/sales-offers', params);"));
check('order list API uses GET', pipelineApi.includes("return get('/api/sales-orders', params);"));
check('offer GET route requires sales.view', pipelineRoutes.includes("salesOfferRoutes.get('/sales-offers', requireAuth, requirePermission('sales.view')"));
check('order GET route requires sales.view', pipelineRoutes.includes("salesOrderRoutes.get('/sales-orders', requireAuth, requirePermission('sales.view')"));
check('create routes remain server-protected by sales.create', pipelineRoutes.includes("salesOfferRoutes.post('/sales-offers', requireAuth, requirePermission('sales.create')") && pipelineRoutes.includes("salesOrderRoutes.post('/sales-orders', requireAuth, requirePermission('sales.create')"));
check('update and status routes remain server-protected by sales.edit', (pipelineRoutes.match(/requirePermission\('sales\.edit'\)/g) || []).length >= 4);
check('permission helper names only the existing sales.create permission', listPermissions.includes("permissions.includes('sales.create')") && !listPermissions.includes('sales.finalize'));

check('offer kind ignores a sales-orders search query', kindFromRequest({ baseUrl: '/api', path: '/sales-offers', originalUrl: '/api/sales-offers?search=sales-orders' }) === 'offer');
check('order kind ignores a sales-offers search query', kindFromRequest({ baseUrl: '/api', path: '/sales-orders', originalUrl: '/api/sales-orders?search=sales-offers' }) === 'order');
check('unknown pipeline route fails closed', kindFromRequest({ baseUrl: '/api', path: '/unknown', originalUrl: '/api/unknown?sales-orders' }) === '');
check('controller kind selection excludes originalUrl and query text', pipelineController.includes("`${req.baseUrl || ''}${req.path || ''}`") && !sourceSlice(pipelineController, 'export function kindFromRequest', 'export async function listSalesPipelineDocuments').includes('originalUrl'));

check('list requests stay on page one with an explicit bound', listScreen.includes('page: 1, limit: 100'));
check('manual refresh and filters share a stale-response guard', listScreen.includes('loadRequestSequence') && listScreen.includes('requestSequence !== loadRequestSequence.current'));
check('effect cleanup invalidates unfinished list requests', listScreen.includes('loadRequestSequence.current += 1'));
check('loading, error, empty and partial states remain visible', ['API\'den liste yükleniyor', 'Demo fallback kullanılmadı', 'Kayıt bulunamadı', 'hasPartialList'].every((value) => listScreen.includes(value)));
check('list keeps export, print and refresh tools', ['exportRows', 'printRows', 'loadRows'].every((value) => listScreen.includes(value)));
check('partial or loading lists cannot be exported as complete', listScreen.includes('canExportCompleteList') && listScreen.includes('disabled={!canExportCompleteList}') && listScreen.includes('if (!canExportCompleteList) return'));
check('Excel label uses the Excel helper instead of CSV', listScreen.includes('exportRowsToExcel') && !listScreen.includes('exportRowsToCsv'));
check('print action renders only the verified list report', listScreen.includes('printRowsReport') && !listScreen.includes('printCurrentScreen'));
check('filter changes invalidate the previous output snapshot immediately', sourceSlice(listScreen, 'function updateFilter', 'function openDocument').includes('loadRequestSequence.current += 1') && sourceSlice(listScreen, 'function updateFilter', 'function openDocument').includes('setMeta(null)'));
check('partial warning explains how to obtain complete Excel', listScreen.includes('eksiksiz Excel'));
check('invalid list metadata has a visible fail-closed warning', listScreen.includes('toplam satır bilgisi doğrulanamadı') && listScreen.includes('Excel ve Yazdır kapalıdır'));
check('pipeline layout stylesheet loads after shared styles', mainEntry.includes("import './styles/sales-pipeline-list.css'"));
check('read-only note stays inside the toolbar flow', listScreen.indexOf('sales-pipeline-readonly-note') > listScreen.indexOf('<section className="invoice-list-toolbar">') && listScreen.indexOf('sales-pipeline-readonly-note') < listScreen.indexOf('<section className="invoice-list-filters">'));
check('pipeline body protects table height and local overflow', listCss.includes('.sales-pipeline-list-body') && listCss.includes('min-height: 0') && listCss.includes('overflow: hidden'));
check('narrow workspace uses container-aware two-column filters', listCss.includes('container-type: inline-size') && listCss.includes('@container (max-width: 900px)') && listCss.includes('repeat(2, minmax(0, 1fr))'));
check('selected row has a visible pipeline-specific state', listCss.includes('tr.selected-row td') && listCss.includes('#e6f7f4'));
check('rows expose keyboard selection state', listScreen.includes('tabIndex={0}') && listScreen.includes('aria-selected='));
check('rows support Space selection and Enter opening', listScreen.includes("event.key === ' '") && listScreen.includes("event.key === 'Enter'") && listScreen.includes('handleRowKeyDown'));
check('keyboard focus remains visible', listCss.includes('tr:focus-visible') && listCss.includes('outline: 3px solid'));
check('pipeline statuses have scoped colors', ['status-draft', 'status-sent', 'status-confirmed', 'status-accepted', 'status-fulfilled', 'status-cancelled'].every((value) => listCss.includes(value)));

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} Sales pipeline list safety / ${name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) process.exit(1);
