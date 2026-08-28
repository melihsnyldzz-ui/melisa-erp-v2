import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProductCustomsDraft, GTIP } from './productCustomsClassifier.js';

test('explicit velsoft products are classified as synthetic baby knitwear drafts', () => {
  const result = classifyProductCustomsDraft({ productName: 'VELSOFT TULUM' });
  assert.equal(result.code, GTIP.BABY_KNIT_SYNTHETIC_OTHER);
  assert.equal(result.ruleId, 'baby-knit-synthetic-explicit');
  assert.equal(result.requiresReview, true);
});

test('cotton-default blankets use the blanket draft code', () => {
  const result = classifyProductCustomsDraft({ productName: 'KUZU TAVŞAN BATTANİYE' });
  assert.equal(result.code, GTIP.COTTON_BLANKET);
  assert.equal(result.ruleId, 'blanket-cotton-default');
});

test('linen and woven baby dresses are separated from knitwear', () => {
  const linen = classifyProductCustomsDraft({ productName: 'BASKILI KETEN ELBİSE' });
  const woven = classifyProductCustomsDraft({ productName: 'DOKUMA ELBİSE' });
  assert.equal(linen.code, GTIP.BABY_WOVEN_OTHER_TEXTILE);
  assert.equal(woven.code, GTIP.BABY_WOVEN_COTTON_OTHER);
});

test('knit markers win over generic dress markers', () => {
  const result = classifyProductCustomsDraft({ productName: 'BOLEROLU TRİKO ELBİSE' });
  assert.equal(result.code, GTIP.BABY_KNIT_COTTON_OTHER);
  assert.equal(result.ruleId, 'baby-knit-cotton-explicit');
});

test('unknown baby products receive a low-confidence cotton draft for review', () => {
  const result = classifyProductCustomsDraft({ productName: 'PREMIUM' });
  assert.equal(result.code, GTIP.BABY_KNIT_COTTON_OTHER);
  assert.equal(result.confidence, 'low');
  assert.equal(result.source, 'automatic-rule');
});
