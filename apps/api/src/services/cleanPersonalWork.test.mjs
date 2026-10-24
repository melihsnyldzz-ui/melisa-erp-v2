import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {registerCleanContext,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {CLEAN_PERSONNEL_WORK_ROLES,isCleanPersonalWorkCandidate,proveCleanPersonalWorkActor} from './cleanPersonnelManagement.mjs';
import {cleanDirectSaleActor,createCleanDirectSaleService} from './cleanDirectSaleService.mjs';
import {cleanDirectSaleActorId} from './cleanOrderSaleScope.mjs';
import {createCleanStoreDayStore,cleanInboundActor,cleanInboundCapabilities,cleanDailyActor,cleanFinanceActor} from './cleanStoreDayStore.mjs';
import {createWorkInboundService} from './workInboundService.mjs';
import {isCleanStoreDayMutation,withCleanFinanceRehearsalMutation,withCleanFinanceCashMutation,assertCleanCashRegisterTransaction} from './cleanStoreDayScope.mjs';
import {CLEAN_FINANCE_REHEARSAL,CLEAN_FINANCE_FX_CASES} from './cleanFinanceRehearsalModel.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',MELISA_CLEAN_SALES:'20261022',MELISA_CLEAN_STORE_DAY:'20261022',MELISA_CLEAN_INVENTORY:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'};
Object.assign(process.env,environment);
const identity={databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID};
registerCleanContext(identity,environment);
const person=(id,role=30)=>({id,username:'fixture.personal.'+id,role:{id:role,code:CLEAN_PERSONNEL_WORK_ROLES[role].code},permissions:[...new Set([...CLEAN_PERSONNEL_WORK_ROLES[role].view,...CLEAN_PERSONNEL_WORK_ROLES[role].create,...CLEAN_PERSONNEL_WORK_ROLES[role].approve])]});
const staff=person(50101),other=person(50102),manager=person(50103,31),finance=person(50104,32);

// Stateful SQL contract fixture. It has no SQL transport; the existing services,
// model validation, journals and private transaction scopes execute unchanged.
// It does not claim to execute generated SQL triggers or the invoice SQL motor.
function fixture(){
 let state={people:[staff,other,manager,finance].map((actor,i)=>({actor:structuredClone(actor),active:true,employeeActive:true,employeeId:60101+i,canTerminalSale:true})),invoices:[],links:[],requests:[],counts:[],inboundRequests:[],tradeRequests:[],balance:0,stock:10,sequence:70100},failFinish=false,foreignWitness=false;
 const result=rows=>({recordset:rows,recordsets:[rows]});
 const deny=()=>{throw Object.assign(Error('Synthetic native rejected'),{number:51975});};
 const member=(s,id,roles)=>{const p=s.people.find(p=>p.actor.id===Number(id));if(!p||!p.active||!p.employeeActive||!roles.includes(p.actor.role.id))deny();return p;};
 class Transaction{async begin(){this.data=structuredClone(state);this.intent=null;}async commit(){assert.equal(this.intent,null);state=this.data;}async rollback(){this.rolledBack=true;}}
 class Request{
  constructor(tx){this.tx=tx;this.p={};}input(n,_t,v){this.p[n]=v;return this;}
  async execute(name){const t=this.tx,s=t?.data,p=this.p;
   if(name.endsWith('_ready'))return result([]);
   if(name==='dbo.usp_clean_personnel_work_actor'){const m=member(s,p.actor_id,[30,31,32]);return result([{accepted:true,environmentId:foreignWitness?'wrong':CLEAN_ENVIRONMENT_ID,actorId:m.actor.id,username:m.actor.username,roleId:m.actor.role.id,roleCode:m.actor.role.code,employeeId:m.employeeId,canTerminalSale:m.canTerminalSale}]);}
   if(name.endsWith('_bind')){const kind=name.includes('direct_sale')?'sale':name.includes('inventory')?'daily':name.includes('finance')?'finance':'inbound',m=member(s,p.actor_id,kind==='finance'?[31,32]:kind==='sale'||kind==='daily'?[30,31]:p.operation.startsWith('count_')?[30,31]:[31]);assert.equal(t.intent,null);const payload=JSON.parse(p.payload_json);assert.equal(String(payload.actorId),String(p.actor_id));assert.equal(createHash('sha256').update(p.payload_json,'utf16le').digest('hex'),p.payload_hash.toLowerCase());
    if(kind==='sale'){if(!m.canTerminalSale)deny();if(!m.actor.permissions.includes(p.operation==='sale_draft'?'sales.create':'sales.finalize'))deny();if(p.operation==='sale_finalize'&&s.links.find(l=>l.id===String(p.invoice_id))?.actorId!==p.actor_id)deny();}
    if(kind==='finance'&&p.operation.endsWith('_cancel')&&m.actor.role.id!==31&&payload.id!=='90104')deny();
    if(kind==='daily'&&!p.operation.endsWith('_draft')&&m.actor.role.id!==31)deny();
    t.intent={...p,kind};return result([{accepted:true,environmentId:CLEAN_ENVIRONMENT_ID,actorId:p.actor_id,operation:p.operation,requestId:p.request_id,payloadHash:p.payload_hash.toLowerCase(),receiptId:p.receipt_id??null,invoiceId:p.invoice_id??null,stockAlreadyPosted:true}]);}
   if(name.endsWith('_finish')){if(failFinish)deny();const i=t.intent;assert.ok(i);t.intent=null;return result([{verified:true,environmentId:CLEAN_ENVIRONMENT_ID,actorId:i.actor_id,operation:i.operation,requestId:i.request_id,payloadHash:i.payload_hash.toLowerCase(),receiptId:i.receipt_id??null,invoiceId:i.invoice_id??null,stockAlreadyPosted:true}]);}
   throw Error('Unexpected procedure '+name);
  }
  async query(text){const t=this.tx,s=t?.data??state,p=this.p;
   if(text.includes('DB_NAME()')&&text.includes('environmentId'))return result([identity]);
   if(text.includes('sp_getapplock'))return result([]);
   if(text.startsWith('SELECT id,username,role_id')){const a=member(s,p.actor,[30,31]).actor;return {recordsets:[[{id:a.id,username:a.username,roleId:a.role.id,roleCode:a.role.code}],a.permissions.map(permission_key=>({permission_key})),[{id:'1',code:'ORNEK-M01',name:'Fixture customer',currency:'TRY',balanceExact4:s.balance.toFixed(4)}],['1','2'].map(id=>({id,stockCode:id==='1'?'0007 MELISA':'0016 MELISA',name:'Fixture product '+id,unit:'ADET',active:true,deleted:false,stockQuantityExact3:s.stock.toFixed(3)})),['1','2'].map(id=>({productId:id,quoteId:id,currency:'TRY',unitPriceExact8:'100.00000000',sourceKey:`SYNTHETIC/20261022/products/${id}/PRICE/sale/1/1/TRY`})),['1','2'].map(id=>({productId:id,barcode:'00000000'+id})),[]]};}
   if(text.startsWith('SELECT u.id,u.username')){const a=s.people.find(m=>m.actor.id===p.actor).actor;return {recordsets:[[{id:a.id,username:a.username,roleId:a.role.id,code:a.role.code}],a.permissions.map(permission_key=>({permission_key})),[{id:'1',stockCode:'0007 MELISA',name:'Fixture product',stockQuantityExact3:s.stock.toFixed(3),barcode:'000000001'}],[{id:'1',code:'ORNEK-T01',name:'Fixture supplier',currency:'TRY',balanceExact4:'0.0000'}]]};}
   if(text.startsWith('SELECT id,stock_code,name,unit'))return result([{id:1,stock_code:'0007 MELISA',name:'Fixture product',unit:'ADET',current_stock_qty:s.stock,average_cost_try:60}]);
   if(text.includes('FROM dbo.clean_direct_sale_links l JOIN')){const link=s.links.find(l=>l.id===String(p.id)),i=s.invoices.find(i=>i.id===String(p.id));return {recordsets:[i?[{...i.header,customerBalanceExact4:s.balance.toFixed(4),previewJson:link.previewJson,actorId:link.actorId}]:[],i?.items??[]]};}
   if(text.includes('FROM dbo.clean_direct_sale_links WHERE'))return result(s.links.filter(l=>l.actorId===p.actor).map(l=>({id:l.id})));
   for(const [table,key]of [['clean_direct_sale_requests','requests'],['work_inbound_requests','inboundRequests'],['work_trade_requests','tradeRequests']]){
    if(text.includes('FROM dbo.'+table))return result(s[key].filter(r=>r.request_id===p.id&&(p.actor===undefined||r.actor_id===p.actor)));
    if(text.startsWith('INSERT dbo.'+table)){assert.ok(t.intent);s[key].push({request_id:p.uuid??p.id,actor_id:p.actor,operation:p.operation??p.op,payload_hash:p.hash,payload_json:p.payload,response_json:p.response});return result([]);}
   }
   if(text.startsWith('INSERT dbo.clean_direct_sale_links')){assert.equal(t.intent.actor_id,p.actor);s.links.push({id:String(p.id),actorId:p.actor,previewJson:p.preview});return result([]);}
   if(text.includes('INSERT dbo.work_inbound_counts')){assert.equal(t.intent.actor_id,p.actor);const id=++s.sequence;s.counts.push({id,created_by:p.actor,state:p.state,version:1,note:p.note,lines_json:p.lines,receipt_id:p.receipt});return result([{id}]);}
   if(text.startsWith('UPDATE dbo.work_inbound_counts')){const c=s.counts.find(c=>c.id===p.id);assert.equal(c.created_by,p.actor);Object.assign(c,{state:p.state,version:c.version+1,note:p.note,lines_json:p.lines,receipt_id:p.receipt});return result([]);}
   if(text.includes('FROM dbo.work_inbound_counts WITH'))return result(s.counts.filter(c=>c.id===p.id));
   if(text.includes('FROM dbo.work_inbound_counts WHERE'))return result(s.counts.filter(c=>c.created_by===p.actor||p.administrator));
   throw Error('Unhandled fixture query: '+text.slice(0,150));
  }
 }
 const type=()=>'',q={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'serializable'},NVarChar:type,Char:type,BigInt:'bigint',Bit:'bit',UniqueIdentifier:'uuid',MAX:'max'},pool={request:()=>new Request()},dependencies=async()=>({getSqlPool:async()=>pool,getSqlDriver:()=>q});
 const invoices=async()=>({async createSalesDraft(input,actor,native){assert.equal(cleanDirectSaleActorId(native.transaction,'sale_draft',actor),Number(actor.id));assert.equal(input.customerId,1);const s=native.transaction.data,id=String(++s.sequence),items=input.items.map(p=>({productId:String(p.productId),stockCode:p.stockCode,name:p.productName,barcode:p.barcode,quantityExact3:p.quantity.toFixed(3),unitPriceExact4:p.unitPrice.toFixed(4),unitPriceExact8:p.unitPrice.toFixed(8),lineTotalExact4:(p.quantity*p.unitPrice).toFixed(4),currency:'TRY'})),total=items.reduce((n,p)=>n+Number(p.lineTotalExact4),0);s.invoices.push({id,header:{id,documentNo:input.documentNo,documentDate:input.documentDate,status:'draft',customerId:'1',currency:'TRY',subtotalExact4:total.toFixed(4),grandTotalExact4:total.toFixed(4),amountTryExact4:total.toFixed(4)},items});return {id:Number(id)};},async finalizeSalesInvoice(id,actor,native){assert.equal(cleanDirectSaleActorId(native.transaction,'sale_finalize',actor),Number(actor.id));const s=native.transaction.data,i=s.invoices.find(i=>i.id===String(id));i.header.status='finalized';s.balance+=Number(i.header.grandTotalExact4);s.stock-=i.items.reduce((n,p)=>n+Number(p.quantityExact3),0);}});
 const store=createCleanStoreDayStore({dependencies}),sale=createCleanDirectSaleService({dependencies,invoices,legacy:{readFinance:()=>assert.fail('personal sale must not fall through to old finance actor')}}),inbound=createWorkInboundService({getStore:async()=>store,actorCheck:cleanInboundActor,requireCap:cleanInboundCapabilities});
 return {sale,inbound,store,q,get state(){return state;},set failFinish(v){failFinish=v;},set foreignWitness(v){foreignWitness=v;}};
}
const selection={customerId:'1',currency:'TRY',documentDate:'2026-10-22',items:[{productId:'1',quoteId:'1',quantityExact3:'1.000'}]};
const countInput=()=>({requestId:randomUUID(),note:'Synthetic personal count',lines:[{clientLineId:'fixture-1',productId:'1',barcode:'000000001',stockCode:'0007 MELISA',physicalQuantityExact3:'2.000',expectedQuantityExact3:null,issue:null,note:''}]});

test('combined jobs are separate from administration and finance; an apparent role is only a routing hint',()=>{
 assert.equal(isCleanPersonalWorkCandidate(staff,'sale'),true);assert.equal(isCleanPersonalWorkCandidate(staff,'stock_count_draft'),true);assert.equal(isCleanPersonalWorkCandidate(staff,'finance'),false);assert.equal(isCleanPersonalWorkCandidate(staff,'goods_accept'),false);assert.equal(isCleanPersonalWorkCandidate(finance,'sale'),false);assert.equal(isCleanPersonalWorkCandidate(manager,'management'),true);
 for(const patch of [{id:10018},{id:15},{id:0},{isActive:false},{isAdmin:true},{testAdminSession:true},{role:{id:30,code:'admin'}}])assert.equal(isCleanPersonalWorkCandidate({...staff,...patch},'sale'),false);
 for(const a of [null,finance])assert.throws(()=>cleanDirectSaleActor(a,'sales.create'));
 assert.throws(()=>cleanFinanceActor(staff));assert.throws(()=>cleanDailyActor(finance));
});
test('personal sale uses its own ID through draft, journal, native scope, finalization and reread; replay has one effect',async()=>{
 const f=fixture(),context=await f.sale.context(staff),preview=await f.sale.preview(selection,staff),body={...selection,requestId:randomUUID(),expectedRevision:context.revision,previewHash:preview.previewHash};
 const made=await f.sale.createDraft(body,staff);assert.equal(made.invoice.createdBy,String(staff.id));assert.equal(f.state.balance,0);assert.equal(f.state.stock,10);
 assert.equal((await f.sale.createDraft(body,staff)).replayed,true);assert.equal(f.state.invoices.length,1);
 const action={requestId:randomUUID(),expectedRevision:made.invoice.revision},done=await f.sale.finalize(made.invoice.id,action,staff);assert.equal(done.invoice.status,'finalized');assert.equal(f.state.balance,100);assert.equal(f.state.stock,9);
 assert.equal((await f.sale.finalize(made.invoice.id,action,staff)).replayed,true);assert.equal(f.state.balance,100);assert.equal(f.state.stock,9);assert.equal((await f.sale.invoice(made.invoice.id,staff)).createdBy,String(staff.id));assert.equal((await f.sale.list({},staff)).meta.total,1);assert.equal((await f.sale.list({},other)).meta.total,0);
 await assert.rejects(()=>f.sale.invoice(made.invoice.id,other),{statusCode:403});await assert.rejects(()=>f.sale.finalize(made.invoice.id,{requestId:randomUUID(),expectedRevision:done.invoice.revision},other),{statusCode:403});await assert.rejects(()=>f.sale.createDraft(body,other),{statusCode:409});
 assert.ok(f.state.requests.every(r=>r.actor_id===staff.id));
});
test('missing active employee, foreign native proof, lost permission, wrong target and failed native finish never commit',async()=>{
 const f=fixture();f.state.people[0].employeeActive=false;await assert.rejects(()=>f.sale.context(staff),{statusCode:403});f.state.people[0].employeeActive=true;f.foreignWitness=true;await assert.rejects(()=>f.sale.context(staff),{statusCode:403});f.foreignWitness=false;
 f.state.people[0].canTerminalSale=false;await assert.rejects(()=>f.sale.context(staff),{statusCode:403});f.state.people[0].canTerminalSale=true;
 const c=await f.sale.context(staff),v=await f.sale.preview(selection,staff),input={...selection,requestId:randomUUID(),expectedRevision:c.revision,previewHash:v.previewHash},before=structuredClone(f.state);f.failFinish=true;await assert.rejects(()=>f.sale.createDraft(input,staff));assert.deepEqual(f.state,before);f.failFinish=false;
 f.state.people[0].actor.permissions=f.state.people[0].actor.permissions.filter(p=>p!=='sales.create');const noPermission=await f.sale.context(staff);assert.equal(noPermission.capabilities.canCreate,false);await assert.rejects(()=>f.sale.createDraft({...input,expectedRevision:noPermission.revision},staff),{statusCode:403});
 process.env.API_PORT='4196';try{await assert.rejects(()=>f.sale.context(staff));}finally{process.env.API_PORT='4194';}
 assert.equal(f.state.invoices.length,0);await assert.rejects(()=>f.sale.preview({...selection,customerId:'99'},staff),{statusCode:403});
});
test('personal receiving count persists and is visible only to its creator or manager; normal staff cannot approve',async()=>{
 const f=fixture(),input=countInput(),created=await f.inbound.create(input,staff);assert.equal(created.draft.createdBy,String(staff.id));assert.equal((await f.inbound.create(input,staff)).replayed,true);assert.equal(f.state.counts.length,1);
 assert.equal((await f.inbound.list(staff)).length,1);assert.equal((await f.inbound.list(other)).length,0);assert.equal((await f.inbound.list(manager)).length,1);
 await assert.rejects(()=>f.inbound.draft(created.draft.id,other),{statusCode:403});await assert.rejects(()=>f.inbound.update(created.draft.id,{...input,requestId:randomUUID(),expectedRevision:created.draft.revision},other),{statusCode:403});await assert.rejects(()=>f.inbound.decide('1',{requestId:randomUUID()},staff,true),{statusCode:403});
 const changed=await f.inbound.update(created.draft.id,{...input,requestId:randomUUID(),note:'Changed own count',expectedRevision:created.draft.revision},staff);assert.equal(changed.draft.note,'Changed own count');assert.equal(changed.draft.createdBy,String(staff.id));
 f.state.people[0].employeeActive=false;await assert.rejects(()=>f.inbound.list(staff),{statusCode:403});
});
test('personal stock-count draft reaches existing native daily scope, but staff cannot approve or enter financial flow',async()=>{
 const f=fixture();let effects=0;const draft={requestId:randomUUID(),date:'2026-10-22',note:'Synthetic stock count',lines:[{productId:1,countedQuantity:10}]};
 const result=await f.store.daily('count',staff,c=>c.journal('stock_count_draft',draft,async()=>{assert.equal(isCleanStoreDayMutation(),true);effects++;return {id:80100};}));assert.equal(result.id,80100);assert.equal(effects,1);assert.equal(f.state.tradeRequests[0].actor_id,staff.id);
 await assert.rejects(()=>f.store.daily('count',staff,c=>c.journal('stock_count_approve',{...draft,requestId:randomUUID()},async()=>assert.fail())),{statusCode:403});await assert.rejects(()=>f.store.readFinance(staff,()=>assert.fail()),{statusCode:403});
});
test('personal finance preserves finite currency cases and own cancellation; wrong role, inactive link and forged witness never reach a motor',async()=>{
 Object.assign(process.env,{MELISA_CLEAN_FINANCE:'20261022',MELISA_CLEAN_FINANCE_B4:'20261023',MELISA_CLEAN_FINANCE_CASH:'20261023',MELISA_CLEAN_FINANCE_FX:'20261023'});
 try{const f=fixture(),q=f.q;for(const profile of [CLEAN_FINANCE_REHEARSAL,...CLEAN_FINANCE_FX_CASES])for(const operation of ['collection_create','payment','collection_cancel','payment_cancel']){
  const tx=new q.Transaction();await tx.begin();await proveCleanPersonalWorkActor(tx,q,finance,'finance');const requestId=randomUUID(),cancel=operation.endsWith('_cancel'),payload={actorId:String(finance.id),operation,requestId,documentDate:'2026-10-22',...(cancel?{id:'90104',reason:'Synthetic reversal'}:operation==='payment'?{supplierId:profile.supplierId,invoiceId:profile.purchaseInvoiceId,accountId:profile.accountId,currency:profile.currency,amountExact4:'10.0000'}:{invoiceId:profile.invoiceId,accountId:profile.accountId,amountExact4:'10.0000'}),...(profile===CLEAN_FINANCE_REHEARSAL?{}:{financeCaseId:profile.id})};
  const binding=p=>{const payloadJson=JSON.stringify(p);return {transaction:tx,sqlDriver:q,actor:finance,operation,requestId,profile:profile.id,payloadJson,payloadHash:createHash('sha256').update(payloadJson,'utf16le').digest('hex')};};
  let entered=0;await withCleanFinanceRehearsalMutation(binding(payload),async()=>{assert.equal(isCleanStoreDayMutation(),true);assert.equal(tx.intent.actor_id,finance.id);entered++;});assert.equal(entered,1);
  await assert.rejects(()=>withCleanFinanceRehearsalMutation({...binding(payload),actor:staff},async()=>assert.fail()));if(cancel)await assert.rejects(()=>withCleanFinanceRehearsalMutation(binding({...payload,id:'90103'}),async()=>assert.fail()));else await assert.rejects(()=>withCleanFinanceRehearsalMutation(binding({...payload,accountId:'999'}),async()=>assert.fail()));
  await tx.rollback();
 }
 const tx=new q.Transaction();await tx.begin();f.state.people[3].employeeActive=false;tx.data=structuredClone(f.state);await assert.rejects(()=>proveCleanPersonalWorkActor(tx,q,finance,'finance'),{statusCode:403});await tx.rollback();
 }finally{for(const key of ['MELISA_CLEAN_FINANCE','MELISA_CLEAN_FINANCE_B4','MELISA_CLEAN_FINANCE_CASH','MELISA_CLEAN_FINANCE_FX'])delete process.env[key];}
});
test('personal cashier uses the original same transaction binding and unchanged drawer, currency and amount limits',async()=>{
 Object.assign(process.env,{MELISA_CLEAN_FINANCE:'20261022',MELISA_CLEAN_FINANCE_B4:'20261023',MELISA_CLEAN_FINANCE_CASH:'20261023'});
 try{const f=fixture(),q=f.q,tx=new q.Transaction();await tx.begin();const pool={},requestId=randomUUID(),payload={actorId:String(finance.id),operation:'cash_expense',requestId,expectedRevision:'a'.repeat(64),sessionId:1,categoryId:1,currency:'TRY',amount:2,description:'Synthetic expense',documentNo:'FIX-B5-1'};
 const bind=p=>{const payloadJson=JSON.stringify(p);return {pool,transaction:tx,sqlDriver:q,actor:finance,operation:p.operation,requestId,payloadJson,payloadHash:createHash('sha256').update(payloadJson,'utf16le').digest('hex')};};
 const context={pool,transaction:tx,sqlDriver:q};await withCleanFinanceCashMutation(bind(payload),async()=>{assert.equal(assertCleanCashRegisterTransaction(context,'cash_expense',finance),context);assert.throws(()=>assertCleanCashRegisterTransaction(context,'cash_expense',staff));assert.throws(()=>assertCleanCashRegisterTransaction({...context,transaction:{}},'cash_expense',finance));});
 for(const patch of [{currency:'GBP'},{amount:501},{categoryId:2},{actorId:String(staff.id)}])await assert.rejects(()=>withCleanFinanceCashMutation(bind({...payload,...patch}),async()=>assert.fail()));await tx.rollback();
 }finally{for(const key of ['MELISA_CLEAN_FINANCE','MELISA_CLEAN_FINANCE_B4','MELISA_CLEAN_FINANCE_CASH'])delete process.env[key];}
});
