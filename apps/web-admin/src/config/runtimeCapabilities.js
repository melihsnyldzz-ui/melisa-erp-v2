// The isolated pilot launcher deliberately excludes the legacy Vega SQL pool.
// Keep deep-link identities while omitting unavailable reports from navigation.
const legacyVegaReportScreens = new Set([
  'vega-sales-comparison',
  'vega-sales-performance',
  'vega-product-profitability',
]);

export function isScreenAvailable(screenId, { pilotMode = false } = {}) {
  return !pilotMode || !legacyVegaReportScreens.has(screenId);
}
