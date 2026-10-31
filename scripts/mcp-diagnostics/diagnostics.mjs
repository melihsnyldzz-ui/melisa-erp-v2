// Deliberately read-only. These tools do not send sales, retry, install, or run SQL supplied by callers.
export const database = 'MELISA_ERP_SIRKET_TEST_20260929_01';
export const serverName = 'Semih\\MELISADEV';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const schema = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const request = {requestId:{type:'string',pattern:uuid.source,description:'Mevcut satış isteğinin özgün UUID değeri; yeni işlem oluşturmaz.'}};
export const diagnosticTools = [
  {name:'get_runtime_status',description:'Güncel 5244 TEST satış ortamının API/native/web süreçlerini, kurulu kaynak sürümlerini ve salt okunur SQL bağlantısını doğrular. Satış kabulü sayılmaz.',inputSchema:schema({})},
  {name:'diagnose_sale_request',description:'Tek özgün satış UUID değeri için journal/fiş bağlantısını ve mevcut yapılandırılmış hata kayıtlarını okur. Eksik kayıt başarısızlık/rollback veya yeniden gönderme yetkisi değildir. Ham payload ve kişisel veri döndürmez.',inputSchema:schema(request)},
  {name:'verify_sale_effects',description:'Mevcut UUID ile bağlı fiş, ürün bazında stok hareketi ve cari hareketini birlikte karşılaştırır. Taslak, kesinleşme, iptal ve bilinmeyen ayrıdır; satış göndermez ve ekran kabulü yapmaz.',inputSchema:schema(request)},
].map(tool=>({...tool,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
const demand = (ok,code) => {if(!ok)throw Object.assign(new Error(code),{code});};
export function validateArguments(name,args) {
  const definition=diagnosticTools.find(t=>t.name===name);
  demand(definition&&args&&typeof args==='object'&&!Array.isArray(args),'DIAGNOSTIC_ARGUMENTS_REJECTED');
  demand(Object.keys(args).sort().join(',')===definition.inputSchema.required.join(','),'DIAGNOSTIC_ARGUMENTS_REJECTED');
  if(name!=='get_runtime_status')demand(typeof args.requestId==='string'&&uuid.test(args.requestId),'DIAGNOSTIC_UUID_REJECTED');
  return args.requestId?.toLowerCase();
}
const errorCode = value => /^DIAGNOSTIC_[A-Z_]{1,80}$/.test(value??'')?value:'DIAGNOSTIC_READ_UNAVAILABLE';
const integer = v => Number.isSafeInteger(Number(v))&&Number(v)>0;
const bit = v => v===true||v===1||v==='true';
function decimal(v) {
  demand(typeof v==='string'&&/^-?\d{1,20}\.\d{1,8}$/.test(v),'DIAGNOSTIC_DECIMAL_INVALID');
  const negative=v.startsWith('-'),[whole,fraction]=v.replace(/^-/,'').split('.');
  return BigInt(whole+fraction.padEnd(8,'0'))*(negative?-1n:1n);
}
function safeSnapshot(snapshot,requestId) {
  demand(snapshot&&snapshot.readOnly===true,'DIAGNOSTIC_READER_REQUIRED');
  if(snapshot.error)throw Object.assign(new Error(errorCode(snapshot.error)),{code:errorCode(snapshot.error)});
  const id=snapshot.identity;
  demand(id?.databaseName===database&&id.serverName===serverName&&id.loginName==='melisa_sirket_test_20260929_01'&&id.sysadmin===0&&id.databaseControl===0&&id.elevatedPermissions===0,'DIAGNOSTIC_READER_IDENTITY_REJECTED');
  demand(Array.isArray(snapshot.permissions)&&snapshot.permissions.length===7&&snapshot.permissions.every(p=>p.canRead===1&&p.canInsert===0&&p.canUpdate===0&&p.canDelete===0),'DIAGNOSTIC_READER_PERMISSIONS_REJECTED');
  if(requestId)demand(snapshot.requestId===requestId&&snapshot.consistency==='serializable-bounded-read'&&Array.isArray(snapshot.journal)&&Array.isArray(snapshot.invoices),'DIAGNOSTIC_REQUEST_MISMATCH');
  return snapshot;
}
export function assessRuntime(processBefore,health,processAfter) {
  const ports={erp:4144,native:4146,web:5244};
  const services=Object.entries(ports).map(([role,port])=>{
    const a=processBefore.find(p=>p.role===role),b=processAfter.find(p=>p.role===role),h=health[role];
    const processVerified=!!(a?.verified&&b?.verified&&a.port===port&&b.port===port&&a.pid===b.pid&&a.startedAt===b.startedAt);
    const healthVerified=role==='web'?h?.httpOk===true:!!(h?.ok===true&&h.environment==='CANONICAL_TEST'&&h.mode===role&&h.port===port&&h.databaseName===database&&h.serverName===serverName&&h.sysadmin===0&&h.databaseControl===0&&h.sqlReadOnly===(role==='native')&&(role==='native'||h.actualT1===false));
    return {role,port,pid:processVerified?b.pid:null,processVerified,healthVerified,releaseDirectory:processVerified?b.release??null:null,
      reportedPackageId:healthVerified&&typeof h?.packageId==='string'?h.packageId:null,
      reportedSourceCommit:healthVerified&&/^[a-f0-9]{40}$/.test(h?.sourceCommit??'')?h.sourceCommit:null};
  });
  return {verified:services.every(s=>s.processVerified&&s.healthVerified),services};
}
// Only allowlisted structured fields survive. Log prose, request bodies, tokens,
// customer names and SQL text are never returned, even if a log entry contains them.
export function summarizeEvents(texts,requestId) {
  const events=[];
  for(const text of texts)for(const line of text.split(/\r?\n/)){
    if(line.length>32768||!line.includes(requestId))continue;
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(event?.requestId?.toLowerCase()!==requestId)continue;
    const code=[event.code,event.errorCode,event.error?.code].find(v=>typeof v==='string'&&/^(?:EREQUEST|ETIMEOUT|B6_[A-Z0-9_]{1,80}|WORK_[A-Z0-9_]{1,80}|CANONICAL_[A-Z0-9_]{1,80})$/.test(v));
    if(!code)continue;
    const number=event.sqlNumber??event.error?.number;
    events.push({code,...(Number.isInteger(number)?{sqlNumber:number}:{})});
    if(events.length===10)return events;
  }
  return events;
}
export function assessSale(snapshot,requestId) {
  const s=safeSnapshot(snapshot,requestId);
  if(s.journal.length===0&&s.invoices.length===0)return {state:'unknown',reason:'REQUEST_NOT_RECORDED',receipt:'not_established',stock:'not_established',customerLedger:'not_established',saleCompleted:false};
  demand(s.journal.length===1&&s.invoices.length===1,'DIAGNOSTIC_REQUEST_LINK_CONFLICT');
  const j=s.journal[0],{header:h,creation,items,stock,ledger,account}=s.invoices[0];
  demand(['sale_draft','sale_finalize','sale_cancel'].includes(j.operation)&&String(j.actorId)==='17'&&String(j.invoiceId)===h.invoiceId,'DIAGNOSTIC_JOURNAL_MISMATCH');
  const recordedStates={sale_draft:'draft',sale_finalize:'finalized',sale_cancel:'cancelled'};
  demand(j.recordedStatus===recordedStates[j.operation]&&creation?.length===1&&creation[0].verified===true,'DIAGNOSTIC_CREATION_BINDING_MISMATCH');
  demand((j.operation!=='sale_cancel'||h.status==='cancelled')&&(j.operation!=='sale_finalize'||h.status!=='draft'),'DIAGNOSTIC_JOURNAL_STATE_MISMATCH');
  demand(['draft','finalized','cancelled'].includes(h.status)&&integer(h.invoiceId)&&integer(h.customerId)&&integer(h.accountId)&&['TRY','USD','EUR'].includes(h.currency),'DIAGNOSTIC_INVOICE_INVALID');
  demand(Array.isArray(items)&&items.length>0&&items.length<=200&&Array.isArray(stock)&&Array.isArray(ledger)&&Array.isArray(account),'DIAGNOSTIC_EFFECT_SHAPE_INVALID');
  demand(new Set(items.map(i=>i.productId)).size===items.length&&items.every(i=>integer(i.productId)&&integer(i.rowCount)&&decimal(i.quantityExact)>0n),'DIAGNOSTIC_ITEMS_INVALID');
  const accountMatches=account.length===1&&account[0].accountId===h.accountId&&account[0].customerId===h.customerId&&account[0].currency===h.currency;
  const expected=new Map(items.map(i=>[i.productId,{quantity:decimal(i.quantityExact),rows:Number(i.rowCount)}]));
  if(h.status==='cancelled'&&stock.length===0&&ledger.length===0)return {state:'unknown',reason:'CANCELLATION_ORIGIN_NOT_ESTABLISHED',invoiceId:h.invoiceId,invoiceStatus:h.status,receipt:'database_record_found',stock:'no_movements',customerLedger:'no_movements',saleCompleted:false};
  const cancelledWithEffects=h.status==='cancelled';
  const kinds=h.status==='finalized'?['out']:cancelledWithEffects?['out','in']:[];
  const stockMatches=stock.length===items.length*kinds.length&&stock.every(m=>{
    const e=expected.get(m.productId);return e&&kinds.includes(m.kind)&&bit(m.affectsInventory)&&Number(m.rowCount)===e.rows&&decimal(m.quantityExact)===(m.kind==='out'?-e.quantity:e.quantity);
  })&&new Set(stock.map(m=>`${m.productId}:${m.kind}`)).size===stock.length;
  const ledgerKinds=h.status==='finalized'?['sales_invoice']:cancelledWithEffects?['sales_invoice','sales_invoice_cancel']:[];
  const total=decimal(h.totalExact);
  const ledgerMatches=total>0n&&accountMatches&&ledger.length===ledgerKinds.length&&ledger.every(m=>ledgerKinds.includes(m.kind)&&m.customerId===h.customerId&&m.accountId===h.accountId&&m.currency===h.currency&&bit(m.affectsBalance)&&Number(m.rowCount)===1&&decimal(m.amountExact)===(m.kind==='sales_invoice_cancel'?-total:total))&&new Set(ledger.map(m=>m.kind)).size===ledger.length;
  const good=stockMatches&&ledgerMatches;
  return {state:good?'consistent':'mismatch',operation:j.operation,invoiceId:h.invoiceId,invoiceStatus:h.status,
    receipt:'database_record_found',stock:stockMatches?'consistent':'mismatch',customerLedger:ledgerMatches?'consistent':'mismatch',
    saleCompleted:good&&h.status==='finalized',normalScreenAcceptance:'not_assessed',
    ...(h.status==='cancelled'?{cancellation:good?'reversed_movements':'reversal_mismatch'}:{})};
}
export function createDiagnostics({readProcesses,readHealth,readSql,readLogTails=async()=>[]}) {
  return async(name,args)=>{
    const requestId=validateArguments(name,args);
    const common={scope:'business-5244-test-read-only',observedAt:new Date().toISOString(),commercialWrites:0,retryAuthorized:false};
    try{
      if(name==='get_runtime_status'){
        const before=await readProcesses();
        const [health,sql]=await Promise.all([readHealth(),readSql()]);
        const runtime=assessRuntime(before,health,await readProcesses());
        let sqlReader;try{safeSnapshot(sql);sqlReader={verified:true,database,serverName,readOnly:true};}catch(e){sqlReader={verified:false,error:errorCode(e.code),readOnly:true};}
        return {...common,...runtime,verified:runtime.verified&&sqlReader.verified,sqlReader,webSourceVersion:'not_exposed_by_web_health',commercialFlowVerified:false};
      }
      const [snapshot,texts]=await Promise.all([readSql(requestId),name==='diagnose_sale_request'?readLogTails():[]]);
      const outcome=assessSale(snapshot,requestId);
      const events=name==='diagnose_sale_request'?summarizeEvents(texts,requestId):undefined;
      return {...common,requestId,...outcome,...(events?{recordedErrors:events,errorCause:events.length?'recorded_codes_only':'not_recorded_in_available_logs'}:{})};
    }catch(e){return {...common,requestId,state:'unknown',error:errorCode(e.code),saleCompleted:false};}
  };
}
