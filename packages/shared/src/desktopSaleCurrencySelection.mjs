const fail=()=>{throw Object.assign(Error('DESKTOP_FX_SELECTION_INVALID'),{code:'DESKTOP_FX_SELECTION_INVALID'});};
export function desktopSaleCurrencySelection(value){
 const keys=['documentCurrency','accountId','documentRateExact8','accountRateExact8','documentRateMode','accountRateMode'];
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();
 if(!['TRY','USD','EUR'].includes(value.documentCurrency)||typeof value.accountId!=='string'||! /^[1-9]\d{0,15}$/.test(value.accountId)||BigInt(value.accountId)>9007199254740991n)fail();
 for(const name of ['documentRateExact8','accountRateExact8'])if(typeof value[name]!=='string'||!/^(?:0|[1-9]\d{0,9})\.\d{8}$/.test(value[name])||BigInt(value[name].replace('.',''))<1n||BigInt(value[name].replace('.',''))>9007199254740991n)fail();
 if(!['documentRateMode','accountRateMode'].every(k=>['system','company','override','stored'].includes(value[k]))||value.documentCurrency==='TRY'&&(value.documentRateExact8!=='1.00000000'||value.documentRateMode!=='system')||value.documentCurrency!=='TRY'&&value.documentRateMode==='system')fail();return Object.freeze(Object.fromEntries(keys.map(k=>[k,value[k]])));
}
