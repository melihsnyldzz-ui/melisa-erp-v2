const suites = [
  './web-admin-navigation-smoke.mjs',
  './web-admin-sales-invoice-ux-smoke.mjs',
  './web-admin-purchase-invoice-ux-smoke.mjs',
  './web-admin-finance-entry-ux-smoke.mjs',
  './web-admin-entity-ux-smoke.mjs',
  './web-admin-supplier-movements-ux-smoke.mjs',
  './web-admin-stock-product-ux-smoke.mjs',
  './web-admin-report-definition-ux-smoke.mjs',
  './web-admin-responsive-layout-smoke.mjs',
  './web-admin-global-visual-hierarchy-smoke.mjs',
];

for (const suite of suites) {
  console.log(`\nRUN - ${suite}`);
  await import(suite);
}

console.log(`\nSUMMARY: ${suites.length}/${suites.length} UX suites PASS`);
