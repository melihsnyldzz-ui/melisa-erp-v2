import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { createProductVisualProfileReader, projectVisualProfile } from './productVisualProfileService.js';

const image = Buffer.from('fixture image only');
const hash = createHash('sha256').update(image).digest('hex');
const oldHash = '1'.repeat(64);
const key = 'ab'.repeat(32);
const field = (values, status = 'AUTO_DERIVED', score = 0.97, source = 'IMAGE_AI', evidence = hash) => ({ values, status, score, source, evidence });
const profile = (fields = {}) => ({ product: { sourceId: '42', active: true }, versionId: 'fixture-v1', imageHash: hash, modelVersion: 'fixture-model', fields: { colors: field(['BLUE']), ...fields } });

test('high-confidence automatic and human-verified visible values are usable; other fields remain distinct', () => {
  const result = projectVisualProfile(profile({
    details: field(['BOW'], 'VERIFIED', null, 'HUMAN'), patterns: field(['FLORAL'], 'REVIEW', 0.8),
    sleeves: field(['LONG'], 'UNKNOWN', 0.3), style: field([], 'REJECTED', null, 'HUMAN'),
    category: field(['DRESS'], 'VERIFIED', null, 'HUMAN'), price: field(['999']),
  }), '42', hash);
  assert.equal(result.state, 'AVAILABLE');
  assert.deepEqual(result.fields.filter((entry) => entry.usable).map((entry) => entry.key), ['colors', 'details']);
  assert.equal(result.fields.find((entry) => entry.key === 'patterns').status, 'REVIEW');
  assert.deepEqual(result.fields.find((entry) => entry.key === 'sleeves').values, []);
  assert.deepEqual(result.fields.find((entry) => entry.key === 'style').values, []);
  assert.deepEqual(result.fields.map((entry) => entry.key), ['colors', 'patterns', 'details', 'sleeves', 'style']);
  assert.equal(JSON.stringify(result).includes('999'), false);
});

test('image replacement retains human values as stale and prevents their automatic reuse', () => {
  const result = projectVisualProfile(profile({ colors: field(['BLUE'], 'VERIFIED', null, 'HUMAN') }), '42', oldHash);
  assert.equal(result.state, 'STALE');
  assert.equal(result.fields[0].status, 'STALE');
  assert.equal(result.fields[0].source, 'HUMAN');
  assert.deepEqual(result.fields[0].values, ['BLUE']);
  assert.equal(result.fields[0].usable, false);
});

test('product-context reviews stay outside the visual contract and cannot validate visual evidence', () => {
  const contextHash = '2'.repeat(64);
  const result = projectVisualProfile(profile({
    colors: field(['BLUE'], 'VERIFIED', null, 'HUMAN', contextHash),
    details: field(['BOW'], 'VERIFIED', null, 'HUMAN'),
    patterns: field(['FLORAL'], 'STALE', null, 'HUMAN'),
    piecesPerSeries: field(['4'], 'VERIFIED', null, 'HUMAN', contextHash),
    category: field(['DRESS'], 'VERIFIED', null, 'HUMAN', contextHash),
  }), '42', hash);
  assert.equal(result.state, 'AVAILABLE');
  assert.deepEqual(result.fields.map((entry) => entry.key), ['colors', 'patterns', 'details', 'sleeves', 'style']);
  assert.equal(result.fields.find((entry) => entry.key === 'colors').status, 'STALE');
  assert.equal(result.fields.find((entry) => entry.key === 'colors').usable, false);
  assert.equal(result.fields.find((entry) => entry.key === 'details').usable, true);
  assert.equal(result.fields.find((entry) => entry.key === 'patterns').status, 'STALE');
  assert.equal(result.fields.find((entry) => entry.key === 'patterns').usable, false);
  assert.equal(JSON.stringify(result).includes('piecesPerSeries'), false);
  assert.equal(JSON.stringify(result).includes('DRESS'), false);
});

test('field-specific stale evidence, uncalibrated low score, forged source and unsupported values fail closed', () => {
  for (const input of [field(['BLUE'], 'VERIFIED', null, 'HUMAN', oldHash), field(['BLUE'], 'AUTO_DERIVED', 0.949), field(['BLUE'], 'VERIFIED', 1, 'IMAGE_AI'), field(['FABRIC_COTTON'])]) {
    assert.equal(projectVisualProfile(profile({ colors: input }), '42', hash).fields[0].usable, false);
  }
  assert.equal(projectVisualProfile(profile(), '99', hash).state, 'UNAVAILABLE');
  assert.equal(projectVisualProfile({ ...profile(), versionId: null }, '42', hash).state, 'PENDING');
});

function readerFixture({ response = new Response(JSON.stringify(profile())), reference = '/uploads/vega-products/fixture.png', sendError, keyValue = key, imageError = false } = {}) {
  const calls = [];
  const reader = createProductVisualProfileReader({
    environment: { PB_EVENT_KEY_PATH: 'fixture-key' }, imageMap: async () => new Map(reference ? [[42, reference]] : []),
    read: async (file) => file === 'fixture-key' ? keyValue : image,
    fileStat: async () => { if (imageError) throw new Error('private-path'); return { isFile: () => true, size: image.length }; },
    root: () => 'C:/fixture', now: () => 1800000000000,
    request: async (...args) => { calls.push(args); if (sendError) throw new Error('private-response'); return response; },
  });
  return { reader, calls };
}

test('reader uses backend-only signed loopback read with current approved image hash', async () => {
  const f = readerFixture();
  const result = await f.reader('42');
  assert.equal(result.fields[0].usable, true);
  assert.equal(result.currentImageHash, hash);
  const [url, options] = f.calls[0];
  assert.equal(url, 'http://127.0.0.1:4324/internal/profile');
  assert.deepEqual(JSON.parse(options.body), { sourceId: '42' });
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers['x-pb-signature'], createHmac('sha256', key).update(`POST\n/internal/profile\n1800000000000\n${options.body}`).digest('hex'));
  assert.equal(JSON.stringify(result).includes(key), false);
});

test('helper unavailable, absent profile, malformed or oversized response do not fail the product card', async () => {
  for (const options of [{ sendError: true }, { response: new Response('private error', { status: 503 }) }, { response: new Response('not-json') }, { response: new Response('x'.repeat(64001)) }, { imageError: true }, { keyValue: 'invalid' }]) {
    assert.equal((await readerFixture(options).reader('42')).state, 'UNAVAILABLE');
  }
  assert.equal((await readerFixture({ response: new Response('{}', { status: 404 }) }).reader('42')).state, 'PENDING');
});

test('deleted image, unsafe path, malformed identity never contact helper', async () => {
  const absent = readerFixture({ reference: null });
  assert.equal((await absent.reader('42')).state, 'NO_IMAGE');
  assert.equal(absent.calls.length, 0);
  for (const reference of ['/uploads/vega-products/../secret', 'https://example.invalid/photo.png', '/uploads/elsewhere/a.png']) {
    const f = readerFixture({ reference });
    assert.equal((await f.reader('42')).state, 'UNAVAILABLE');
    assert.equal(f.calls.length, 0);
  }
  await assert.rejects(readerFixture().reader('42/other'), { code: 'VEGA_PRODUCT_ID_INVALID' });
});
