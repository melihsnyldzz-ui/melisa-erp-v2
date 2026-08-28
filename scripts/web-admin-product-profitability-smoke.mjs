import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [
  controller,
  routes,
  service,
  screen,
  workspace,
  navigation,
  roles,
  api,
] = await Promise.all([
  read('apps/api/src/controllers/dashboardController.js'),
  read('apps/api/src/routes/dashboardRoutes.js'),
  read('apps/api/src/services/vegaProductProfitabilityService.js'),
  read('apps/web-admin/src/modules/reports/VegaProductProfitabilityScreen.jsx'),
  read('apps/web-admin/src/components/workspace/Workspace.jsx'),
  read('apps/web-admin/src/data/mockNavigationData.js'),
  read('apps/web-admin/src/config/roleViews.js'),
  read('apps/web-admin/src/services/dashboardApi.js'),
]);

assert.match(routes, /dashboard\/vega-product-profitability/);
assert.match(routes, /requirePermission\('dashboard\.view'\)/);
assert.match(controller, /getVegaProductProfitabilityFromWorker\(req\.query\)/);
assert.match(service, /moving-weighted-average-net-purchase-cost-try/);
assert.match(service, /writePerformed: false/);
assert.match(screen, /Maliyeti bağlanamayan satışlar kâra eklenmez/);
assert.match(screen, /salesCostCoverageRate/);
assert.match(workspace, /VegaProductProfitabilityScreen/);
assert.match(navigation, /vega-product-profitability/);
assert.match(roles, /vega-product-profitability/);
assert.match(api, /fetchVegaProductProfitability/);

console.log('Product profitability smoke: 10/10 PASS');
