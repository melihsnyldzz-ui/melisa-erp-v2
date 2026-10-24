const sourceStates=new Set(['accepted-opening','unmapped','ambiguous','unknown','synthetic']);
const confidenceStates=new Set(['source-matched','native-unverified','unknown','quarantined','drift','verified-native']);
const decimal=/^-?\d{1,28}(?:\.\d{1,8})?$/;
const invalid=()=>{throw Error('Müşteri kartı yanıtı doğrulanamadı. Yeniden deneyin.');};
const nullableText=v=>v===null||typeof v==='string';
export function exactBalance(value){
 if(value===null)return 'Bilinmiyor';
 if(typeof value!=='string'||!decimal.test(value))return invalid();
 const [whole,fraction]=value.split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction?','+fraction:'');
}
export function balanceDirection(value){
 if(value===null)return 'Bilinmiyor';
 exactBalance(value);
 if(!/[1-9]/.test(value))return 'Borç / alacak yok';
 return value.startsWith('-')?'Müşterinin alacağı':'Müşterinin borcu';
}
export function accountConfidence(account){
 return ({'verified-native':'Kayıtlı hesap · Hareketlerle doğrulandı','source-matched':account.reconciled===true?'Kaynak açılış eşleşti · Güncel bakiye mutabık':'Kaynak açılış eşleşti · Güncel bakiye doğrulanmadı','native-unverified':'Kayıtlı hesap · Doğrulanmadı',unknown:'Bilinmiyor',quarantined:'Karantina · İşlem kapalı',drift:'Kayıt farkı · Doğrulanmadı'})[account.confidence]??invalid();
}
export function cardSourceLabel(status){return ({synthetic:'Örnek müşteri','accepted-opening':'Kaynak açılış eşleşti',unmapped:'Kaynak eşlemesi bulunamadı',ambiguous:'Kaynak eşlemesi belirsiz',unknown:'Kaynak bilgisi bilinmiyor'})[status]??invalid();}
export function validateCustomerCard(row,{detail=false}={}){
 if(!row||!(/^[1-9]\d*$/.test(String(row.id)))||typeof row.customerCode!=='string'||!nullableText(row.customerName)||typeof row.isPassive!=='boolean'||![true,false,null].includes(row.quarantine?.blocked)||!Array.isArray(row.quarantine?.reasons)||row.quarantine.reasons.some(r=>typeof r!=='string'||!r)||!sourceStates.has(row.source?.status)||!nullableText(row.source?.sourceAsOf)||row.source?.freshLive!==false||!Array.isArray(row.accounts)||row.accountCount!==row.accounts.length||typeof row.hasUnknownAccounts!=='boolean')invalid();
 const seen=new Set();
 for(const a of row.accounts){
  if(!a||!(a.accountId===null||typeof a.accountId==='string'&&/^[1-9]\d*$/.test(a.accountId))||!nullableText(a.currency)||!confidenceStates.has(a.confidence)||!nullableText(a.sourceStatus)||!nullableText(a.sourceAsOf)||![true,false,null].includes(a.reconciled))invalid();
  for(const key of ['balanceExact','nativeBalanceExact','sourceOpeningBalanceExact'])if(a[key]!==null&&(typeof a[key]!=='string'||!decimal.test(a[key])))invalid();
  if(a.balanceExact!==null&&(a.reconciled!==true||!(a.confidence==='source-matched'||a.confidence==='verified-native'&&row.source.status==='synthetic'&&a.nativeCustomerId===String(row.id))||a.currency===null||row.quarantine.blocked!==false))invalid();
  if(a.accountId!==null){if(seen.has(a.accountId))invalid();seen.add(a.accountId);}
 }
 if(detail&&(!row.fields||['phoneMasked','city','country','note'].some(k=>!nullableText(row.fields[k]))))invalid();
 return row;
}
export function customerListEnvelope(payload){
 const m=payload?.meta;
 if(payload?.success!==true||!Array.isArray(payload.data)||m?.readOnly!==true||!(m?.sourceAsOf==='2026-09-30'||m?.sourceAsOf===null&&m.environment==='CLEAN_SYNTHETIC_TEST'&&m.environmentId==='e662fd94-d797-4b3b-938a-d143ad758b67'&&m.synthetic===true&&m.actualT1===false&&m.externalOperations===false)||m?.freshLive!==false||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==25||payload.data.length>m.limit)invalid();
 payload.data.forEach(r=>validateCustomerCard(r));
 if(new Set(payload.data.map(r=>String(r.id))).size!==payload.data.length)invalid();
 return payload;
}
export function customerListPath({search='',page=1,status='all',quarantine='all'}={}){
 if(typeof search!=='string'||search.length>120||!Number.isInteger(page)||page<1||!['all','active','passive'].includes(status)||!['all','included','excluded'].includes(quarantine))invalid();
 return '/api/customer-cards?'+new URLSearchParams({search,page:String(page),limit:'25',status,quarantine});
}
// Each new selection invalidates earlier asynchronous work; disposal also revokes it.
export function customerRequestGate(){let version=0,active=true;return {next:()=>++version,current:n=>active&&n===version,dispose:()=>{active=false;version++;}};}
