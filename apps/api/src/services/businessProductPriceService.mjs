import {
  parseBusinessProductPrice,
  businessProductPriceContext,
  assertBusinessProductPriceActor,
  assertSupportedBusinessProductPrice,
} from './businessProductPriceModel.mjs';

// This service has no fallback to the original TEST fixture or a privileged
// connection. The registered DB02 store owns the native transaction, fresh
// actor/source proof, replay journal and current-version compare-and-swap.
export function createBusinessProductPriceService({getStore} = {}) {
  if (typeof getStore !== 'function') throw new TypeError('BUSINESS_PRICE_STORE_REQUIRED');
  const execute = async (productId, actor, body, write) => {
    const store = await getStore();
    return store.withProductPrice({productId, actor, write}, async session => {
      const {copy, actualActor, canEdit, context} = session;
      assertBusinessProductPriceActor(copy, actor, actualActor, {write, canEdit});
      const current = businessProductPriceContext(copy, context, {canEdit});
      if (current.productId !== productId || write && !current.canEdit) {
        throw Object.assign(new Error('Bu ürün fiyatı için kayıt yetkisi doğrulanamadı.'), {
          code: 'BUSINESS_PRICE_FORBIDDEN', statusCode: 403,
        });
      }
      if (!write) return current;
      const input = parseBusinessProductPrice(copy, productId, body);
      assertSupportedBusinessProductPrice(input, current);
      // Do not compare expectedRevision in JS: an old successful UUID must
      // replay its original result even after later legitimate price changes.
      const result = await session.update(input.payloadJson);
      if (typeof result?.replayed !== 'boolean' || result.context?.productId !== productId) {
        throw Object.assign(new Error('Fiyat kaydı sonucu doğrulanamadı.'), {
          code: 'BUSINESS_PRICE_UNAVAILABLE', statusCode: 503,
        });
      }
      return {...businessProductPriceContext(copy, result.context, {canEdit}), replayed: result.replayed};
    });
  };
  return Object.freeze({
    context: (productId, actor) => execute(productId, actor, undefined, false),
    update: (productId, body, actor) => execute(productId, actor, body, true),
  });
}
