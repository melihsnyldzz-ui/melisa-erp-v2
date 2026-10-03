import {getSqlPool,getSqlDriver} from '../config/database.js';
import {env} from '../config/env.js';
import {nativeError} from './nativeTerminalPolicy.mjs';

// A TEST launcher may opt in to this single audited write. All other read-only
// protections remain unchanged. Production uses the usual ERP write gate.
export function packingAuditStore({testTarget=false}={}){
 return {async transaction(invoiceId,work){
  const pool=await getSqlPool(),sql=getSqlDriver();
  if(testTarget){
   const row=(await pool.request().query("SELECT DB_NAME() AS db,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS server")).recordset[0];
   if(row.db!=='MELISA_ERP_FULL_TEST_20260916'||row.server.toLowerCase()!=='semih\\melisadev')throw Error('Packing TEST target guard failed');
  }else if(env.sql.readOnly||env.sql.database!=='MELISA_ERP_V2')nativeError('PACKING_AUDIT_DISABLED','Paketleme audit kaydı bu bağlantıda kapalı.',503);
  const tx=new sql.Transaction(pool);await tx.begin();
  const request=()=>new sql.Request(tx);
  try{
   // Keep invoice quantities/status stable until its packing audit is committed.
   await request().input('id',sql.BigInt,invoiceId).query('SELECT id FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@id; SELECT id FROM dbo.sales_invoice_items WITH(HOLDLOCK) WHERE sales_invoice_id=@id;');
   const result=await work({
    async find(requestId){
     const row=(await request().input('id',sql.BigInt,invoiceId).input('requestId',sql.NVarChar(36),requestId).query("SELECT TOP(1) id,after_json FROM dbo.audit_logs WHERE entity_type=N'terminal_packing' AND entity_id=@id AND JSON_VALUE(after_json,'$.requestId')=@requestId ORDER BY id DESC")).recordset[0];
     return row?{...JSON.parse(row.after_json),auditId:String(row.id)}:null;
    },
    async append(event){
     const clock=(await request().query('SELECT SYSUTCDATETIME() AS now')).recordset[0].now;
     const entry={...event,recordedAt:clock.toISOString()};
     const saved=await request().input('actor',sql.BigInt,event.actorId).input('id',sql.BigInt,invoiceId)
      .input('action',sql.NVarChar(80),event.status==='PACKED'?'native_packing_completed':'native_packing_exception')
      .input('json',sql.NVarChar(sql.MAX),JSON.stringify(entry)).input('reason',sql.NVarChar(500),event.reason)
      .input('at',sql.DateTime2,clock).query("INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source,created_at) OUTPUT INSERTED.id VALUES(@actor,@action,N'terminal_packing',@id,@json,@reason,N'native-terminal',@at)");
     return {...entry,auditId:String(saved.recordset[0].id)};
    }
   });await tx.commit();return result;
  }catch(e){try{await tx.rollback();}catch{}throw e;}
 }};
}
