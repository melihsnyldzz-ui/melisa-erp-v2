// Company-defined rates for an exact business date. No external provider,
// previous-day fallback or implicit USD/EUR=1. Decimal values stay strings.
const fail=()=>{throw Object.assign(Error('DESKTOP_COMPANY_RATE_INVALID'),{code:'DESKTOP_COMPANY_RATE_INVALID'});};
const exact=(v,keys)=>!!(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}));
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const rate=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,9})\.\d{8}$/.test(v)&&BigInt(v.replace('.',''))>0n;
export function desktopCompanyRateDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail();
 const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));if(y<1900||y>9999||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)fail();return value;
}
export function desktopCompanyRates(date,rows){
 desktopCompanyRateDate(date);if(!Array.isArray(rows)||rows.length>2||Reflect.ownKeys(rows).length!==rows.length+1)fail();const byCode=new Map(),ids=new Set();
 for(let i=0;i<rows.length;i++){const descriptor=Object.getOwnPropertyDescriptor(rows,String(i));if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))fail();const row=descriptor.value;
  if(!exact(row,['id','currency','date','rateExact8','source'])||!id(row.id)||!['USD','EUR'].includes(row.currency)||row.date!==date||!rate(row.rateExact8)||row.source!==null&&(typeof row.source!=='string'||row.source.length>50||row.source.trim()!==row.source||/[\u0000-\u001f\u007f]/.test(row.source))||byCode.has(row.currency)||ids.has(row.id))fail();byCode.set(row.currency,row);ids.add(row.id);
 }
 return Object.freeze({date,rates:Object.freeze(['TRY','USD','EUR'].map(currency=>{const row=byCode.get(currency);return Object.freeze({currency,date,defined:currency==='TRY'||!!row,rateExact8:currency==='TRY'?'1.00000000':row?.rateExact8??null,rateId:row?.id??null,source:currency==='TRY'?'system':row?.source??null});}))});
}
export function isDesktopCompanyRates(value,date){
 try{desktopCompanyRateDate(date);if(!exact(value,['date','rates'])||value.date!==date||!Array.isArray(value.rates)||value.rates.length!==3||Reflect.ownKeys(value.rates).length!==4)return false;
  const rows=[];for(let i=0;i<3;i++){const descriptor=Object.getOwnPropertyDescriptor(value.rates,String(i));if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return false;const row=descriptor.value;if(!exact(row,['currency','date','defined','rateExact8','rateId','source'])||row.currency!==['TRY','USD','EUR'][i]||row.date!==date||typeof row.defined!=='boolean')return false;if(i>0&&row.defined)rows.push({id:row.rateId,currency:row.currency,date:row.date,rateExact8:row.rateExact8,source:row.source});}
  const expected=desktopCompanyRates(date,rows);return expected.rates.every((r,i)=>Object.keys(r).every(k=>value.rates[i][k]===r[k]));
 }catch{return false;}
}
// Source preparation only: the future invoice transaction must persist this
// exact immutable selection and verify its native/driver arithmetic separately.
export function selectDesktopCompanyRate({date,currency,suggestions,overrideExact8}={}){
 if(!isDesktopCompanyRates(suggestions,date)||!['TRY','USD','EUR'].includes(currency))fail();const suggested=suggestions.rates.find(r=>r.currency===currency);
 const overridden=overrideExact8!==undefined;if(overridden&&(!rate(overrideExact8)||currency==='TRY'&&overrideExact8!=='1.00000000'))fail();
 if(!overridden&&!suggested.defined)throw Object.assign(Error('DESKTOP_COMPANY_RATE_REQUIRED'),{code:'DESKTOP_COMPANY_RATE_REQUIRED'});
 return Object.freeze({date,currency,rateExact8:overridden?overrideExact8:suggested.rateExact8,source:overridden?'transaction-override':currency==='TRY'?'system':'company-daily',companyRateId:suggested.rateId,companyRateSource:suggested.source});
}
