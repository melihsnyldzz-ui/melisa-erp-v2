const CASH_REGISTER_VIEW_PERMISSIONS = ['finance.view', 'finance.collection', 'finance.payment'];

export function resolveCashRegisterCapabilities(permissions = []) {
  const granted = new Set(Array.isArray(permissions) ? permissions : []);
  const canView = CASH_REGISTER_VIEW_PERMISSIONS.some((permission) => granted.has(permission));
  const canOpenOrClose = granted.has('finance.collection') || granted.has('finance.payment');
  const canRecordExpenseOrTransfer = granted.has('finance.payment');

  return {
    canView,
    canOpenOrClose,
    canRecordExpenseOrTransfer,
    isReadOnly: canView && !canOpenOrClose && !canRecordExpenseOrTransfer,
  };
}
