// Local master-data domain projection. This module does not connect to SQL,
// perform writes, authorize requests, or certify the source of supplied rows.
// Local unit IDs refer to locally persisted unit records, never Vega source IDs.
const invalid=()=>{throw Object.assign(new Error('Yerel kart kimliği veya ilişkisi geçersiz.'),{code:'LOCAL_MASTER_IDENTITY_INVALID'});};
const maxId=9223372036854775807n;
function id(value){
 if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||BigInt(value)>maxId)invalid();
 return value;
}
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();
 const d=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
 if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)
  ||own.some(k=>typeof k!=='string'||!keys.includes(k)))invalid();
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function text(value,max){if(typeof value!=='string'||value.trim()!==value||!value||value.length>max||/[\u0000-\u001f\u007f]/.test(value))invalid();return value;}
// Syntax only: availability and authorization of currencies belong to the UI
// and transaction layer; this function never supplies a default currency.
function currency(value){if(typeof value!=='string'||!/^[A-Z]{3}$/.test(value))invalid();return value;}
function decimal8(value,{nullable=false,nonnegative=false,positive=false}={}){
 if(value===null&&nullable)return null;
 if(typeof value!=='string'||!/^\-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(value))invalid();
 const n=BigInt(value.replace('.',''));
 if(nonnegative&&n<0n||positive&&n<=0n)invalid();
 return value;
}
function onePerKey(items,key){if(new Set(items.map(key)).size!==items.length)invalid();}

// These projections are deliberately separate from the legacy/source-bound
// catalog and customer DTOs. The caller must read every row from one verified
// local transaction; this module alone cannot prove row origin or durability.
export const LOCAL_MASTER_IDENTITY_LIMITS=Object.freeze({sqlExecuted:false,writesEnabled:false,
 validatesSourceOrigin:false,requiresVerifiedTransaction:true,legacyReadersCompatible:false,
 priceTuplePolicy:'STRUCTURAL_ONLY',confirmsPriceEligibility:false});

export function localProductIdentity(input){
 const {product,units,prices}=record(input,['product','units','prices']);
 const p=record(product,['id','name']),productId=id(p.id),name=text(p.name,250);
 if(!Array.isArray(units)||!units.length||!Array.isArray(prices))invalid();
 const unitRows=units.map(raw=>{
  const u=record(raw,['id','productId','label','factorExact8','isMain']);
  if(id(u.productId)!==productId||typeof u.isMain!=='boolean')invalid();
  const factor=decimal8(u.factorExact8,{positive:true});
  if(u.isMain&&factor!=='1.00000000')invalid();
  return Object.freeze({id:id(u.id),label:text(u.label,80),factorExact8:factor,isMain:u.isMain});
 });
 onePerKey(unitRows,u=>u.id);
 if(unitRows.filter(u=>u.isMain).length!==1)invalid();
 const unitIds=new Set(unitRows.map(u=>u.id));
 const priceRows=prices.map(raw=>{
  const q=record(raw,['id','productId','type','unitId','tier','currency','priceExact8']);
  // Preserve stored tuple shape; each operation's existing consumer decides
  // which sale/purchase tier and unit combination is actually selectable.
  // Native price_tier is a nullable SQL int. Preserve an unknown tier without
  // asserting that this tuple is eligible for any particular operation.
  if(id(q.productId)!==productId||(q.tier!==null&&(!Number.isInteger(q.tier)||q.tier< -2147483648||q.tier>2147483647))
   ||!['sale','purchase'].includes(q.type)||(q.unitId!==null&&!unitIds.has(id(q.unitId))))invalid();
  return Object.freeze({id:id(q.id),type:q.type,unitId:q.unitId,tier:q.tier,currency:currency(q.currency),
   priceExact8:decimal8(q.priceExact8,{nullable:true,nonnegative:true})});
 });
 onePerKey(priceRows,q=>q.id);
 onePerKey(priceRows,q=>JSON.stringify([q.type,q.unitId,q.tier,q.currency]));
 return Object.freeze({kind:'local',id:productId,name,units:Object.freeze(unitRows),prices:Object.freeze(priceRows)});
}

export function localCustomerIdentity(input){
 const {customer,entity,accounts}=record(input,['customer','entity','accounts']);
 const c=record(customer,['id','entityId','currency']),e=record(entity,['id','role']);
 const customerId=id(c.id),entityId=id(c.entityId),selectedCurrency=currency(c.currency);
 if(id(e.id)!==entityId||e.role!=='customer'||!Array.isArray(accounts)||!accounts.length)invalid();
 const accountRows=accounts.map(raw=>{
  const a=record(raw,['id','entityId','customerId','supplierId','currency','currentBalanceExact8']);
  if(id(a.entityId)!==entityId||(a.customerId!==null&&id(a.customerId)!==customerId)||a.supplierId!==null)invalid();
  return Object.freeze({id:id(a.id),customerId:a.customerId,currency:currency(a.currency),
   currentBalanceExact8:decimal8(a.currentBalanceExact8,{nullable:true})});
 });
 onePerKey(accountRows,a=>a.id);onePerKey(accountRows,a=>a.currency);
 if(!accountRows.some(a=>a.currency===selectedCurrency))invalid();
 return Object.freeze({kind:'local',id:customerId,entityId,selectedCurrency,accounts:Object.freeze(accountRows)});
}
