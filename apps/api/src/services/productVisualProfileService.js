import { readFile, stat } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { getVegaProductImageMap } from './vegaProductImageService.js';

const route = '/internal/profile';
const visualValues = {
  colors: ['WHITE', 'CREAM', 'BEIGE', 'BROWN', 'PINK', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'GRAY', 'BLACK', 'MULTICOLOR'],
  patterns: ['SOLID', 'FLORAL', 'STRIPED', 'CHECKED', 'POLKA_DOT', 'ANIMAL_MOTIF', 'GEOMETRIC', 'TEXT_PRINT'],
  details: ['HOOD', 'BOW', 'RUFFLE', 'LACE', 'EMBROIDERY', 'POCKET', 'BUTTONS', 'ZIPPER', 'FOOTED', 'COLLAR'],
  sleeves: ['SLEEVELESS', 'SHORT', 'LONG'],
  style: ['PLAIN', 'CLASSIC', 'SPORTY', 'DECORATIVE'],
};
const hashPattern = /^[a-f0-9]{64}$/;
const shortText = (value, limit = 240) => typeof value === 'string' ? value.slice(0, limit) : null;

function sourceIdentity(value) {
  const id = String(value ?? '');
  if (!/^[1-9][0-9]{0,14}$/.test(id) || !Number.isSafeInteger(Number(id))) {
    const error = new Error('Vega ürün kimliği geçersiz');
    error.code = 'VEGA_PRODUCT_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export function unavailableVisualProfile(sourceId, state = 'UNAVAILABLE') {
  return { sourceId: String(sourceId), state, storage: 'PRODUCT_BRAIN_DERIVED', fields: [], versionId: null, imageHash: null, currentImageHash: null };
}

export function projectVisualProfile(profile, sourceId, currentImageHash) {
  const id = sourceIdentity(sourceId);
  if (!profile || String(profile.product?.sourceId) !== id) return unavailableVisualProfile(id);
  if (profile.product.active !== true) return unavailableVisualProfile(id, 'INACTIVE');
  if (!profile.versionId || !hashPattern.test(profile.imageHash || '')) return unavailableVisualProfile(id, 'PENDING');
  const current = hashPattern.test(currentImageHash || '') && currentImageHash === profile.imageHash;
  const fields = Object.entries(visualValues).map(([key, allowed]) => {
    const input = profile.fields?.[key];
    const validValues = Array.isArray(input?.values) && input.values.length <= 8
      && input.values.every((value) => allowed.includes(value));
    const values = validValues ? [...new Set(input.values)] : [];
    const source = ['HUMAN', 'IMAGE_AI'].includes(input?.source) ? input.source : 'UNKNOWN';
    let status = ['VERIFIED', 'AUTO_DERIVED', 'REVIEW', 'STALE', 'REJECTED', 'UNKNOWN'].includes(input?.status) ? input.status : 'UNKNOWN';
    const score = Number.isFinite(input?.score) && input.score >= 0 && input.score <= 1 ? input.score : null;
    if (!validValues || source === 'UNKNOWN') status = 'UNKNOWN';
    if (!values.length && ['VERIFIED', 'AUTO_DERIVED'].includes(status)) status = 'UNKNOWN';
    if (status === 'VERIFIED' && source !== 'HUMAN') status = 'REVIEW';
    if (status === 'AUTO_DERIVED' && (source !== 'IMAGE_AI' || score === null || score < 0.95)) status = 'REVIEW';
    // PB review() permits only IMAGE scope for these five VISUAL_VALUES fields,
    // including HUMAN reviews. PRODUCT-context reviews are outside this projection.
    const evidenceCurrent = current && input?.evidence === currentImageHash;
    if (!evidenceCurrent && !['UNKNOWN', 'REJECTED'].includes(status)) status = 'STALE';
    return {
      key, source, status, score,
      values: ['UNKNOWN', 'REJECTED'].includes(status) ? [] : values,
      usable: evidenceCurrent && values.length > 0 && ['VERIFIED', 'AUTO_DERIVED'].includes(status),
      evidenceImageHash: hashPattern.test(input?.evidence || '') ? input.evidence : null,
    };
  });
  return {
    sourceId: id, storage: 'PRODUCT_BRAIN_DERIVED', state: current ? 'AVAILABLE' : 'STALE', fields,
    versionId: shortText(profile.versionId, 160), imageHash: profile.imageHash,
    currentImageHash: hashPattern.test(currentImageHash || '') ? currentImageHash : null,
    modelVersion: shortText(profile.modelVersion), confidenceMeaning: 'UNCALIBRATED_MODEL_SCORE_NOT_ACCURACY',
  };
}

export function createProductVisualProfileReader({
  environment = process.env,
  imageMap = getVegaProductImageMap,
  read = readFile,
  fileStat = stat,
  request = (...args) => fetch(...args),
  root = () => process.cwd(),
  now = Date.now,
} = {}) {
  return async (sourceIdValue) => {
    const sourceId = sourceIdentity(sourceIdValue);
    try {
      const reference = (await imageMap([Number(sourceId)])).get(Number(sourceId));
      if (!reference) return unavailableVisualProfile(sourceId, 'NO_IMAGE');
      // Read only the ERP-approved local image; never fetch arbitrary URLs/files.
      if (!/^\/uploads\/vega-products\/[\p{L}\p{N}_. -]+$/u.test(reference) || reference.includes('..')) return unavailableVisualProfile(sourceId);
      const imagePath = path.join(root(), reference.slice(1));
      const info = await fileStat(imagePath);
      if (!info.isFile() || info.size > 4 * 1024 * 1024) return unavailableVisualProfile(sourceId);
      const imageBytes = await read(imagePath);
      if (imageBytes.length > 4 * 1024 * 1024) return unavailableVisualProfile(sourceId);
      const currentImageHash = createHash('sha256').update(imageBytes).digest('hex');
      const keyPath = environment.PB_EVENT_KEY_PATH || path.join(homedir(), '.melisa-ai', 'product-brain', 'event-key');
      const key = (await read(keyPath, 'utf8')).trim();
      if (!hashPattern.test(key)) return unavailableVisualProfile(sourceId);
      const body = JSON.stringify({ sourceId });
      const stamp = String(now());
      const signature = createHmac('sha256', key).update(`POST\n${route}\n${stamp}\n${body}`).digest('hex');
      const response = await request(`http://127.0.0.1:4324${route}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(1500),
        headers: { 'content-type': 'application/json', 'x-pb-timestamp': stamp, 'x-pb-signature': signature }, body,
      });
      if (!response.ok) {
        await response.body?.cancel();
        return unavailableVisualProfile(sourceId, response.status === 404 ? 'PENDING' : 'UNAVAILABLE');
      }
      if (Number(response.headers.get('content-length')) > 64000) {
        await response.body?.cancel();
        return unavailableVisualProfile(sourceId);
      }
      const reader = response.body.getReader();
      const chunks = []; let length = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          length += next.value.length;
          if (length > 64000) { await reader.cancel(); return unavailableVisualProfile(sourceId); }
          chunks.push(next.value);
        }
      } finally { reader.releaseLock(); }
      const profile = JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
      return projectVisualProfile(profile, sourceId, currentImageHash);
    } catch {
      return unavailableVisualProfile(sourceId);
    }
  };
}

export const getProductVisualProfile = createProductVisualProfileReader();
