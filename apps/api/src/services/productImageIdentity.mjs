import { createHash, createHmac } from 'node:crypto';
import { readFile, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

const route = '/internal/image-identities';
const statuses = new Set(['VERIFIED', 'UNREVIEWED', 'CONFLICT', 'STALE', 'INACTIVE', 'UNAVAILABLE']);
const clean = (value, max) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

// Same bounded identity projection as Product Brain; never compare commercial fields.
export function imageSourceIdentity(row, imageUrl) {
  return {
    sourceId: String(row.sourceId), sku: String(row.stockCode ?? row.sku ?? '').trim(),
    name: clean(row.productName ?? row.name, 300), brand: clean(row.brand, 120),
    rawCategory: clean(row.category, 80), imageUrl, active: row.isPassive !== true,
  };
}

export function createImageIdentityReader({ environment = process.env, readKeyFile = file => readFile(file, 'utf8'),
  send = (url, init) => fetch(url, init), now = Date.now } = {}) {
  return async function readIdentities(sourceIds) {
    if (!sourceIds.length) return new Map();
    if (sourceIds.length > 500 || new Set(sourceIds).size !== sourceIds.length
      || sourceIds.some(id => !/^[1-9][0-9]{0,14}$/.test(id))) throw new Error('IMAGE_IDENTITY_REQUEST_INVALID');
    if (environment.PB_IMAGE_IDENTITY_ENABLED !== 'true') throw new Error('IMAGE_IDENTITY_UNAVAILABLE');
    const key = (await readKeyFile(environment.PB_EVENT_KEY_PATH
      || path.join(homedir(), '.melisa-ai', 'product-brain', 'event-key'))).trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('IMAGE_IDENTITY_KEY_INVALID');
    const body = JSON.stringify({ sourceIds }), stamp = String(now());
    const signature = createHmac('sha256', key).update(`POST\n${route}\n${stamp}\n${body}`).digest('hex');
    const response = await send(`http://127.0.0.1:4324${route}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(1500), body,
      headers: { 'content-type': 'application/json', 'x-pb-timestamp': stamp, 'x-pb-signature': signature },
    });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('IMAGE_IDENTITY_UNAVAILABLE'); }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 1024 * 1024) throw new Error('IMAGE_IDENTITY_RESPONSE_TOO_LARGE');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result.contract !== 'IMAGE_IDENTITIES_V1'
      || result.freshness !== 'STORED_SNAPSHOT_REQUIRES_SOURCE_AND_IMAGE_COMPARISON'
      || !Array.isArray(result.items) || result.items.length !== sourceIds.length) throw new Error('IMAGE_IDENTITY_RESPONSE_INVALID');
    const map = new Map();
    for (const item of result.items) {
      if (!item || !sourceIds.includes(item.sourceId) || map.has(item.sourceId) || !statuses.has(item.status)) throw new Error('IMAGE_IDENTITY_RESPONSE_INVALID');
      map.set(item.sourceId, item);
    }
    return map;
  };
}

// Fixed local upload root, no arbitrary HTTP/file reads, bounded bytes and symlink containment.
export async function readLocalProductImage(reference, uploadRoot = path.join(process.cwd(), 'uploads', 'vega-products')) {
  if (typeof reference !== 'string' || !/^\/uploads\/vega-products\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(reference)) throw new Error('IMAGE_PATH_INVALID');
  const root = await realpath(uploadRoot), file = await realpath(path.join(root, path.basename(reference)));
  if (path.dirname(file).toLowerCase() !== root.toLowerCase()) throw new Error('IMAGE_PATH_INVALID');
  const handle = await open(file, 'r');
  try {
    if (!(await handle.stat()).isFile()) throw new Error('IMAGE_FILE_INVALID');
    const buffer = Buffer.alloc(3 * 1024 * 1024 + 1); let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break; size += bytesRead;
    }
    if (!size || size === buffer.length) throw new Error('IMAGE_SIZE_INVALID');
    const bytes = buffer.subarray(0, size);
    return { bytes, hash: createHash('sha256').update(bytes).digest('hex') };
  } finally { await handle.close(); }
}

export async function hashLocalProductImage(reference, uploadRoot = path.join(process.cwd(), 'uploads', 'vega-products')) {
  return (await readLocalProductImage(reference, uploadRoot)).hash;
}

export function verifiedProductImageUrl(reference, hash) {
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^\/uploads\/vega-products\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(reference)) throw new Error('IMAGE_REFERENCE_INVALID');
  return `/uploads/verified-products/${hash}--${path.basename(reference)}`;
}

// Respond from exactly the buffer that was hashed: never check then sendFile again.
export function createVerifiedProductImageHandler({ readImage = readLocalProductImage } = {}) {
  return async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; res.end(); return; }
    const match = req.url.match(/^\/([a-f0-9]{64})--([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))$/i);
    if (!match) { res.statusCode = 404; res.end(); return; }
    try {
      const { bytes, hash } = await readImage(`/uploads/vega-products/${match[2]}`);
      if (hash !== match[1]) { res.statusCode = 409; res.end(); return; }
      const mime = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
        : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
          : bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : null;
      if (!mime) { res.statusCode = 415; res.end(); return; }
      res.setHeader('content-type', mime);
      res.setHeader('content-length', bytes.length);
      res.statusCode = 200; res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.statusCode = 404; res.end(); }
  };
}

const readIdentities = createImageIdentityReader();
export async function getPresentableProductImages(products, imageMap, {
  read = readIdentities, hashImage = hashLocalProductImage,
} = {}) {
  const ids = [...new Set(products.map(row => String(row.sourceId)))];
  let reviews;
  try { reviews = await read(ids); } catch { reviews = new Map(); }
  const result = new Map();
  for (const row of products) {
    const id = String(row.sourceId), imageUrl = imageMap.get(Number(id)) || null;
    let status = imageUrl ? 'UNAVAILABLE' : 'NO_IMAGE';
    const review = reviews.get(id);
    if (imageUrl && review) {
      status = review.status;
      if (status === 'VERIFIED') {
        const expected = imageSourceIdentity(row, imageUrl);
        if (!review.product || !expected.active || !expected.sku || !expected.name
          || Object.keys(expected).some(key => review.product[key] !== expected[key])
          || !/^[a-f0-9]{64}$/.test(review.imageHash)) status = 'STALE';
        else {
          try { if (await hashImage(imageUrl) !== review.imageHash) status = 'STALE'; }
          catch { status = 'UNAVAILABLE'; }
        }
      }
    }
    result.set(Number(id), { imageUrl: status === 'VERIFIED' ? verifiedProductImageUrl(imageUrl, review.imageHash) : null, imageIdentityStatus: status,
      imageIdentityHash: status === 'VERIFIED' ? review.imageHash : null });
  }
  return result;
}
