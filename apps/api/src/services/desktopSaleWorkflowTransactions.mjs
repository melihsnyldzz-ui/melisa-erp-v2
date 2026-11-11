// Source-only SQL lifecycle adapter. No listener or migration is opened here.
// Production assembly must supply the verified desktop writer and current
// normal-session verifier. DISPATCH is intentionally unavailable until the
// private native finalize + posting + outcome + journal integration is ready.
import {createHash} from 'node:crypto';
import {recordDesktopFailure} from './desktopSafeDiagnostics.mjs';
import {lockDesktopResolution} from './desktopWorkflowRequestResolution.mjs';
import {desktopSalesReadOwner} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
export const DESKTOP_SALE_WORKFLOW_LIMITS=Object.freeze({sourceOnly:true,requiresPersistedNativeDraft:true,requiresWorkflowSchema:true,dispatchImplemented:false,normalScreenVerified:false,realSqlVerified:false});
const fail=()=>{throw Error('DESKTOP_WORKFLOW_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const quantity=v=>{if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(v))fail();return BigInt(v.replace('.',''));};
const policy={PREPARE:['DRAFT','PREPARING','sales.create'],SAVE_CARTONS:['PREPARING','PREPARING','sales.edit'],READY:['PREPARING','READY','sales.edit'],CHECK:['READY','CHECKED','sales.finalize'],CANCEL:[['DRAFT','PREPARING','READY','CHECKED'],'CANCELLED','sales.edit']};
export function normalizeDesktopWorkflowTransition(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))fail();
 const fields=['requestId','invoiceId','operation','expectedVersion','cartons'];
 const d=Object.getOwnPropertyDescriptors(raw);if(Reflect.ownKeys(raw).length!==fields.length||fields.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail();
 const c=Object.fromEntries(fields.map(k=>[k,d[k].value]));
 if(!uuid(c.requestId)||!id(c.invoiceId)||!Object.hasOwn(policy,c.operation)||typeof c.expectedVersion!=='string'||!/^0x[0-9A-F]{16}$/.test(c.expectedVersion)||!Array.isArray(c.cartons)||c.cartons.length>100)fail();
 if(c.operation!=='SAVE_CARTONS'&&c.cartons.length!==0)fail();
 const nums=new Set();c.cartons=c.cartons.map(box=>{
  if(!box||Object.keys(box).sort().join(',')!=='cartonNo,items'||!Number.isSafeInteger(box.cartonNo)||box.cartonNo<1||box.cartonNo>2147483647||nums.has(box.cartonNo)||!Array.isArray(box.items)||box.items.length<1||box.items.length>2)fail();nums.add(box.cartonNo);
  const seen=new Set();return {cartonNo:box.cartonNo,items:box.items.map(item=>{if(!item||Object.keys(item).sort().join(',')!=='itemId,quantityExact3'||!id(item.itemId)||seen.has(item.itemId)||quantity(item.quantityExact3)===0n)fail();seen.add(item.itemId);return {itemId:item.itemId,quantityExact3:item.quantityExact3};})};
 });return c;
}
export function createDesktopSaleWorkflowTransactions({pool,sql,verifySession,getSalesReadScope}={}){
 if(typeof getSalesReadScope!=='function')fail();
 return createTransactions({pool,sql,verifySession,getSalesReadScope},policy);
}
const warehousePolicy=Object.freeze({PREPARE:['DRAFT','PREPARING','warehouse.prepare'],SAVE_CARTONS:['PREPARING','PREPARING','warehouse.pack'],READY:['PREPARING','READY','warehouse.pack']});
export function createDesktopWarehouseWorkflowTransactions({pool,sql,verifySession}={}){
 return createTransactions({pool,sql,verifySession},warehousePolicy);
}
function createTransactions({pool,sql,verifySession,getSalesReadScope},activePolicy){
 if(!pool||typeof sql?.Transaction!=='function'||typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function')fail();
 return Object.freeze({async transition(actorId,raw){let requestId=typeof raw?.requestId==='string'?raw.requestId:null;
  try{if(!id(actorId))fail();const c=normalizeDesktopWorkflowTransition(raw);if(!Object.hasOwn(activePolicy,c.operation)||activePolicy===warehousePolicy&&c.cartons.some(x=>x.cartonNo>100))fail();requestId=c.requestId;
   const hash=createHash('sha256').update(JSON.stringify({actorId,...c})).digest('hex'),tx=new sql.Transaction(pool);let begun=false;
   try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
    const query=(text,values={})=>{const req=new sql.Request(tx);for(const [name,value] of Object.entries(values))req.input(name,sql.NVarChar(name==='json'?sql.MAX:4000),value);return req.query(text);};
    if(await verifySession({transaction:tx,actorId,permission:activePolicy===warehousePolicy?['warehouse.view',activePolicy[c.operation][2]]:['sales.view',activePolicy[c.operation][2]]})!==true)fail();
    if(await lockDesktopResolution({sql,transaction:tx,requestId}))fail();
    const old=await query(`SELECT CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`,{request:requestId});
    if(!Array.isArray(old?.recordset)||old.recordset.length>1)fail();
    if(old.recordset.length){const prior=old.recordset[0];if(prior.actorId!==actorId||prior.invoiceId!==c.invoiceId||prior.operation!==c.operation||prior.hash!==hash)fail();const result=JSON.parse(prior.resultJson);if(result?.state!=='COMMITTED'||result.requestId!==requestId||result.invoiceId!==c.invoiceId||result.operation!==c.operation||result.workflowState!==activePolicy[c.operation][1]||result.replayed!==false||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version))fail();await tx.commit();begun=false;return {...result,replayed:true};}
    const rows=await query(`SELECT w.state,CONVERT(varchar(18),CONVERT(binary(8),w.version),1) version,i.status,CONVERT(varchar(20),i.created_by) creatorId FROM dbo.desktop_sale_workflows w WITH(UPDLOCK,HOLDLOCK) JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=w.invoice_id WHERE w.invoice_id=TRY_CONVERT(bigint,@invoice); SELECT CONVERT(varchar(20),id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3 FROM dbo.sales_invoice_items WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice) ORDER BY product_id;`,{invoice:c.invoiceId});
    const rs=rows?.recordsets;if(!Array.isArray(rs)||rs.length!==2||rs[0]?.length!==1||(!Array.isArray(rs[1])||rs[1].length<1||rs[1].length>2))fail();const header=rs[0][0],lines=rs[1],map=new Map();
    // The existing actor/body journal may be replayed after ownership changes.
    // Fresh commands use the same current, transaction-bound scope as reads.
    if(activePolicy!==warehousePolicy&&!desktopSalesReadOwner(header.creatorId,actorId,getSalesReadScope({transaction:tx,actorId})))fail();
    const from=activePolicy[c.operation][0];
    if(header.status!=='draft'||(Array.isArray(from)?!from.includes(header.state):header.state!==from)||header.version!==c.expectedVersion)fail();
    for(const l of lines){if(!id(l.itemId)||!id(l.productId)||quantity(l.quantityExact3)===0n||map.has(l.itemId))fail();map.set(l.itemId,l);}if(new Set(lines.map(l=>l.productId)).size!==lines.length)fail();
    if(c.operation==='CANCEL'){
     // Cancels an unposted draft only. Existing column grants are sufficient;
     // this never reverses a finalized invoice or modifies stock/cari balances.
     const reservations=await query(`SELECT CONVERT(varchar(20),item_id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3,state FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice);`,{invoice:c.invoiceId});
     const r=reservations?.recordset,expectedRows=header.state==='DRAFT'?0:lines.length;
     if(!Array.isArray(r)||r.length!==expectedRows||new Set(r.map(v=>v.itemId)).size!==expectedRows||r.some(v=>!map.has(v.itemId)||v.productId!==map.get(v.itemId).productId||v.quantityExact3!==map.get(v.itemId).quantityExact3||v.state!=='ACTIVE'))fail();
     const effects=await query(`SELECT (SELECT COUNT_BIG(*) FROM dbo.stock_movements WITH(UPDLOCK,HOLDLOCK) WHERE source_type=N'sales_invoice' AND source_id=TRY_CONVERT(bigint,@invoice)) stockRows,(SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoice)) customerRows;`,{invoice:c.invoiceId});
     if(effects?.recordset?.length!==1||String(effects.recordset[0].stockRows)!=='0'||String(effects.recordset[0].customerRows)!=='0')fail();
     const cancelled=await query(`UPDATE dbo.desktop_sale_reservations SET state='RELEASED' WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND state='ACTIVE';SELECT @@ROWCOUNT released;UPDATE dbo.sales_invoices SET status=N'cancelled',updated_at=SYSUTCDATETIME() WHERE id=TRY_CONVERT(bigint,@invoice) AND status=N'draft';SELECT @@ROWCOUNT cancelled;`,{invoice:c.invoiceId});
     if(cancelled?.recordsets?.length!==2||cancelled.recordsets[0]?.length!==1||cancelled.recordsets[0][0].released!==expectedRows||cancelled.recordsets[1]?.length!==1||cancelled.recordsets[1][0].cancelled!==1)fail();
     await query(`INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source,created_at) VALUES(TRY_CONVERT(bigint,@actor),N'sales_invoice_draft_cancelled',N'sales_invoice',TRY_CONVERT(bigint,@invoice),@before,@json,N'Taslak iptali',N'desktop-first-sale',SYSUTCDATETIME());`,{actor:actorId,invoice:c.invoiceId,before:JSON.stringify({workflowState:header.state,requestId}),json:JSON.stringify({workflowState:'CANCELLED',released:expectedRows,requestId})});
    }else if(c.operation==='PREPARE'){
     for(const l of lines){
      const check=await query(`SELECT CONVERT(varchar(40),current_stock_qty) stock FROM dbo.products WITH(UPDLOCK,HOLDLOCK) WHERE id=TRY_CONVERT(bigint,@product) AND is_active=1 AND is_deleted=0; SELECT CONVERT(varchar(40),CONVERT(decimal(18,3),ISNULL(SUM(quantity),0))) reserved FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK,INDEX(IX_desktop_active_reservations)) WHERE product_id=TRY_CONVERT(bigint,@product) AND state='ACTIVE'; SELECT COUNT_BIG(*) count FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice);`,{product:l.productId,invoice:c.invoiceId});
      const a=check?.recordsets;if(!Array.isArray(a)||a.length!==3||a.some(v=>v?.length!==1)||String(a[2][0].count)!=='0'||quantity(a[0][0].stock)-quantity(a[1][0].reserved)<quantity(l.quantityExact3))fail();
     }
     for(const l of lines)await query(`INSERT dbo.desktop_sale_reservations(invoice_id,item_id,product_id,quantity,state) VALUES(TRY_CONVERT(bigint,@invoice),TRY_CONVERT(bigint,@item),TRY_CONVERT(bigint,@product),TRY_CONVERT(decimal(18,3),@amount),'ACTIVE');`,{invoice:c.invoiceId,item:l.itemId,product:l.productId,amount:l.quantityExact3});
    }else{
     const reservations=await query(`SELECT CONVERT(varchar(20),item_id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3,state FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice);`,{invoice:c.invoiceId});
     const r=reservations?.recordset;if(!Array.isArray(r)||r.length!==lines.length||new Set(r.map(v=>v.itemId)).size!==lines.length||r.some(v=>!map.has(v.itemId)||v.productId!==map.get(v.itemId).productId||v.state!=='ACTIVE'||v.quantityExact3!==map.get(v.itemId).quantityExact3))fail();
     if(c.operation==='SAVE_CARTONS'){
      const totals=new Map(lines.map(l=>[l.itemId,0n]));for(const box of c.cartons)for(const item of box.items){if(!map.has(item.itemId))fail();totals.set(item.itemId,totals.get(item.itemId)+quantity(item.quantityExact3));}if(lines.some(l=>totals.get(l.itemId)>quantity(l.quantityExact3)))fail();
      await query(`DELETE FROM dbo.desktop_sale_carton_items WHERE invoice_id=TRY_CONVERT(bigint,@invoice); DELETE FROM dbo.desktop_sale_cartons WHERE invoice_id=TRY_CONVERT(bigint,@invoice);`,{invoice:c.invoiceId});
      for(const box of c.cartons){await query(`INSERT dbo.desktop_sale_cartons(invoice_id,carton_no) VALUES(TRY_CONVERT(bigint,@invoice),TRY_CONVERT(int,@carton));`,{invoice:c.invoiceId,carton:String(box.cartonNo)});for(const item of box.items)await query(`INSERT dbo.desktop_sale_carton_items(invoice_id,carton_no,item_id,product_id,quantity) VALUES(TRY_CONVERT(bigint,@invoice),TRY_CONVERT(int,@carton),TRY_CONVERT(bigint,@item),TRY_CONVERT(bigint,@product),TRY_CONVERT(decimal(18,3),@amount));`,{invoice:c.invoiceId,carton:String(box.cartonNo),item:item.itemId,product:map.get(item.itemId).productId,amount:item.quantityExact3});}
     }else{
      const packed=await query(`SELECT CONVERT(varchar(20),item_id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3 FROM dbo.desktop_sale_carton_items WITH(UPDLOCK,HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoice);`,{invoice:c.invoiceId});
      if(!Array.isArray(packed?.recordset)||packed.recordset.length>200)fail();const totals=new Map(lines.map(l=>[l.itemId,0n]));for(const part of packed.recordset){if(!map.has(part.itemId)||map.get(part.itemId).productId!==part.productId)fail();totals.set(part.itemId,totals.get(part.itemId)+quantity(part.quantityExact3));}if(lines.some(l=>totals.get(l.itemId)!==quantity(l.quantityExact3)))fail();
     }
    }
    const change=await query(`UPDATE dbo.desktop_sale_workflows SET state=@state,sent_by=CASE WHEN @operation='PREPARE' THEN TRY_CONVERT(bigint,@actor) ELSE sent_by END,prepared_by=CASE WHEN @operation='READY' THEN TRY_CONVERT(bigint,@actor) ELSE prepared_by END,checked_by=CASE WHEN @operation='CHECK' THEN TRY_CONVERT(bigint,@actor) ELSE checked_by END OUTPUT CONVERT(varchar(18),CONVERT(binary(8),inserted.version),1) version WHERE invoice_id=TRY_CONVERT(bigint,@invoice) AND version=CONVERT(binary(8),@version,1);`,{state:activePolicy[c.operation][1],operation:c.operation,actor:actorId,invoice:c.invoiceId,version:c.expectedVersion});
    if(change?.recordset?.length!==1||!/^0x[0-9A-F]{16}$/.test(change.recordset[0].version))fail();
    const result={state:'COMMITTED',requestId,invoiceId:c.invoiceId,operation:c.operation,workflowState:activePolicy[c.operation][1],version:change.recordset[0].version,replayed:false};
    await query(`INSERT dbo.desktop_sale_workflow_requests(request_id,invoice_id,actor_id,operation,payload_hash,result_json) VALUES(TRY_CONVERT(uniqueidentifier,@request),TRY_CONVERT(bigint,@invoice),TRY_CONVERT(bigint,@actor),@operation,CONVERT(binary(32),@hash,2),@json);`,{request:requestId,invoice:c.invoiceId,actor:actorId,operation:c.operation,hash,json:JSON.stringify(result)});
    const recorded=await query(`SELECT CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`,{request:requestId});
    const stored=recorded?.recordset;if(!Array.isArray(stored)||stored.length!==1||stored[0].actorId!==actorId||stored[0].invoiceId!==c.invoiceId||stored[0].operation!==c.operation||stored[0].hash!==hash||stored[0].resultJson!==JSON.stringify(result))fail();
    await tx.commit();begun=false;return result;
   }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
  }catch(error){recordDesktopFailure({requestId,error});return {state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'};}
 }});
}
