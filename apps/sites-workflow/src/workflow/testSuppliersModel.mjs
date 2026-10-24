const sourceStates=new Set(['accepted-opening','unmapped','ambiguous','unknown','synthetic']);
const confidenceStates=new Set(['source-matched','native-unverified','unknown','quarantined','drift','verified-native']);
const decimal=/^-?\d{1,28}(?:\.\d{1,8})?$/;
const invalid=()=>{throw Error('Tedarikçi kartı yanıtı doğrulanamadı. Yeniden deneyin.');};
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
 return value.startsWith('-')?'Melisa’nın tedarikçiden alacağı':'Melisa’nın tedarikçiye borcu';
}
export function accountConfidence(account){
 return ({'verified-native':'Kayıtlı hesap · Hareketlerle doğrulandı','source-matched':account.reconciled===true?'Kaynak açılış eşleşti · Güncel bakiye mutabık':'Kaynak açılış eşleşti · Güncel bakiye doğrulanmadı','native-unverified':'Kayıtlı hesap · Doğrulanmadı',unknown:'Bilinmiyor',quarantined:'Karantina · İşlem kapalı',drift:'Kayıt farkı · Doğrulanmadı'})[account.confidence]??invalid();
}
export function cardSourceLabel(status){return ({synthetic:'Örnek tedarikçi','accepted-opening':'Kaynak açılış eşleşti',unmapped:'Kaynak eşlemesi bulunamadı',ambiguous:'Kaynak eşlemesi belirsiz',unknown:'Kaynak bilgisi bilinmiyor'})[status]??invalid();}
export function validateSupplierCard(row,{detail=false}={}){
 if(!row||!(/^[1-9]\d*$/.test(String(row.id)))||typeof row.supplierCode!=='string'||!nullableText(row.supplierName)||typeof row.isPassive!=='boolean'||![true,false,null].includes(row.quarantine?.blocked)||!Array.isArray(row.quarantine?.reasons)||row.quarantine.reasons.some(r=>typeof r!=='string'||!r)||!sourceStates.has(row.source?.status)||!nullableText(row.source?.sourceAsOf)||row.source?.freshLive!==false||!Array.isArray(row.accounts)||row.accountCount!==row.accounts.length||typeof row.hasUnknownAccounts!=='boolean')invalid();
 const seen=new Set();
 for(const a of row.accounts){
  if(!a||!(a.accountId===null||typeof a.accountId==='string'&&/^[1-9]\d*$/.test(a.accountId))||!nullableText(a.currency)||!confidenceStates.has(a.confidence)||!nullableText(a.sourceStatus)||!nullableText(a.sourceAsOf)||![true,false,null].includes(a.reconciled))invalid();
  for(const key of ['balanceExact','nativeBalanceExact','sourceOpeningBalanceExact'])if(a[key]!==null&&(typeof a[key]!=='string'||!decimal.test(a[key])))invalid();
  if(a.balanceExact!==null&&(a.reconciled!==true||!(a.confidence==='source-matched'||a.confidence==='verified-native'&&row.source.status==='synthetic'&&a.nativeSupplierId===String(row.id))||a.currency===null||row.quarantine.blocked!==false))invalid();
  if(a.accountId!==null){if(seen.has(a.accountId))invalid();seen.add(a.accountId);}
 }
 if(detail&&(!row.fields||['phoneMasked','city','country'].some(k=>!nullableText(row.fields[k]))))invalid();
 return row;
}
export function supplierListEnvelope(payload){
 const m=payload?.meta;
 if(payload?.success!==true||!Array.isArray(payload.data)||m?.readOnly!==true||!(m?.sourceAsOf==='2026-09-30'||m?.sourceAsOf===null&&m.environment==='CLEAN_SYNTHETIC_TEST'&&m.environmentId==='e662fd94-d797-4b3b-938a-d143ad758b67'&&m.synthetic===true&&m.actualT1===false&&m.externalOperations===false)||m?.freshLive!==false||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||m.limit!==25||payload.data.length>m.limit)invalid();
 payload.data.forEach(r=>validateSupplierCard(r));
 if(new Set(payload.data.map(r=>String(r.id))).size!==payload.data.length)invalid();
 return payload;
}
export function supplierListPath({search='',page=1,status='all',quarantine='all'}={}){
 if(typeof search!=='string'||search.length>120||!Number.isInteger(page)||page<1||!['all','active','passive'].includes(status)||!['all','included','excluded'].includes(quarantine))invalid();
 return '/api/supplier-cards?'+new URLSearchParams({search,page:String(page),limit:'25',status,quarantine});
}
// Each new selection invalidates earlier asynchronous work; disposal also revokes it.
export function supplierRequestGate(){let version=0,active=true;return {next:()=>++version,current:n=>active&&n===version,dispose:()=>{active=false;version++;}};}

export const supplierContactEligible=(actorId,permissions,id)=>String(actorId)==='16'&&String(id)==='13373'&&permissions.includes('supplier.view')&&permissions.includes('supplier.edit');
export function supplierContactContext(value){
 if(value?.fixture?.id!=='13373'||value.fixture.synthetic!==true||value.fixture.currency!=='TRY'||typeof value.fixture.supplierCode!=='string'||typeof value.fixture.supplierName!=='string'||typeof value.revision!=='string'||!/^[A-Fa-f0-9]{64}$/.test(value.revision)||!value.contact)invalid();
 supplierContactFields(value.contact);return value;
}
export function supplierContactFields(value){
 if(!value||Object.keys(value).length!==3||Object.keys(value).some(k=>!['phone','city','country'].includes(k)))invalid();
 for(const [key,max] of [['phone',40],['city',100],['country',100]])if(value[key]!==null&&(typeof value[key]!=='string'||value[key].length>max||/[\u0000-\u001f\u007f]/.test(value[key])))throw Error('Telefon, şehir ve ülke bilgilerini kontrol edin.');
 return {phone:value.phone,city:value.city,country:value.country};
}
export function supplierContactRequest(context,fields,requestId){
 supplierContactContext(context);
 if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))invalid();
 return Object.freeze({requestId,expectedRevision:context.revision,...supplierContactFields(fields)});
}
export function supplierContactJournal(value){
 if(!value||!['dirty','pending','saved','stale'].includes(value.status))invalid();
 supplierContactContext(value.context);supplierContactFields(value.fields);
 if(value.status==='pending'||value.status==='saved'||value.status==='stale'&&value.request){
  const checked=supplierContactRequest(value.context,value.fields,value.request?.requestId);
  if(JSON.stringify(checked)!==JSON.stringify(value.request))invalid();
 }
 return value;
}
export function supplierContactCompletionMatches(current,sent,nextStatus){
 try{supplierContactJournal(current);supplierContactJournal(sent);}catch{return false;}
 if(!current.request||!sent.request||JSON.stringify(current.request)!==JSON.stringify(sent.request))return false;
 // A late rejected response cannot downgrade an identical request already confirmed saved.
 return !(current.status==='saved'&&nextStatus!=='saved');
}
