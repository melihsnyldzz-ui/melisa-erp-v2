// Keep the existing weighted-cost rule, including its non-positive stock policy.
export function calculateWeightedAverageCostTry({ currentStock, currentAverageCostTry, purchaseQuantity, purchaseAmountTry }) {
  if (purchaseQuantity <= 0) return 0;
  const incomingUnitCostTry = purchaseAmountTry / purchaseQuantity;
  if (currentStock <= 0) return incomingUnitCostTry;
  const nextStock = currentStock + purchaseQuantity;
  if (nextStock <= 0) return incomingUnitCostTry;
  return ((currentStock * currentAverageCostTry) + purchaseAmountTry) / nextStock;
}

// Invoice rows share one initial SQL snapshot. Repeated products must continue
// from the preceding row's state, not reuse that initial stock and cost.
export function createPurchaseCostAccumulator() {
  const products = new Map();
  return ({ productId, currentStock, currentAverageCostTry, purchaseQuantity, purchaseAmountTry }) => {
    const key = String(productId);
    const previous = products.get(key) || { currentStock, currentAverageCostTry };
    const nextStock = previous.currentStock + purchaseQuantity;
    const nextAverageCostTry = calculateWeightedAverageCostTry({ ...previous, purchaseQuantity, purchaseAmountTry });
    products.set(key, { currentStock: nextStock, currentAverageCostTry: nextAverageCostTry });
    return { ...previous, nextStock, nextAverageCostTry };
  };
}
