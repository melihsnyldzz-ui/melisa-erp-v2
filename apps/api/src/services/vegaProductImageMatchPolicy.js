const HOUR_MS = 60 * 60 * 1000;

export function normalizeImageStockCode(value) {
  return String(value || '').replace(/\s+/g, '');
}

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasActiveImage(existingImages, sourceId) {
  if (!existingImages) return false;
  if (typeof existingImages.has === 'function') return existingImages.has(sourceId);
  return Boolean(existingImages[sourceId]);
}

/**
 * Return active Vega cards which were already open when the image arrived,
 * still have no primary image, and are inside the configured waiting window.
 *
 * This is deliberately only a narrowing policy. Callers must still require a
 * single candidate before automatically writing an image.
 */
export function findRecentWaitingCards(
  candidates,
  { existingImages, receivedAt, windowHours = 72 } = {},
) {
  const receivedTimestamp = timestamp(receivedAt);
  const boundedWindowHours = Number(windowHours);
  if (!Number.isFinite(receivedTimestamp)
    || !Number.isFinite(boundedWindowHours)
    || boundedWindowHours <= 0) return [];

  const maximumAge = boundedWindowHours * HOUR_MS;
  return (Array.isArray(candidates) ? candidates : [])
    .flatMap((product) => {
      const openedTimestamp = timestamp(product?.cardOpenedAt);
      const sourceId = Number(product?.sourceId);
      if (!Number.isFinite(openedTimestamp)
        || !Number.isInteger(sourceId)
        || sourceId <= 0
        || hasActiveImage(existingImages, sourceId)) return [];

      const ageMs = receivedTimestamp - openedTimestamp;
      if (ageMs < 0 || ageMs > maximumAge) return [];
      return [{
        product,
        waitingAgeHours: Math.round((ageMs / HOUR_MS) * 100) / 100,
      }];
    })
    .sort((left, right) => (
      left.waitingAgeHours - right.waitingAgeHours
      || Number(right.product.sourceId) - Number(left.product.sourceId)
    ));
}

export function rankReviewCandidates(candidates, recentWaitingCandidates = []) {
  const waitingBySourceId = new Map(
    recentWaitingCandidates.map((item) => [Number(item?.product?.sourceId), item]),
  );
  return (Array.isArray(candidates) ? candidates : [])
    .map((product) => ({
      product,
      waiting: waitingBySourceId.get(Number(product?.sourceId)) || null,
    }))
    .sort((left, right) => (
      Number(Boolean(right.waiting)) - Number(Boolean(left.waiting))
      || Number(right.product?.sourceId || 0) - Number(left.product?.sourceId || 0)
    ));
}

export const RECENT_WAITING_CARD_DEFAULT_HOURS = 72;
