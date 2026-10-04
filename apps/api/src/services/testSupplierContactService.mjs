import {withTestSalesMutation} from './testSalesScope.mjs';
import {assertSupplierContactActor, assertSupplierContactId, parseSupplierContact, supplierContactContext, supplierContactError} from './testSupplierContactModel.mjs';

export function createTestSupplierContactService({getStore = () => import('./testSupplierContactStore.mjs')} = {}) {
  return {
    async context(id, actor) {
      assertSupplierContactActor(actor); assertSupplierContactId(id);
      const store = await getStore();
      return supplierContactContext(await store.readTestSupplierContactContext());
    },
    async update(id, body, actor) {
      assertSupplierContactActor(actor); assertSupplierContactId(id);
      const input = parseSupplierContact(body), store = await getStore();
      return withTestSalesMutation(async () => {
        const result = await store.updateTestSupplierContact({...input, actorId: '16'});
        if (typeof result?.replayed !== 'boolean') throw supplierContactError('TEST_SUPPLIER_CONTACT_UNAVAILABLE', 'TEST düzenleme sonucu doğrulanamadı.', 503);
        return {...supplierContactContext(result), replayed: result.replayed};
      });
    },
  };
}
export const testSupplierContactService = createTestSupplierContactService();
