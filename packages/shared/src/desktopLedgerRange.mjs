// Statement totals describe the selected account and inclusive date range, never its opening balance.
const plain=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
export function isDesktopLedgerDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number),leap=year%4===0&&(year%100!==0||year%400===0);
 return year>=1900&&month>=1&&month<=12&&day>=1&&day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
export function isDesktopLedgerRange(value){
 try{return plain(value,['fromDate','toDate'])&&(value.fromDate===null||isDesktopLedgerDate(value.fromDate))&&(value.toDate===null||isDesktopLedgerDate(value.toDate))&&(value.fromDate===null||value.toDate===null||value.fromDate<=value.toDate);}catch{return false;}
}
const exact=(value,signed=true,width=30)=>typeof value==='string'&&new RegExp(`^${signed?'-?':''}(?:0|[1-9]\\d{0,${width-1}})\\.\\d{8}$`).test(value)&&value!=='-0.00000000';
const units=value=>BigInt(value.replace('.',''));
export function isDesktopLedgerSummary(value,{rows,page,hasNext,range}={}){
 try{
  if(!plain(value,['movementCount','debitExact8','creditExact8','netExact8'])||typeof value.movementCount!=='string'||!/^(?:0|[1-9]\d{0,18})$/.test(value.movementCount)||BigInt(value.movementCount)>9223372036854775807n||!exact(value.debitExact8,false)||!exact(value.creditExact8,false)||!exact(value.netExact8)||!Array.isArray(rows)||rows.length>10||!Number.isInteger(page)||page<1||page>100000||typeof hasNext!=='boolean'||!isDesktopLedgerRange(range))return false;
  const debit=units(value.debitExact8),credit=units(value.creditExact8),count=BigInt(value.movementCount),offset=BigInt(page-1)*10n,remaining=count>offset?count-offset:0n,expected=remaining>10n?10n:remaining;
  if(debit-credit!==units(value.netExact8)||BigInt(rows.length)!==expected||hasNext!==(remaining>10n))return false;
  let pageDebit=0n,pageCredit=0n;
  for(const row of rows){
   if(!row||typeof row!=='object')return false;
   const date=Object.getOwnPropertyDescriptor(row,'documentDate'),effect=Object.getOwnPropertyDescriptor(row,'balanceEffectExact8');
   if(!date||!Object.hasOwn(date,'value')||!effect||!Object.hasOwn(effect,'value')||!isDesktopLedgerDate(date.value)||range.fromDate!==null&&date.value<range.fromDate||range.toDate!==null&&date.value>range.toDate||!exact(effect.value,true,20))return false;
   const amount=units(effect.value);if(amount>=0n)pageDebit+=amount;else pageCredit-=amount;
  }
  if(pageDebit>debit||pageCredit>credit)return false;
  if(count===0n&&(debit!==0n||credit!==0n))return false;
  if(page===1&&!hasNext&&(pageDebit!==debit||pageCredit!==credit))return false;
  return true;
 }catch{return false;}
}
