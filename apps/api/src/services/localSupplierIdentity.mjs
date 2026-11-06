// Pure projection; callers must supply same-transaction persisted readback.
const fail=()=>{throw Error('LOCAL_SUPPLIER_IDENTITY_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&BigInt(v)<=9223372036854775807n;
function record(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(v);if(own.length!==keys.length||keys.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value'))||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail();return Object.fromEntries(keys.map(k=>[k,d[k].value]));}
export function localSupplierIdentity(input){
 const outer=record(input,['supplier','entity','account']),supplier=record(outer.supplier,['id','entityId','currency']),entity=record(outer.entity,['id','role']),account=record(outer.account,['id','entityId','customerId','supplierId','currency','currentBalanceExact8']);
 if(!supplier||!entity||!account||!id(supplier.id)||!id(supplier.entityId)||!id(entity.id)||!id(account.id)||supplier.entityId!==entity.id||entity.role!=='supplier'||account.entityId!==entity.id||account.supplierId!==supplier.id||account.customerId!==null||account.currency!==supplier.currency||typeof supplier.currency!=='string'||!/^[A-Z]{3}$/.test(supplier.currency)||account.currentBalanceExact8!=='0.00000000')fail();
 return Object.freeze({kind:'local',id:supplier.id,entityId:entity.id,selectedCurrency:supplier.currency,accounts:Object.freeze([Object.freeze({id:account.id,supplierId:supplier.id,currency:account.currency,currentBalanceExact8:account.currentBalanceExact8})])});
}
