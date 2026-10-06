const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode})};
const exactKeys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
export function normalizeDailyCountApprovalReason(input){
 const reason=typeof input==='string'?input.trim():'';
 if(reason.length<3||reason.length>500)fail('COUNT_APPROVAL_REASON','Stok farkını uygulamak için onay gerekçesini yazın.');
 return reason;
}
export function normalizeDailyCountLines(input,products){
 if(!Array.isArray(input)||input.length>2)fail('COUNT_LINES','Bir sayımda en fazla iki izinli deneme ürünü seçin.');
 const allowed=new Map(products.map(p=>[String(p.id),p])),seen=new Set();
 return input.map(line=>{
  if(!exactKeys(line,['productId','stockCode','physical','system','reason','movementFingerprint']))fail('COUNT_LINE','Sayım satırında kapsam dışı alan var.');
  const productId=String(line.productId),product=allowed.get(productId);
  if(!product||product.stockCode!==line.stockCode||seen.has(productId))fail('COUNT_PRODUCT_SCOPE','Yalnız izinli ve tekil deneme ürünleri sayılabilir.',403);
  seen.add(productId);
  if(!Number.isSafeInteger(line.physical)||line.physical<0||line.physical>30||!Number.isFinite(line.system)||line.system<0||line.system>40)fail('COUNT_QUANTITY','Sayılan miktar izinli tam adet aralığında değil.');
  if(typeof line.movementFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(line.movementFingerprint))fail('COUNT_FINGERPRINT','Stok hareketi kontrolü yenilenmeli.',409);
  const reason=typeof line.reason==='string'?line.reason.trim():'';
  if(line.physical!==line.system&&(reason.length<3||reason.length>500))fail('COUNT_REASON','Fark için en az üç karakterlik açıklama gerekli.');
  return {productId,stockCode:product.stockCode,physical:line.physical,system:line.system,reason,fingerprint:line.movementFingerprint};
 });
}
export function normalizeUnknownCountScans(input){
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>100)fail('COUNT_UNKNOWN','Bilinmeyen okutma listesi geçersiz.');
 return input.map(item=>{const value=typeof item==='string'?item:item?.value,quantity=typeof item==='string'?1:item?.quantity;if(typeof value!=='string'||value.trim().length<1||value.trim().length>64||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||typeof item==='object'&&(!exactKeys(item,['value','quantity','status'])||item.status!=='needs_review'))fail('COUNT_UNKNOWN','Bilinmeyen barkod doğrulanamadı.');return {value:value.trim(),quantity,status:'needs_review'};});
}
