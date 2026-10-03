// Match the existing write and reference-list API permissions. A collection-only
// operator must not need supplier access just to receive a customer's payment.
export function resolveCollectionsCapabilities(permissions = []) {
  const allowed = new Set(Array.isArray(permissions) ? permissions : []);
  const canReadFinance = allowed.has('finance.view') || allowed.has('customer.view');
  const canCollect = canReadFinance && allowed.has('customer.view')
    && (allowed.has('finance.collection') || allowed.has('customer.edit'));
  const canPay = canReadFinance && allowed.has('supplier.view')
    && (allowed.has('finance.payment') || allowed.has('purchase.edit'));
  return { canCollect, canPay };
}
