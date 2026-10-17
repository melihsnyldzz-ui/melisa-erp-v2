import {get} from './apiClient.js';
// Prepared authenticated read transport; no write or current-product-price fallback.
export function fetchSupplierReturnPrice(query,options={}){
 if(!query||Object.keys(query).some(k=>!['source','productId','unit','currency'].includes(k))
  ||query.source!=='PROMPT-2-20260923-01'||typeof query.productId!=='string'
  ||!/^[1-9]\d{0,18}$/.test(query.productId)||BigInt(query.productId)>9223372036854775807n
  ||typeof query.unit!=='string'||!query.unit.trim()||query.unit.length>50
  ||!['TRY','USD','EUR'].includes(query.currency))throw Error('İade fiyatı ürün/birim/döviz bağlamı geçersiz.');
 return get(`/api/supplier-returns/price-context/${query.productId}`,{source:query.source,unit:query.unit,currency:query.currency},options);
}

