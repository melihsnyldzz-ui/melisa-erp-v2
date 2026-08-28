import { calculateTerminalReferencePrice } from '../apps/api/src/services/terminalService.js';

const rates = new Map([
  ['TRY', 1],
  ['USD', 49.70],
  ['EUR', 56.20],
]);

function closeTo(actual, expected, tolerance = 0.0001) {
  return Math.abs(actual - expected) <= tolerance;
}

const tryToUsd = calculateTerminalReferencePrice({
  listPrice: 371.70,
  sourceCurrency: 'TRY',
  targetCurrency: 'USD',
  documentCurrency: 'USD',
  documentExchangeRate: 49.70,
  currencyRateMap: rates,
});
const usdToUsd = calculateTerminalReferencePrice({
  listPrice: 5.20,
  sourceCurrency: 'USD',
  targetCurrency: 'USD',
  documentCurrency: 'USD',
  documentExchangeRate: 49.70,
  currencyRateMap: rates,
});
const eurToUsd = calculateTerminalReferencePrice({
  listPrice: 10,
  sourceCurrency: 'EUR',
  targetCurrency: 'USD',
  documentCurrency: 'USD',
  documentExchangeRate: 49.70,
  currencyRateMap: rates,
});
const screenshotPrice = calculateTerminalReferencePrice({
  listPrice: 351.70,
  sourceCurrency: 'TRY',
  targetCurrency: 'USD',
  documentCurrency: 'USD',
  documentExchangeRate: 47,
  currencyRateMap: new Map([['TRY', 1], ['USD', 47]]),
});

const checks = [
  ['TRY list price converts to USD before comparison', closeTo(tryToUsd, 371.70 / 49.70)],
  ['same-currency USD list price remains unchanged', closeTo(usdToUsd, 5.20)],
  ['cross-currency EUR price uses server rate map', closeTo(eurToUsd, 10 * 56.20 / 49.70)],
  ['converted price is not treated as a discount', Math.abs(tryToUsd - (371.70 / 49.70)) <= 0.005],
  ['351.70 TRY becomes displayed 7.48 USD without false discount', Math.abs(screenshotPrice - 7.48) <= 0.005],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} - Terminal currency pricing / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
