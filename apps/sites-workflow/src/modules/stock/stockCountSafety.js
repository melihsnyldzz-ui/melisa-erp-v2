export function isValidCountedQuantity(value) {
  if (
    value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '')
  ) {
    return false;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0;
}

export function isValidStockCountReason(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function canApplyStockCount({
  selectedProduct,
  countedQuantity,
  note,
  isCountConfirmed,
  isApplying,
}) {
  return Boolean(selectedProduct)
    && isValidCountedQuantity(countedQuantity)
    && isValidStockCountReason(note)
    && Boolean(isCountConfirmed)
    && !isApplying;
}
