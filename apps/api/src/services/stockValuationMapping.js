function amount(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    throw new Error('Invalid stock valuation amount');
  }
  return Number(value);
}

export function mapStockValuation(row) {
  const stockQuantity = amount(row.stock_quantity);
  const averageCostTry = amount(row.average_cost_try);
  const salePrice = amount(row.sale_price);
  const currency = row.currency_code || 'UNKNOWN';
  const selectedRate = Number(row.sale_rate_to_try);
  const saleRateToTry = currency === 'TRY' ? 1 : selectedRate > 0 && Number.isFinite(selectedRate) ? selectedRate : null;
  const nativeSaleValue = stockQuantity * salePrice;
  const missingRate = nativeSaleValue !== 0 && saleRateToTry === null;
  const stockValueTry = stockQuantity * averageCostTry;
  const potentialSaleValueTry = missingRate ? null : nativeSaleValue === 0 ? 0 : nativeSaleValue * saleRateToTry;
  const potentialGrossProfitTry = missingRate ? null : potentialSaleValueTry - stockValueTry;
  return {
    productId: row.id, stockCode: row.stock_code, barcode: row.barcode || null,
    productName: row.product_name, brand: row.brand || '', currency,
    stockQuantity, averageCostTry, salePrice, saleRateToTry,
    saleRateDate: row.sale_rate_date || null, missingRate,
    stockValueTry, potentialSaleValueTry, potentialGrossProfitTry,
    profitMargin: missingRate ? null : potentialSaleValueTry > 0 ? potentialGrossProfitTry / potentialSaleValueTry : 0,
    lowStock: stockQuantity <= 5, negativeStock: stockQuantity < 0,
  };
}

export function mapStockValuationSummary(row, currencies) {
  const missingRateProductCount = amount(row.missing_rate_count);
  return {
    totalProductCount: amount(row.total_count),
    totalStockQuantity: amount(row.total_stock_quantity),
    totalStockValueTry: amount(row.total_stock_value_try),
    totalPotentialSaleValueTry: missingRateProductCount ? null : amount(row.total_potential_sale_value_try),
    totalPotentialGrossProfitTry: missingRateProductCount ? null : amount(row.total_potential_gross_profit_try),
    lowStockCount: amount(row.low_stock_count), negativeStockCount: amount(row.negative_stock_count),
    conversion: {
      status: missingRateProductCount ? 'MISSING_RATES' : 'COMPLETE',
      asOfDate: row.as_of_date, ratePolicy: 'LATEST_ON_OR_BEFORE_REPORT_DATE',
      missingRateProductCount,
      missingCurrencies: currencies.filter(item => Number(item.missing_rate_count) > 0).map(item => item.currency_code || 'UNKNOWN'),
      rates: currencies.filter(item => Number(item.sale_rate_to_try) > 0).map(item => ({
        currency: item.currency_code, rateToTry: Number(item.sale_rate_to_try), date: item.sale_rate_date || null,
      })),
    },
  };
}
