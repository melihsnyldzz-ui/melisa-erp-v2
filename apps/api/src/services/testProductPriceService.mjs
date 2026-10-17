import {assertProductPriceActor, assertProductPriceId, parseProductPrice, productPriceContext, assertSupportedProductPrice, productPriceError} from './testProductPriceModel.mjs';
import {withTestSalesMutation} from './testSalesScope.mjs';

export function createTestProductPriceService({getStore = () => import('./testProductPriceStore.mjs')} = {}) {
  return {
    async context(productId, actor) {
      assertProductPriceActor(actor); const id = assertProductPriceId(productId), store = await getStore();
      return productPriceContext(await store.readTestProductPrices(id, String(actor.id)), String(actor.id) === '16' && actor.permissions.includes('product.price.edit'));
    },
    async update(productId, body, actor) {
      assertProductPriceActor(actor, true); const id = assertProductPriceId(productId), input = parseProductPrice(body), store = await getStore();
      const trusted = productPriceContext(await store.readTestProductPrices(id, '16'), true);
      if (!trusted.capabilities.canEdit) throw productPriceError('TEST_PRODUCT_PRICE_FORBIDDEN', 'Bu TEST fiyat işlemi için yetkiniz yok.', 403);
      assertSupportedProductPrice(input, trusted);
      return withTestSalesMutation(async () => {
        const result = await store.setTestProductPrice(id, '16', input.payloadJson);
        if (typeof result?.replayed !== 'boolean') throw productPriceError('TEST_PRODUCT_PRICE_UNAVAILABLE', 'Fiyat kaydı sonucu doğrulanamadı.', 503);
        return {...productPriceContext(result, true), replayed: result.replayed};
      });
    },
  };
}
export const testProductPriceService = createTestProductPriceService();
