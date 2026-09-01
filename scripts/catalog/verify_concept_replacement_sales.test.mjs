import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPLACEMENT_SHORTLIST_TARGETS,
  SHORTLIST_SHA256,
  assertPinnedShortlist,
  buildReplacementSalesQuery,
  parseReplacementSalesArgs,
} from './verify_concept_replacement_sales_core.mjs';

function shortlistPayload() {
  return {
    publicationStatus: 'local-review-evidence-only',
    sourceIdentity: {
      source: 'vega-live-read-only',
      companyCode: 'F0102',
      periodCode: 'D0007',
      year: 2026,
    },
    shortlist: REPLACEMENT_SHORTLIST_TARGETS.map((target, index) => ({
      rank: index + 1,
      ...target,
      dataChecks: {
        active: true,
        imagePresent: true,
        stockPresent: true,
        salePricePresent: true,
        barcodePresent: true,
      },
    })),
  };
}

test('CLI is preview by default and rejects write-like arguments', () => {
  assert.deepEqual(parseReplacementSalesArgs([]), {
    help: false,
    writeReport: false,
    mode: 'preview',
  });
  assert.equal(parseReplacementSalesArgs(['--write-report']).writeReport, true);
  assert.throws(() => parseReplacementSalesArgs(['--apply']), {
    code: 'CONCEPT_REPLACEMENT_SALES_ARGUMENT_INVALID',
  });
});

test('shortlist identity, source, checks, and hash are pinned', () => {
  assert.deepEqual(
    assertPinnedShortlist(shortlistPayload(), SHORTLIST_SHA256),
    REPLACEMENT_SHORTLIST_TARGETS,
  );
  assert.throws(() => assertPinnedShortlist(shortlistPayload(), '0'.repeat(64)), {
    code: 'CONCEPT_REPLACEMENT_SHORTLIST_HASH_MISMATCH',
  });
  const failed = shortlistPayload();
  failed.shortlist[0].dataChecks.barcodePresent = false;
  assert.throws(() => assertPinnedShortlist(failed, SHORTLIST_SHA256), {
    code: 'CONCEPT_REPLACEMENT_SHORTLIST_IDENTITY_MISMATCH',
  });
});

test('targeted sales query is parameterized and SELECT-only', () => {
  const query = buildReplacementSalesQuery();
  assert.match(query, /@replacementSourceId0/);
  assert.match(query, /@replacementSourceId2/);
  assert.match(query, /F0102D0004TBLSTOKHAREKETLERI/);
  assert.match(query, /F0102D0007TBLSTOKHAREKETLERI/);
  assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|EXEC)\b/i);
  assert.doesNotMatch(query, /TBLCARI|FIRMAADI|SATISFIYATI|AFIYATI|GERCEKTOPLAM/i);
});

test('target count fails closed outside one to ten products', () => {
  assert.throws(() => buildReplacementSalesQuery([]), {
    code: 'CONCEPT_REPLACEMENT_SALES_TARGET_COUNT_INVALID',
  });
  assert.throws(() => buildReplacementSalesQuery(Array.from({ length: 11 }, () => ({}))), {
    code: 'CONCEPT_REPLACEMENT_SALES_TARGET_COUNT_INVALID',
  });
});
