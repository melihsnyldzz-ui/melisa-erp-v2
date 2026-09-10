import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVerifiedProductImageHandler, verifiedProductImageUrl } from './productImageIdentity.mjs';

const bytes = Buffer.from([255,216,255,224,1,2,3]);
const hash = createHash('sha256').update(bytes).digest('hex');
function response() { return { statusCode: 0, headers: {}, body: undefined,
  setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value; } }; }
const url = verifiedProductImageUrl('/uploads/vega-products/test.png', hash).replace('/uploads/verified-products', '');

test('verified image sends exactly hashed bytes, uses content MIME and disables stale caches', async () => {
  let calls = 0;
  const handle = createVerifiedProductImageHandler({ readImage: async ref => {
    calls++; assert.equal(ref, '/uploads/vega-products/test.png'); return { bytes, hash };
  } });
  const res = response(); await handle({ method: 'GET', url }, res);
  assert.equal(calls, 1); assert.equal(res.statusCode, 200); assert.equal(res.body, bytes);
  assert.equal(res.headers['content-type'], 'image/jpeg'); assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff'); assert.equal(res.headers['content-length'], bytes.length);
  const head = response(); await handle({ method: 'HEAD', url }, head); assert.equal(head.statusCode, 200); assert.equal(head.body, undefined);
});

test('replaced bytes cannot be delivered through an old verified URL', async () => {
  const handle = createVerifiedProductImageHandler({ readImage: async () => ({ bytes: Buffer.from('changed'), hash: 'c'.repeat(64) }) });
  const res = response(); await handle({ method: 'GET', url }, res); assert.equal(res.statusCode, 409); assert.equal(res.body, undefined);
});

test('unsafe references, non-raster data, missing files and writes never fall through to static files', async () => {
  let calls = 0;
  const handle = createVerifiedProductImageHandler({ readImage: async () => { calls++; return { bytes: Buffer.from('<svg></svg>'), hash }; } });
  for (const bad of ['/file.png', url + '?x=1', '/'+hash+'--../x.png', '/'+hash+'--x%2fy.png', '/'+hash+'--x.svg']) {
    const res = response(); await handle({ method: 'GET', url: bad }, res); assert.equal(res.statusCode, 404);
  }
  const post = response(); await handle({ method: 'POST', url }, post); assert.equal(post.statusCode, 405); assert.equal(calls, 0);
  const svg = response(); await handle({ method: 'GET', url }, svg); assert.equal(svg.statusCode, 415);
  const missing = response(); await createVerifiedProductImageHandler({ readImage: async () => { throw Error('private path'); } })({ method:'GET', url },missing);
  assert.equal(missing.statusCode,404);assert.equal(missing.body,undefined);
});
