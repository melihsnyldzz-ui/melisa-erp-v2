import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createImageIdentityReader, imageSourceIdentity, getPresentableProductImages, hashLocalProductImage } from './productImageIdentity.mjs';

const photo = '/uploads/vega-products/test.jpg', hash = 'a'.repeat(64);
const row = { sourceId: 1, stockCode: '4711 LEYLEK', productName: 'PATİK', brand: 'LEYLEK', category: 'PATİK', imageUrl: '/old-fallback.jpg' };
const identity = { sourceId: '1', status: 'VERIFIED', imageHash: hash, product: imageSourceIdentity(row, photo) };
const envelope = items => ({ contract: 'IMAGE_IDENTITIES_V1', freshness: 'STORED_SNAPSHOT_REQUIRES_SOURCE_AND_IMAGE_COMPARISON', items });

test('reader signs a fixed loopback read and validates complete unique response identities', async () => {
  const key = 'b'.repeat(64); let payload = envelope([identity]);
  const read = createImageIdentityReader({ environment: { PB_IMAGE_IDENTITY_ENABLED: 'true' }, readKeyFile: async () => key, now: () => 1234567890123,
    send: async (url, init) => {
      assert.equal(url, 'http://127.0.0.1:4324/internal/image-identities'); assert.equal(init.redirect, 'error');
      assert.equal(init.headers['x-pb-signature'], createHmac('sha256', key).update(`POST\n/internal/image-identities\n1234567890123\n${init.body}`).digest('hex'));
      return Response.json(payload);
    } });
  assert.equal((await read(['1'])).get('1').status, 'VERIFIED');
  for (const items of [[], [identity, identity], [{ ...identity, sourceId: '2' }], [{ ...identity, status: 'OK' }]]) {
    payload = envelope(items); await assert.rejects(read(['1']), /RESPONSE_INVALID/);
  }
  await assert.rejects(read(['1', '1']), /REQUEST_INVALID/);
  await assert.rejects(read(Array.from({ length: 501 }, (_, i) => String(i + 1))), /REQUEST_INVALID/);
});

test('reader fails closed for disabled configuration, transport and excessive response', async () => {
  await assert.rejects(createImageIdentityReader({ environment: {}, readKeyFile: async () => { throw Error('must not read'); } })(['1']), /UNAVAILABLE/);
  for (const send of [async () => { throw Error('offline'); }, async () => new Response('', { status: 503 }), async () => new Response('x'.repeat(1024 * 1024 + 1))]) {
    await assert.rejects(createImageIdentityReader({ environment: { PB_IMAGE_IDENTITY_ENABLED: 'true' }, readKeyFile: async () => 'b'.repeat(64), send })(['1']));
  }
});

test('presentation requires current source AND bytes; never restores a raw fallback', async () => {
  const images = new Map([[1, photo]]); let review = identity, currentHash = hash;
  const deps = { read: async () => new Map([['1', review]]), hashImage: async () => currentHash };
  const project = async () => (await getPresentableProductImages([row], images, deps)).get(1);
  assert.deepEqual(await project(), { imageUrl: photo, imageIdentityStatus: 'VERIFIED' });
  for (const status of ['CONFLICT', 'STALE', 'UNREVIEWED', 'INACTIVE', 'UNAVAILABLE']) {
    review = { ...identity, status }; assert.equal((await project()).imageUrl, null);
  }
  for (const key of ['sku', 'name', 'brand', 'rawCategory', 'sourceId', 'imageUrl', 'active']) {
    review = { ...identity, product: { ...identity.product, [key]: 'CHANGED' } };
    assert.equal((await project()).imageIdentityStatus, 'STALE');
  }
  review = identity; currentHash = 'c'.repeat(64); assert.equal((await project()).imageUrl, null);
  deps.read = async () => { throw Error('offline'); }; assert.equal((await project()).imageIdentityStatus, 'UNAVAILABLE');
  assert.equal(row.imageUrl, '/old-fallback.jpg'); assert.equal(images.get(1), photo);
  images.clear(); assert.equal((await project()).imageIdentityStatus, 'NO_IMAGE');
});

test('local hash accepts only bounded files inside the product upload root', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'image-identity-test-'));
  try {
    await writeFile(path.join(dir, 'test.jpg'), 'fixture');
    assert.equal(await hashLocalProductImage(photo, dir), createHash('sha256').update('fixture').digest('hex'));
    for (const ref of ['http://foreign/test.jpg', '/uploads/vega-products/../test.jpg', photo + '?x=1', '/uploads/vega-products/%2e%2e.jpg']) await assert.rejects(hashLocalProductImage(ref, dir));
    await writeFile(path.join(dir, 'test.jpg'), Buffer.alloc(3 * 1024 * 1024 + 1)); await assert.rejects(hashLocalProductImage(photo, dir), /SIZE_INVALID/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
