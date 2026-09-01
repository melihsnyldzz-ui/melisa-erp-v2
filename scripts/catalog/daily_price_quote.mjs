import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDailyPriceBooks,
  buildSafeEvidenceSummary,
  buildSafeQuoteDraft,
  parseDailyPriceQuoteArgs,
} from './daily_price_quote_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogTarget = path.join(rootDir, 'output', 'pdf', 'catalog_work', 'catalog-selection.json');

function printHelp() {
  console.log([
    'Usage: node scripts/catalog/daily_price_quote.mjs',
    '',
    'Reads only the approved local catalog and prints a redacted synthetic-review summary.',
    'It never writes a file or database, sends a message, creates an order, collects payment, or publishes output.',
  ].join('\n'));
}

async function main() {
  const cli = parseDailyPriceQuoteArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }
  const source = await readFile(catalogTarget, 'utf8');
  const catalog = JSON.parse(source);
  const priceBooks = buildDailyPriceBooks({
    catalogSource: source,
  });
  const sampleBook = priceBooks.find((book) =>
    book.items.some((item) => item.packageContentVerificationPending)) || priceBooks[0];
  const sampleItem = sampleBook?.items?.find((item) => item.packageContentVerificationPending)
    || sampleBook?.items?.[0];
  if (!sampleItem) throw new Error('Approved catalog did not produce a daily price book');
  const quoteDraft = buildSafeQuoteDraft({
    priceBooks,
    requestedLines: [{
      sourceId: sampleItem.sourceId,
      stockCode: sampleItem.stockCode,
      quantity: 1,
    }],
  });
  console.log(JSON.stringify(buildSafeEvidenceSummary({ catalog, priceBooks, quoteDraft }), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'FAIL_CLOSED',
    code: error.code || 'DAILY_PRICE_QUOTE_FAILED',
    message: error.message,
  }));
  process.exitCode = 1;
});
