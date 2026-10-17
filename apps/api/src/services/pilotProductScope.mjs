// Latest card-only review supersedes historical opening eligibility.
export function pilotProductScopeSql(productId){
 if(!/^(?:p\.id|@product|@id)$/.test(productId))throw Error('INVALID_PRODUCT_SCOPE_EXPRESSION');
 return `EXISTS(SELECT 1 FROM (SELECT TOP(1) a.action,a.after_json FROM dbo.audit_logs a WHERE a.entity_type=N'product' AND a.entity_id=${productId} AND a.action IN(N'pilot_product_opening_imported',N'full_stock_product_imported',N'vega_card_imported') ORDER BY a.id DESC) reviewed WHERE reviewed.action<>N'vega_card_imported' OR JSON_VALUE(reviewed.after_json,'$.saleEligible')=N'true')`;
}
