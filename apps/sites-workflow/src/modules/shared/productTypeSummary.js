export function productTypeName(item, product) {
  const values = [item.productType, item.category, item.productCategory, item.categoryName, product?.productType, product?.category];
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || 'Türü belirtilmemiş';
}

export function summarizeProductTypes(items = [], products = []) {
  const catalog = new Map(products.map(product => [String(product.id), product]));
  const groups = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) continue;
    const type = productTypeName(item, catalog.get(String(item.productId)));
    const key = type.toLocaleLowerCase('tr-TR');
    const group = groups.get(key) || { type, quantity: 0, lineCount: 0 };
    group.quantity += quantity;
    group.lineCount += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.quantity - a.quantity || a.type.localeCompare(b.type, 'tr'));
}
