import {createHash} from 'node:crypto';

// Pure inspection only: caller supplies the exact snapshot bytes and expected digest.
// It does not establish the snapshot's origin, freshness, or browser pending state.
const fail=()=>{throw Error('SALES_MANAGER_IMPACT_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const rowId=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):v;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v);
// Conservatively overcount variants of the single known policy source under
// the observed Turkish case-insensitive SQL collation and trailing padding.
const policySource=v=>v.normalize('NFKD').toLowerCase().replace(/\u0307/g,'').replace(/ı/g,'i').trimEnd()==='desktop-sales-policy-v1';
function rows(v){if(typeof v!=='string')fail();let a;try{a=JSON.parse(v);}catch{fail();}if(!Array.isArray(a)||a.some(x=>!obj(x)))fail();return a;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(v))fail();const n=Date.parse(v+'Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,19)!==v)fail();return n;}
function unique(a,key,valid){const set=new Set();for(const x of a){const v=key(x);if(!valid(v)||set.has(v.toLowerCase()))fail();set.add(v.toLowerCase());}return set;}
export function analyzeSalesManagerPolicyImpact({snapshotBytes,expectedSha256}={}){
 if(!(snapshotBytes instanceof Uint8Array)||snapshotBytes.byteLength>8_000_000||!hash(expectedSha256))fail();
 const digest=createHash('sha256').update(snapshotBytes).digest('hex');if(digest!==expectedSha256.toLowerCase())fail();let snapshot;try{snapshot=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(snapshotBytes));}catch{fail();}
 if(!obj(snapshot)||snapshot.state!=='V7_RUNTIME_READ_ONLY_SNAPSHOT_BATCH_COMPLETED'||!obj(snapshot.result)||snapshot.result.state!=='MASTER_V7_READ_ONLY_SNAPSHOT'||typeof snapshot.time!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|\+00:00)$/.test(snapshot.time))fail();date(snapshot.time.slice(0,19));const at=Date.parse(snapshot.time);if(!Number.isFinite(at))fail();const r=snapshot.result;
 const headers=rows(r.allSaleHeadersAuditJson),workflows=rows(r.allSaleWorkflowsJson),requests=rows(r.allSaleRequestsJson),audits=rows(r.auditUserSourceRowsJson),auditHashes=rows(r.auditRowHashesJson),tables=rows(r.businessTablesJson);
 const counts=new Map();for(const t of tables){if(typeof t.table_name!=='string'||!Number.isSafeInteger(t.row_count)||t.row_count<0||counts.has(t.table_name))fail();counts.set(t.table_name,t.row_count);}
 for(const [name,a] of [['sales_invoices',headers],['desktop_sale_workflows',workflows],['desktop_sale_workflow_requests',requests],['audit_logs',audits],['audit_logs',auditHashes]])if(counts.get(name)!==a.length)fail();
 const headerIds=unique(headers,x=>x.invoiceId,id),workflowIds=unique(workflows,x=>rowId(x.invoice_id),id);unique(requests,x=>x.requestId,uuid);const auditIds=unique(audits,x=>x.auditId,id),auditHashIds=unique(auditHashes,x=>x.auditId,id);if(auditIds.size!==auditHashIds.size||[...auditIds].some(x=>!auditHashIds.has(x)))fail();
 for(const h of headers){if(!['draft','finalized','cancelled'].includes(h.status)||!hash(h.rowSha256)||h.createdBy!==null&&!id(h.createdBy)||h.updatedBy!==null&&!id(h.updatedBy)||date(h.createdAtUtc)>at||h.updatedAtUtc!==null&&date(h.updatedAtUtc)>at)fail();}
 for(const w of workflows){const h=headers.find(v=>v.invoiceId===rowId(w.invoice_id));if(!h||!['DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED'].includes(w.state)||h.status==='finalized'&&w.state!=='COMPLETED'||h.status==='cancelled'&&w.state!=='CANCELLED'||h.status==='draft'&&['COMPLETED','CANCELLED'].includes(w.state))fail();}
 if(headerIds.size!==workflowIds.size||[...headerIds].some(x=>!workflowIds.has(x)))fail();
 let pricingMarkers=0;const ops=new Set(['CREATE_DRAFT','PREPARE','SAVE_CARTONS','READY','CHECK','CANCEL','DISPATCH','CANCEL_SALE']);
 for(const q of requests){if(!headerIds.has(q.invoiceId)||!id(q.actorId)||!ops.has(q.operation)||!hash(q.payloadHash)||typeof q.resultJson!=='string')fail();let v;try{v=JSON.parse(q.resultJson);}catch{fail();}if(!obj(v)||v.state!=='COMMITTED'||!uuid(v.requestId)||v.requestId.toLowerCase()!==q.requestId.toLowerCase()||v.invoiceId!==q.invoiceId||v.replayed!==false||typeof v.version!=='string'||!/^0x[0-9a-f]{16}$/i.test(v.version)||!['DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED'].includes(v.workflowState)||v.operation!==undefined&&v.operation!==q.operation)fail();if(Object.hasOwn(v,'pricingProofRequired'))pricingMarkers++;}
 for(const a of audits){if(typeof a.source!=='string'||!a.source||date(a.createdAtUtc)>at)fail();}for(const a of auditHashes)if(!hash(a.rowSha256))fail();
 const openHeaders=headers.filter(h=>h.status==='draft').length,openWorkflows=workflows.filter(w=>!['COMPLETED','CANCELLED'].includes(w.state)).length,pricingAuditRows=audits.filter(a=>policySource(a.source)).length;
 return Object.freeze({state:openHeaders||openWorkflows||pricingMarkers||pricingAuditRows?'VISIBLE_POLICY_DEPENDENCIES_REQUIRE_REVIEW':'NO_VISIBLE_POLICY_DEPENDENCIES',snapshotSha256:digest,snapshotTime:snapshot.time,counts:Object.freeze({headers:headers.length,workflows:workflows.length,requests:requests.length,audits:audits.length,openHeaders,openWorkflows,pricingMarkers,pricingAuditRows}),browserPending:'NOT_OBSERVABLE',previewBehavior:'POLICY_REVISION_CHANGE_INVALIDATES_EXISTING_PREVIEWS',originVerified:false,installAllowed:false});
}
