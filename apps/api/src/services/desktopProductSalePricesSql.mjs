// Same-transaction readback. LEFT JOIN exposes an orphan/mismatched unit;
// never filter bad links away or round a stored eight-decimal price.
export const DESKTOP_PRODUCT_SALE_PRICES_SQL=`SELECT TOP(31) CONVERT(varchar(20),q.id) id,CONVERT(varchar(20),q.product_id) productId,CONVERT(varchar(20),l.unit_id) unitId,q.price_type type,q.price_tier tier,q.currency_code currency,CONVERT(varchar(40),q.price) priceExact8
FROM dbo.product_prices q WITH(HOLDLOCK)
LEFT JOIN dbo.desktop_local_price_units l WITH(HOLDLOCK) ON l.price_id=q.id AND l.product_id=q.product_id
WHERE q.product_id=TRY_CONVERT(bigint,@productId) AND q.price_type=N'sale' ORDER BY q.id;`;
