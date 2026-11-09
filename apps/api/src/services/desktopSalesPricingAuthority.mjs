// Trusted configuration and append-only audit records are read from the same
// registered writer transaction. An audit id supplied by HTTP is not proof.
import {createHash,randomUUID} from 'node:crypto';
import {normalizeDesktopSalePricing} from '../../../../packages/shared/src/desktopSalePricing.mjs';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
import {desktopCompanyRateDate} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {isDesktopSeriesSelection} from '../../../../packages/shared/src/desktopSeriesUnits.mjs';
const fail=(code='DESKTOP_SALES_PRICING_REJECTED')=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const shape=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const clone=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v)),'utf8').digest('hex');
const rate=v=>typeof v==='string'&&/^(?:0|[1-9]\d?)\.\d{4}$/.test(v)&&BigInt(v.replace('.',''))<1000000n;
const positive=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{3}$/.test(v)&&BigInt(v.replace('.',''))>0n&&BigInt(v.replace('.',''))<=9007199254740991n;
const actions=Object.freeze({request:'sales.discount.request',approval:'sales.discount.approved',bound:'sales.pricing.bound',resolution:'sales.discount.resolved'});
export function normalizeDesktopPricingIntent(raw){
 const fx=Object.hasOwn(raw??{},'currencySelection'),keys=['customerId','documentDate','expectedRevision','items','discountRateExact4','pricing',...(fx?['currencySelection']:[])];
 const value=clone(raw);delete value.requestId;
 if(!shape(value,keys)||!id(value.customerId)||typeof value.expectedRevision!=='string'||!/^[0-9a-f]{64}$/.test(value.expectedRevision)||!rate(value.discountRateExact4)||!Array.isArray(value.items)||value.items.length!==2)fail();
 desktopCompanyRateDate(value.documentDate);const seen=new Set();
 for(const item of value.items){const series=Object.hasOwn(item??{},'series');if(!shape(item,['productId','quantityExact3',...(series?['series']:[])])||!id(item.productId)||seen.has(item.productId)||!positive(item.quantityExact3)||series&&!isDesktopSeriesSelection(item.series))fail();seen.add(item.productId);}
 value.pricing=normalizeDesktopSalePricing(value.pricing);if(fx)value.currencySelection=desktopSaleCurrencySelection(value.currencySelection);
 return value;
}
const content=(actorId,request)=>{const value=normalizeDesktopPricingIntent(request);return digest({actorId,intent:{...value,pricing:{...value.pricing,approvalId:null}}});};
export function desktopSalesApprovalQuote(source,intent){
 if(!source||!['TRY','USD','EUR'].includes(source.currency)||source.currency!==(intent.currencySelection?.documentCurrency??'TRY')||source.discountRateExact4!==intent.discountRateExact4||typeof source.belowCostWarning!=='boolean'||!Array.isArray(source.lines)||source.lines.length!==2)fail();
 const units=v=>{if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v)||BigInt(v.replace('.',''))>9007199254740991n)fail();return BigInt(v.replace('.',''));},fixed=n=>{const s=n.toString().padStart(5,'0');return s.slice(0,-4)+'.'+s.slice(-4);};let raw=0n;
 const lines=source.lines.map((l,i)=>{if(l.productId!==intent.items[i].productId||l.quantityExact3!==intent.items[i].quantityExact3||intent.pricing.unitPricesExact4[i]!==null&&l.unitPriceExact4!==intent.pricing.unitPricesExact4[i])fail();const price=units(l.unitPriceExact4),gross=BigInt(l.quantityExact3.replace('.',''))*price;if(price===0n||units(l.lineTotalExact4)!==(gross+500n)/1000n)fail();raw+=gross;return {productId:l.productId,quantityExact3:l.quantityExact3,unitPriceExact4:l.unitPriceExact4,lineTotalExact4:l.lineTotalExact4};});
 const r=BigInt(intent.discountRateExact4.replace('.','')),subtotal=(raw+500n)/1000n,discount=(raw*r+500000000n)/1000000000n,total=(raw*(1000000n-r)+500000000n)/1000000000n;
 if(total<=0n||units(source.subtotalExact4)!==subtotal||units(source.discountTotalExact4)!==discount||units(source.totalExact4)!==total)fail();
 return {currency:source.currency,lines,subtotalExact4:fixed(subtotal),discountRateExact4:intent.discountRateExact4,discountTotalExact4:fixed(discount),totalExact4:fixed(total),belowCostWarning:source.belowCostWarning};
}
export function createDesktopSalesPricingAuthority({sql,readPolicy,ensureLease}={}){
 if(typeof readPolicy!=='function'||typeof ensureLease!=='function'||!sql?.Request)fail();
 async function query(tx,text,values={}){const r=new sql.Request(tx);for(const [k,v] of Object.entries(values))r.input(k,sql.NVarChar(k==='json'?sql.MAX:4000),v);return r.query(text);}
 async function now(tx){const r=await query(tx,"/* SALES_PRICING_CLOCK */ SELECT CONVERT(varchar(33),SYSUTCDATETIME(),126)+N'Z' utc;");const value=r?.recordset?.[0]?.utc;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,7}Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail();return Date.parse(value);}
 const recordSql=`SELECT TOP(2) CONVERT(varchar(20),id) id,CONVERT(varchar(20),actor_user_id) actorId,CONVERT(varchar(20),entity_id) entityId,reason,after_json json FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE source=N'desktop-sales-policy-v1' AND entity_type=N'sales-pricing' AND action=@action`;
 async function rows(tx,kind,where,params){const r=await query(tx,`/* SALES_PRICING_${kind.toUpperCase()} */ ${recordSql} ${where};`,{action:actions[kind],...params});if(!Array.isArray(r?.recordset)||r.recordset.length>2)fail();return r.recordset;}
 function unpack(row,kind){if(!row||!id(row.id)||!id(row.actorId)||!id(row.entityId)||!uuid(row.reason)||typeof row.json!=='string'||Buffer.byteLength(row.json,'utf8')>65536)fail();let data;try{data=JSON.parse(row.json);}catch{fail();}if(JSON.stringify(data)!==row.json||data.version!==1||data.kind!==kind)fail();return data;}
 async function read(tx,kind,recordId){if(!id(recordId))fail();const result=await rows(tx,kind,'AND id=TRY_CONVERT(bigint,@id)',{id:recordId});if(result.length!==1)fail();return {row:result[0],data:unpack(result[0],kind)};}
 async function insert(tx,kind,actorId,entityId,requestId,data){
  const json=JSON.stringify(data);if(Buffer.byteLength(json,'utf8')>65536)fail();
  const r=await query(tx,`/* SALES_PRICING_INSERT */ INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@actor),@action,N'sales-pricing',TRY_CONVERT(bigint,@entity),@json,@request,N'desktop-sales-policy-v1');`,{actor:actorId,action:actions[kind],entity:entityId,json,request:requestId});
  const recordId=r?.recordset?.[0]?.id;if(!id(recordId)||r.recordset.length!==1)fail();const saved=await read(tx,kind,recordId);if(saved.row.actorId!==actorId||saved.row.entityId!==entityId||saved.row.reason!==requestId||saved.row.json!==json)fail();return recordId;
 }
 async function lockCommand(tx,actorId,requestId){const r=await query(tx,`/* SALES_PRICING_COMMAND_LOCK */ SELECT TOP(2) CONVERT(varchar(20),id) id,CONVERT(varchar(20),actor_user_id) actorId,CONVERT(varchar(20),entity_id) entityId,action,reason,after_json json FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE source=N'desktop-sales-policy-v1' AND entity_type=N'sales-pricing' AND actor_user_id=TRY_CONVERT(bigint,@actor) AND reason=@request;`,{actor:actorId,request:requestId});if(!Array.isArray(r?.recordset)||r.recordset.length>1)fail();return r.recordset[0]??null;}
 async function assertOpenCommand(tx,actorId,requestId,kind){const prior=await lockCommand(tx,actorId,requestId);if(prior&&prior.action!==actions[kind])fail('DESKTOP_SALE_APPROVAL_RESOLVED');return prior;}
 function requestData(row){const r=unpack(row,'request');if(!shape(r,['version','kind','actorId','requestId','policyRevision','draft','intentHash','quote','quoteHash','createdAt','expiresAt'])||r.actorId!==row.actorId||row.entityId!==r.actorId||row.reason!==r.requestId||r.policyRevision!==r.draft?.pricing?.policyRevision||r.draft?.pricing?.approvalId!==null||r.intentHash!==content(r.actorId,r.draft)||r.quoteHash!==digest(desktopSalesApprovalQuote(r.quote,r.draft))||JSON.stringify(r.quote)!==JSON.stringify(desktopSalesApprovalQuote(r.quote,r.draft))||!Number.isSafeInteger(r.createdAt)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt-r.createdAt!==600000)fail();return r;}
 async function checkApproval(tx,caller,recordId,actorId,request,{consumed=false}={}){
  const {row,data:a}=await read(tx,'approval',recordId);
  if(!shape(a,['version','kind','requestId','requestRecordId','actorId','bossId','bossPolicyRevision','targetPolicyRevision','intentHash','quoteHash','approvedAt','expiresAt','reason'])||a.kind!=='approval'||row.actorId!==a.bossId||row.entityId!==a.requestRecordId||row.reason!==a.requestId||a.actorId!==actorId||a.intentHash!==content(actorId,request)||!id(a.bossId)||typeof a.reason!=='string'||a.reason.trim().length<3)fail();
  const target=await readPolicy({transaction:tx,actorId:caller,targetActorId:actorId}),boss=await readPolicy({transaction:tx,actorId:caller,targetActorId:a.bossId});
  if(!boss.policy.canApproveAboveFive||boss.policy.revision!==a.bossPolicyRevision||target.policy.revision!==a.targetPolicyRevision)fail();
  const requested=await read(tx,'request',a.requestRecordId),original=requestData(requested.row);if(requested.row.actorId!==actorId||requested.row.entityId!==actorId||original.intentHash!==a.intentHash||original.policyRevision!==a.targetPolicyRevision||original.actorId!==actorId||a.quoteHash!==original.quoteHash)fail();
  const clock=await now(tx);if(!Number.isSafeInteger(a.approvedAt)||!Number.isSafeInteger(a.expiresAt)||a.expiresAt-a.approvedAt!==600000||a.approvedAt>clock||a.approvedAt>=original.expiresAt||!consumed&&clock>=a.expiresAt)fail('DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED');
  return a;
 }
 async function authorize({transaction:tx,actorId,request,locked,phase,invoiceId}={}){
  ensureLease(tx,actorId);if(!['preview','draft','dispatch'].includes(phase)||!locked||!Array.isArray(locked.products)||locked.products.length!==2)fail();request=clone(request);
  if(phase==='dispatch'){
   if(!id(invoiceId))fail();const records=await rows(tx,'bound','AND entity_id=TRY_CONVERT(bigint,@invoice)',{invoice:invoiceId});
   if(records.length===0){
    const journal=await query(tx,`/* SALES_PRICING_DISCRIMINATOR */ SELECT TOP(2) CONVERT(varchar(20),actor_id) actorId,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND operation='CREATE_DRAFT';`,{invoice:invoiceId});
    if(!Array.isArray(journal?.recordset)||journal.recordset.length!==1)fail();
    const creator=journal.recordset[0];let saved;try{saved=JSON.parse(creator.resultJson);}catch{fail();}if(saved?.pricingProofRequired!==undefined||saved?.state!=='COMMITTED'||saved?.invoiceId!==invoiceId||!id(creator.actorId)||request?.persisted?.header?.createdBy!==creator.actorId)fail();
    const owner=await readPolicy({transaction:tx,actorId,targetActorId:creator.actorId}),caller=await readPolicy({transaction:tx,actorId});
    const limits=[30000n,BigInt(owner.policy.maxDiscountRateExact4.replace('.','')),BigInt(caller.policy.maxDiscountRateExact4.replace('.',''))],limit=limits.reduce((a,b)=>a<b?a:b),text=limit.toString().padStart(5,'0');
    return Object.freeze({kind:'legacy',maxDiscountRateExact4:text.slice(0,-4)+'.'+text.slice(-4)});
   }if(records.length!==1)fail();const row=records[0],proof=unpack(row,'bound');
   if(!shape(proof,['version','kind','actorId','invoiceId','requestId','requestHash','policyRevision','request','intentHash','prices'])||row.actorId!==proof.actorId||row.entityId!==invoiceId||proof.invoiceId!==invoiceId||row.reason!==proof.requestId||proof.request.requestId!==proof.requestId||!id(proof.actorId))fail();
   const j=await query(tx,`/* SALES_PRICING_JOURNAL */ SELECT TOP(2) CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request) AND operation='CREATE_DRAFT';`,{request:proof.requestId});
   const journal=j?.recordset?.[0];if(j?.recordset?.length!==1||journal.actorId!==proof.actorId||journal.invoiceId!==invoiceId||journal.hash!==proof.requestHash||createHash('sha256').update(JSON.stringify({actorId:proof.actorId,request:proof.request})).digest('hex')!==proof.requestHash||proof.intentHash!==content(proof.actorId,proof.request))fail();
   let result;try{result=JSON.parse(journal.resultJson);}catch{fail();}if(result.state!=='COMMITTED'||result.invoiceId!==invoiceId||result.requestId!==proof.requestId||result.pricingProofRequired!==true)fail();
   const target=await readPolicy({transaction:tx,actorId,targetActorId:proof.actorId});if(target.policy.revision!==proof.policyRevision)fail();
   const r=normalizeDesktopPricingIntent(proof.request),p=request?.persisted,header=p?.header,items=p?.items;
   if(!header||header.createdBy!==proof.actorId||header.customerId!==r.customerId||header.documentDate!==r.documentDate||header.discountRate!==r.discountRateExact4||!Array.isArray(items)||items.length!==2||!Array.isArray(proof.prices)||proof.prices.length!==2)fail();
   for(let i=0;i<2;i++)if(items[i].productId!==r.items[i].productId||items[i].quantityExact3!==r.items[i].quantityExact3||items[i].unitPriceExact4!==proof.prices[i].newPriceExact4)fail();
   if(r.currencySelection){const c=r.currencySelection;if(header.currency!==c.documentCurrency||header.accountId!==c.accountId||header.documentRate!==c.documentRateExact8||header.accountRate!==c.accountRateExact8)fail();}else if(header.currency!=='TRY')fail();
   if(r.pricing.approvalId)await checkApproval(tx,actorId,r.pricing.approvalId,proof.actorId,proof.request,{consumed:true});else if(BigInt(r.discountRateExact4.replace('.',''))>BigInt(target.policy.maxDiscountRateExact4.replace('.','')))fail();
   const caller=await readPolicy({transaction:tx,actorId});ensureLease(tx,actorId);return Object.freeze({kind:'pricing',locked,request:proof.request,policy:caller.policy,approvalId:r.pricing.approvalId,approvalRequired:false});
  }
  if(!Object.hasOwn(request??{},'pricing'))return Object.freeze({kind:'legacy'});
  const r=normalizeDesktopPricingIntent(request),{policy}=await readPolicy({transaction:tx,actorId});if(r.pricing.policyRevision!==policy.revision)fail('DESKTOP_SALES_POLICY_CHANGED');
  const prices=[],selected={...locked,products:locked.products.map((p,i)=>{if(p.id!==r.items[i].productId)fail();const wanted=r.pricing.unitPricesExact4[i]??p.priceExact4;if(wanted!==p.priceExact4&&!policy.canChangeSalePrice)fail('DESKTOP_SALE_PRICE_PERMISSION');prices.push({productId:p.id,oldPriceExact4:p.priceExact4,newPriceExact4:wanted});return {...p,priceExact4:wanted};})};
  const over=BigInt(r.discountRateExact4.replace('.',''))>BigInt(policy.maxDiscountRateExact4.replace('.',''));let approvalRequired=over;
  if(r.pricing.approvalId){await checkApproval(tx,actorId,r.pricing.approvalId,actorId,request);approvalRequired=false;}
  if(phase==='draft'&&approvalRequired)fail('DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED');
  async function bindDraft({invoiceId,requestHash}={}){
   ensureLease(tx,actorId);if(phase!=='draft'||!id(invoiceId)||!uuid(request.requestId)||typeof requestHash!=='string'||requestHash!==createHash('sha256').update(JSON.stringify({actorId,request})).digest('hex'))fail();
   if(r.pricing.approvalId){await checkApproval(tx,actorId,r.pricing.approvalId,actorId,request);const used=await query(tx,`/* SALES_PRICING_APPROVAL_USED */ SELECT TOP(1) id FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE source=N'desktop-sales-policy-v1' AND entity_type=N'sales-pricing' AND action=N'sales.pricing.bound' AND JSON_VALUE(after_json,'$.request.pricing.approvalId')=@approval;`,{approval:r.pricing.approvalId});if(!Array.isArray(used?.recordset)||used.recordset.length)fail('DESKTOP_SALE_APPROVAL_ALREADY_USED');}
   const old=await rows(tx,'bound','AND entity_id=TRY_CONVERT(bigint,@invoice)',{invoice:invoiceId});if(old.length)fail();
   await insert(tx,'bound',actorId,invoiceId,request.requestId,{version:1,kind:'bound',actorId,invoiceId,requestId:request.requestId,requestHash,policyRevision:policy.revision,request:clone(request),intentHash:content(actorId,request),prices});return true;
  }
  ensureLease(tx,actorId);return Object.freeze({kind:'pricing',locked:selected,policy,approvalRequired,approvalId:r.pricing.approvalId,bindDraft});
 }
 function approvalService({pool,verifySession,release,preview}={}){
  async function transaction(actorId,work){const tx=new sql.Transaction(pool);let begun=false;try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;if(!await verifySession({transaction:tx,actorId,permission:'sales.view'}))fail();const v=await work(tx);await tx.commit();begun=false;return v;}catch(e){if(begun)try{await tx.rollback();}catch{}throw e;}finally{release();}}
  async function summary(tx,row){
   const r=requestData(row),approvals=await rows(tx,'approval','AND entity_id=TRY_CONVERT(bigint,@id)',{id:row.id});if(approvals.length>1)fail();
   let a=null,invoice=null;
   if(approvals.length){
    const ar=approvals[0];a=unpack(ar,'approval');
    if(!shape(a,['version','kind','requestId','requestRecordId','actorId','bossId','bossPolicyRevision','targetPolicyRevision','intentHash','quoteHash','approvedAt','expiresAt','reason'])||a.requestRecordId!==row.id||a.actorId!==r.actorId||ar.actorId!==a.bossId||ar.entityId!==row.id||ar.reason!==a.requestId||!id(a.bossId)||!uuid(a.requestId)||a.targetPolicyRevision!==r.policyRevision||!/^[0-9a-f]{64}$/.test(a.bossPolicyRevision)||a.intentHash!==r.intentHash||a.quoteHash!==r.quoteHash||typeof a.reason!=='string'||a.reason.trim()!==a.reason||a.reason.length<3||a.reason.length>500||/[\u0000-\u001f\u007f]/.test(a.reason)||!Number.isSafeInteger(a.approvedAt)||!Number.isSafeInteger(a.expiresAt)||a.approvedAt<r.createdAt||a.approvedAt>=r.expiresAt||a.expiresAt-a.approvedAt!==600000)fail();
    const matches=await query(tx,`/* SALES_PRICING_HISTORY_BOUND */ SELECT TOP(2) CONVERT(varchar(20),id) id,CONVERT(varchar(20),actor_user_id) actorId,CONVERT(varchar(20),entity_id) entityId,reason,after_json json FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE source=N'desktop-sales-policy-v1' AND entity_type=N'sales-pricing' AND action=N'sales.pricing.bound' AND JSON_VALUE(after_json,'$.request.pricing.approvalId')=@approval;`,{approval:ar.id});
    if(!Array.isArray(matches?.recordset)||matches.recordset.length>1)fail();
    if(matches.recordset.length){
     const br=matches.recordset[0],b=unpack(br,'bound');
     if(!shape(b,['version','kind','actorId','invoiceId','requestId','requestHash','policyRevision','request','intentHash','prices'])||b.actorId!==r.actorId||br.actorId!==r.actorId||!id(b.invoiceId)||br.entityId!==b.invoiceId||!uuid(b.requestId)||br.reason!==b.requestId||b.request?.requestId!==b.requestId||b.request?.pricing?.approvalId!==ar.id||b.policyRevision!==r.policyRevision||b.intentHash!==r.intentHash||content(b.actorId,b.request)!==r.intentHash||!/^[0-9a-f]{64}$/.test(b.requestHash)||createHash('sha256').update(JSON.stringify({actorId:b.actorId,request:b.request})).digest('hex')!==b.requestHash||!Array.isArray(b.prices)||b.prices.length!==2)fail();
     for(let i=0;i<2;i++){const p=b.prices[i];if(!shape(p,['productId','oldPriceExact4','newPriceExact4'])||p.productId!==r.quote.lines[i].productId||p.newPriceExact4!==r.quote.lines[i].unitPriceExact4||typeof p.oldPriceExact4!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(p.oldPriceExact4))fail();}
     const byInvoice=await rows(tx,'bound','AND entity_id=TRY_CONVERT(bigint,@invoice)',{invoice:b.invoiceId});if(byInvoice.length!==1||byInvoice[0].id!==br.id)fail();
     const j=await query(tx,`/* SALES_PRICING_JOURNAL */ SELECT TOP(2) CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request) AND operation='CREATE_DRAFT';`,{request:b.requestId});
     if(!Array.isArray(j?.recordset)||j.recordset.length!==1||j.recordset[0].actorId!==r.actorId||j.recordset[0].invoiceId!==b.invoiceId||j.recordset[0].hash!==b.requestHash)fail();let saved;try{saved=JSON.parse(j.recordset[0].resultJson);}catch{fail();}if(saved?.state!=='COMMITTED'||saved.invoiceId!==b.invoiceId||saved.requestId!==b.requestId||saved.pricingProofRequired!==true)fail();
     const invoiceJournal=await query(tx,`/* SALES_PRICING_HISTORY_INVOICE_JOURNAL */ SELECT TOP(2) LOWER(CONVERT(varchar(36),request_id)) requestId FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND operation='CREATE_DRAFT';`,{invoice:b.invoiceId});if(!Array.isArray(invoiceJournal?.recordset)||invoiceJournal.recordset.length!==1||invoiceJournal.recordset[0].requestId!==b.requestId)fail();
     invoice={invoiceId:b.invoiceId,requestId:b.requestId};
    }
   }
   return {id:row.id,actorId:r.actorId,requestId:r.requestId,customerId:r.draft.customerId,documentDate:r.draft.documentDate,discountRateExact4:r.draft.discountRateExact4,items:r.draft.items,unitPricesExact4:r.draft.pricing.unitPricesExact4,status:a?'APPROVED':'PENDING',approvalId:approvals[0]?.id??null,createdAt:r.createdAt,decision:a?{actorId:a.bossId,reason:a.reason,decidedAt:a.approvedAt}:null,invoice,expiresAt:a?.expiresAt??r.expiresAt,draft:r.draft,quote:r.quote};
  }
  return Object.freeze({
   async create(actorId,input){if(!id(actorId)||!shape(input,['requestId','draft'])||!uuid(input.requestId))fail();const draft=normalizeDesktopPricingIntent(input.draft);if(draft.pricing.approvalId!==null)fail();
    // Resolve an already committed command before current quote/config checks.
    // A later legitimate catalog change must not turn an acknowledged request
    // into a different command or hide its persisted same-UUID result.
    const previous=await transaction(actorId,async tx=>{await assertOpenCommand(tx,actorId,input.requestId,'request');const old=await rows(tx,'request','AND actor_user_id=TRY_CONVERT(bigint,@actor) AND reason=@request',{actor:actorId,request:input.requestId});if(!old.length)return null;if(old.length!==1||unpack(old[0],'request').intentHash!==content(actorId,draft))fail();return summary(tx,old[0]);});if(previous)return previous;
    const shown=await preview(actorId,{customerId:draft.customerId,documentDate:draft.documentDate,productIds:draft.items.map(i=>i.productId),quantities:draft.items.map(i=>i.series?.quantityExact3??i.quantityExact3),quantityUnits:draft.items.map(i=>i.series?'SERİ':'ADET'),discountRateExact4:draft.discountRateExact4,pricing:draft.pricing,...(draft.currencySelection?{currencySelection:draft.currencySelection}:{})});
    if(shown.revision!==draft.expectedRevision||shown.salesPolicy?.revision!==draft.pricing.policyRevision||shown.quote?.approvalRequired!==true)fail();
    return transaction(actorId,async tx=>{const {policy}=await readPolicy({transaction:tx,actorId});if(policy.revision!==draft.pricing.policyRevision)fail();await assertOpenCommand(tx,actorId,input.requestId,'request');const old=await rows(tx,'request','AND actor_user_id=TRY_CONVERT(bigint,@actor) AND reason=@request',{actor:actorId,request:input.requestId});if(old.length){if(old.length!==1||unpack(old[0],'request').intentHash!==content(actorId,draft))fail();return summary(tx,old[0]);}const quote=desktopSalesApprovalQuote(shown.quote,draft),createdAt=await now(tx),data={version:1,kind:'request',actorId,requestId:input.requestId,policyRevision:policy.revision,draft,intentHash:content(actorId,draft),quote,quoteHash:digest(quote),createdAt,expiresAt:createdAt+600000};const recordId=await insert(tx,'request',actorId,actorId,input.requestId,data);return summary(tx,(await read(tx,'request',recordId)).row);});
   },
   async list(actorId){return transaction(actorId,async tx=>{const {policy}=await readPolicy({transaction:tx,actorId});const r=await query(tx,`/* SALES_PRICING_LIST */ SELECT TOP(50) CONVERT(varchar(20),id) id,CONVERT(varchar(20),actor_user_id) actorId,CONVERT(varchar(20),entity_id) entityId,reason,after_json json FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE source=N'desktop-sales-policy-v1' AND entity_type=N'sales-pricing' AND action=N'sales.discount.request' ${policy.canApproveAboveFive?'':'AND actor_user_id=TRY_CONVERT(bigint,@actor)'} ORDER BY id DESC;`,{actor:actorId});if(!Array.isArray(r?.recordset)||r.recordset.length>50)fail();const requests=[];for(const row of r.recordset){if(!policy.canApproveAboveFive&&row.actorId!==actorId)fail();requests.push(await summary(tx,row));}return {requests,salesPolicy:policy};});},
   async read(actorId,recordId){if(!id(recordId))fail();return transaction(actorId,async tx=>{const {policy}=await readPolicy({transaction:tx,actorId}),record=await read(tx,'request',recordId);if(record.row.actorId!==actorId&&!policy.canApproveAboveFive)fail('DESKTOP_SALE_APPROVAL_READ_FORBIDDEN');return summary(tx,record.row);});},
   async resolve(actorId,input){
    if(!shape(input,['kind','recordId','body'])||!['create','approve'].includes(input.kind)||!uuid(input.body?.requestId))fail();
    if(input.kind==='create'){if(input.recordId!==null||!shape(input.body,['requestId','draft']))fail();normalizeDesktopPricingIntent(input.body.draft);}else if(!id(input.recordId)||!shape(input.body,['requestId','reason'])||typeof input.body.reason!=='string'||input.body.reason.trim()!==input.body.reason||input.body.reason.length<3||input.body.reason.length>500)fail();
    const commandHash=digest({actorId,...input}),echo=clone(input);return transaction(actorId,async tx=>{const old=await lockCommand(tx,actorId,input.body.requestId);let state='NOT_COMMITTED',result=null;
     if(old?.action===actions.resolution){const r=unpack(old,'resolution');if(!shape(r,['version','kind','actorId','requestId','commandKind','recordId','commandHash','resolvedAt'])||r.actorId!==actorId||r.requestId!==input.body.requestId||r.commandKind!==input.kind||r.recordId!==input.recordId||r.commandHash!==commandHash)fail();}
     else if(old){if(input.kind==='create'&&old.action===actions.request){const r=requestData(old);if(r.intentHash!==content(actorId,input.body.draft))fail();result=await summary(tx,old);}else if(input.kind==='approve'&&old.action===actions.approval){const a=unpack(old,'approval');if(a.bossId!==actorId||a.requestId!==input.body.requestId||a.requestRecordId!==input.recordId||a.reason!==input.body.reason)fail();}else fail();state='COMMITTED';}
     else await insert(tx,'resolution',actorId,input.recordId??actorId,input.body.requestId,{version:1,kind:'resolution',actorId,requestId:input.body.requestId,commandKind:input.kind,recordId:input.recordId,commandHash,resolvedAt:await now(tx)});
     return {state,actorId,...echo,summary:result};
    });
   },
   async approve(actorId,recordId,input){if(!id(recordId)||!shape(input,['requestId','reason'])||!uuid(input.requestId)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>500||/[\u0000-\u001f\u007f]/.test(input.reason))fail();return transaction(actorId,async tx=>{await assertOpenCommand(tx,actorId,input.requestId,'approval');const boss=await readPolicy({transaction:tx,actorId});if(!boss.policy.canApproveAboveFive)fail('DESKTOP_SALE_BOSS_PERMISSION');const requested=await read(tx,'request',recordId),r=requestData(requested.row);const target=await readPolicy({transaction:tx,actorId,targetActorId:r.actorId});if(target.policy.revision!==r.policyRevision)fail();const prior=await rows(tx,'approval','AND entity_id=TRY_CONVERT(bigint,@id)',{id:recordId});if(prior.length){const a=unpack(prior[0],'approval');if(prior.length!==1||a.bossId!==actorId||a.requestId!==input.requestId||a.reason!==input.reason.trim())fail();return summary(tx,requested.row);}const approvedAt=await now(tx);if(!Number.isSafeInteger(r.expiresAt)||approvedAt>=r.expiresAt)fail('DESKTOP_SALE_APPROVAL_EXPIRED');await insert(tx,'approval',actorId,recordId,input.requestId,{version:1,kind:'approval',requestId:input.requestId,requestRecordId:recordId,actorId:r.actorId,bossId:actorId,bossPolicyRevision:boss.policy.revision,targetPolicyRevision:r.policyRevision,intentHash:r.intentHash,quoteHash:r.quoteHash,approvedAt,expiresAt:approvedAt+600000,reason:input.reason.trim()});return summary(tx,requested.row);});}
  });
 }
 return Object.freeze({authorize,approvalService});
}
