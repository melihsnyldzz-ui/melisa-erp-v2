import fs from 'node:fs';
import path from 'node:path';
import { getTestPool, sql, root, SPEC, hash, requireRule, protectedManifest, literal } from './vega-native-migration-runtime.mjs';
export const run = 'm12-20260917-01';
export const dir = path.join(root, run);
const lineTables = ['sales_invoice_items','purchase_invoice_items','invoice_return_items','inventory_document_items','financial_document_items'];
const norm = v => String(v ?? '').trim().toLocaleUpperCase('tr-TR');
const generic = v => ['','URUN','STOK','DEVIR','AMBAR','KDV'].includes(norm(v));
const save = (n,v) => fs.writeFileSync(path.join(dir,n), JSON.stringify(v), { flag:'wx' });
const read = n => JSON.parse(fs.readFileSync(path.join(dir,n)));

export async function buildPlan(request) {
  const products = (await request().query('SELECT id,stock_code,name,brand,category FROM dbo.products')).recordset;
  const aliases = (await request().query('SELECT source_product_id,product_id FROM dbo.product_source_aliases')).recordset;
  const barcodes = (await request().query('SELECT product_id,barcode,is_active FROM dbo.product_barcodes')).recordset;
  const decisions = (await request().query("SELECT id,status,details_json FROM dbo.migration_decisions WHERE reason=N'HISTORICAL_LINE_PRODUCT_LINK_REVIEW' AND status IN(N'UNRESOLVED',N'SOURCE_SNAPSHOT_ONLY') ORDER BY id")).recordset;
  const lines = [];
  for (const table of lineTables) {
    const columns = ['id','source_record_key','product_id','source_product_id','source_stock_code','source_product_name','brand_snapshot','category_snapshot'];
    if (table === 'sales_invoice_items' || table === 'purchase_invoice_items') columns.push('barcode_snapshot');
    lines.push(...(await request().query('SELECT '+columns.join(',')+' FROM dbo.'+table+' WHERE source_record_key IS NOT NULL AND product_id IS NULL')).recordset.map(row => ({...row,table})));
  }
  const bySource = new Map(lines.map(row => [row.source_record_key,row]));
  const aliasMap = new Map(aliases.map(row => [String(row.source_product_id),String(row.product_id)]));
  const byCode = new Map(), byBarcode = new Map();
  for (const p of products) { const k=norm(p.stock_code); if(!byCode.has(k))byCode.set(k,[]); byCode.get(k).push(p); }
  for (const b of barcodes) { const k=norm(b.barcode); if(!byBarcode.has(k))byBarcode.set(k,[]); byBarcode.get(k).push(b); }
  const safe=[], manual=[];
  for (const d of decisions) {
    const source=JSON.parse(d.details_json).sourceKey, line=bySource.get(source), company=source.split('/')[1];
    if (!line) { manual.push({decisionId:d.id,sourceKey:source,reason:'TARGET_LINE_NOT_FOUND'}); continue; }
    const candidates=new Map(), evidence=[];
    if (company==='F0102' && aliasMap.has(String(line.source_product_id))) { const p=aliasMap.get(String(line.source_product_id)); candidates.set(p,'F0102_SOURCE_PRODUCT_ID'); evidence.push({type:'source_product_id',value:line.source_product_id}); }
    const codeRows=byCode.get(norm(line.source_stock_code))||[];
    if (!generic(line.source_stock_code) && codeRows.length===1) { candidates.set(String(codeRows[0].id),'UNIQUE_STOCK_CODE'); evidence.push({type:'stock_code',value:line.source_stock_code}); }
    if (company==='F0103' && generic(line.source_stock_code) && !generic(line.source_product_name) && /^[A-Z0-9][A-Z0-9 ._()/-]{1,40}$/i.test(String(line.source_product_name||''))) {
      const nameRows=byCode.get(norm(line.source_product_name))||[];
      if(nameRows.length===1){candidates.set(String(nameRows[0].id),'F0103_LINE_NAME_AS_STOCK_CODE');evidence.push({type:'line_name_as_stock_code',value:line.source_product_name});}
    }
    if (company==='F0102' && line.barcode_snapshot) { const bs=(byBarcode.get(norm(line.barcode_snapshot))||[]).filter(b=>b.is_active); if(bs.length===1){candidates.set(String(bs[0].product_id),'UNIQUE_ACTIVE_BARCODE');evidence.push({type:'barcode',value:line.barcode_snapshot});} }
    if (candidates.size===1) { const x=candidates.entries().next().value; safe.push({decisionId:d.id,sourceKey:source,table:line.table,lineId:line.id,productId:x[0],method:x[1],evidence}); }
    else { const reason=candidates.size>1?'CONFLICTING_PRODUCT_EVIDENCE':company==='F0103'&&generic(line.source_stock_code)?'F0103_GENERIC_STOCK_CODE_OR_NONUNIQUE_LINE_NAME':company==='F0102'&&!aliasMap.has(String(line.source_product_id))?'F0102_SOURCE_PRODUCT_NOT_IN_TARGET':'NO_UNIQUE_TARGET_PRODUCT'; manual.push({decisionId:d.id,sourceKey:source,table:line.table,lineId:line.id,reason,sourceProductId:line.source_product_id,sourceStockCode:line.source_stock_code,sourceProductName:line.source_product_name,candidateProducts:[...candidates.keys()],evidence}); }
  }
  return {run,totalDecisions:decisions.length,totalLines:lines.length,safe,manual,summary:{total:decisions.length,automatic:safe.length,manual:manual.length,reasonCounts:manual.reduce((a,r)=>(a[r.reason]=(a[r.reason]||0)+1,a),{}),byTable:Object.entries(Object.groupBy(safe,r=>r.table)).map(([table,rows])=>({table,automatic:rows.length}))}};
}

async function structural(request) {
  const fields=['id','source_record_key','source_payload_hash','source_document_key','document_id','source_product_id','source_stock_code','source_product_name','quantity_exact','unit_price_source','line_total_source','currency_code','exchange_rate','discount_rates_json','description','unit_name','unit_multiplier','brand_snapshot','category_snapshot'];
  const out={}; for(const table of lineTables) out[table]=hash((await request().query('SELECT '+fields.join(',')+' FROM dbo.'+table+' WHERE source_record_key IS NOT NULL ORDER BY id')).recordset); return out;
}
async function state(request){return {structural:await structural(request),terminal:(await protectedManifest(request)).hash};}
async function backup(pool,request) {
  const before=await state(request); save('before-state.json',before);
  const backupPath=(await request().query("SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) dir")).recordset[0].dir;
  const file=path.win32.join(backupPath,SPEC.target+'_before_'+run+'.bak');
  requireRule(path.win32.isAbsolute(backupPath)&&path.win32.dirname(file)===path.win32.normalize(backupPath).replace(/\\$/,''),'BACKUP_PATH');
  requireRule((await request().input('p',sql.NVarChar(4000),file).query('SELECT file_exists FROM sys.dm_os_file_exists(@p)')).recordset[0].file_exists===0,'BACKUP_EXISTS');
  await request().query('BACKUP DATABASE ['+SPEC.target+'] TO DISK='+literal(file)+' WITH COPY_ONLY,CHECKSUM,NOINIT,NAME='+literal(run));
  await request().query('RESTORE VERIFYONLY FROM DISK='+literal(file)+' WITH CHECKSUM');
  const h=(await request().query('RESTORE HEADERONLY FROM DISK='+literal(file))).recordset;
  requireRule(h.length===1&&h[0].DatabaseName===SPEC.target&&h[0].IsCopyOnly&&h[0].HasBackupChecksums,'BACKUP_HEADER');
  const receipt={run,target:SPEC.target,file,guid:h[0].BackupSetGUID,bytes:String(h[0].BackupSize),verified:true,restoreExecuted:false,at:new Date().toISOString()};save('backup-receipt.json',receipt);return receipt;
}

async function apply(pool,plan) {
  requireRule(read('backup-receipt.json').verified,'VERIFIED_BACKUP_REQUIRED');
  const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const q=()=>new sql.Request(tx);let committed=false;
  try {
    await q().query("SET XACT_ABORT ON; DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'M12_PRODUCT_LINK_TEST',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 51000,'M12_LOCK_FAILED',1;");
    const prior=(await q().input('run',run).query('SELECT COUNT(*) n FROM dbo.migration_runs WHERE migration_run_id=@run')).recordset[0].n;
    requireRule(Number(prior)===0,'M12_ALREADY_COMMITTED');
    for(const [table,rows] of Object.entries(Object.groupBy(plan.safe,r=>r.table))) for(let i=0;i<rows.length;i+=500) await q().input('j',sql.NVarChar(sql.MAX),JSON.stringify(rows.slice(i,i+500))).query("UPDATE t SET product_id=s.productId,product_link_status=N'RESOLVED_M12_EVIDENCE' FROM dbo."+table+' t JOIN OPENJSON(@j) WITH(lineId bigint,productId bigint) s ON s.lineId=t.id WHERE t.product_id IS NULL;');
    const insert = async rows => {
      const b=rows.map(o=>({recordType:'M1.2_product_link',reason:o.reason,status:o.status,details:JSON.stringify(o.details),sourceRecordKey:'M12/M1.2_product_link/'+o.decisionId,relatedSourceKey:o.sourceKey,payloadHash:hash(o.details)}));
      await q().input('j',sql.NVarChar(sql.MAX),JSON.stringify(b)).input('run',run).query('INSERT dbo.migration_decisions(record_type,reason,status,details_json,source_record_key,migration_run_id,source_payload_hash,source_payload_json,related_source_key) SELECT recordType,reason,status,details,sourceRecordKey,@run,payloadHash,details,relatedSourceKey FROM OPENJSON(@j) WITH(recordType nvarchar(80),reason nvarchar(120),status nvarchar(40),details nvarchar(max),sourceRecordKey nvarchar(250),relatedSourceKey nvarchar(250),payloadHash char(64));');
    };
    for(let i=0;i<plan.safe.length;i+=500) await insert(plan.safe.slice(i,i+500).map(r=>({decisionId:r.decisionId,sourceKey:r.sourceKey,status:'RESOLVED',reason:'AUTOMATIC_EVIDENCE_MATCH',details:{decisionId:r.decisionId,table:r.table,lineId:r.lineId,targetProductId:r.productId,method:r.method,evidence:r.evidence}})));
    for(let i=0;i<plan.manual.length;i+=500) await insert(plan.manual.slice(i,i+500).map(r=>({decisionId:r.decisionId,sourceKey:r.sourceKey,status:'UNRESOLVED',reason:r.reason,details:{decisionId:r.decisionId,table:r.table,lineId:r.lineId,sourceProductId:r.sourceProductId,sourceStockCode:r.sourceStockCode,sourceProductName:r.sourceProductName,candidateProducts:r.candidateProducts||[],status:'Manual Decision Required'}})));
    const report={run,target:SPEC.target,total:plan.totalDecisions,automatic:plan.safe.length,manual:plan.manual.length,manualReasons:plan.summary.reasonCounts,linesUpdated:plan.safe.length,stockEffectsCreated:0,documentEffectsCreated:0,rollback:false,committed:true,status:'COMMITTED_M12_PRODUCT_LINK_REVIEW_REMAINS',at:new Date().toISOString(),structuralBefore:read('before-state.json').structural};
    await q().input('run',run).input('target',SPEC.target).input('j',sql.NVarChar(sql.MAX),JSON.stringify(report)).query("INSERT dbo.migration_runs(run_name,status,target_database,source_snapshot,start_date,finished_at,receipt_json,source_record_key,migration_run_id) VALUES(@run,N'COMMITTED_M12_PRODUCT_LINK_REVIEW_REMAINS',@target,N'spec-20260917-01','20200101',SYSUTCDATETIME(),@j,N'RUN/'+@run,@run)");
    await tx.commit();committed=true;save('commit-receipt.json',report);console.log(JSON.stringify(report));
  } catch(e) { if(!committed){try{await tx.rollback()}catch{}} console.error(e?.stack||e); throw e; }
}

const mode=process.argv[2];requireRule(['--plan','--backup','--commit-test'].includes(mode)&&process.argv.length===3,'M12_MODE_REQUIRED');if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:false});const pool=await getTestPool();
try { if(mode==='--plan'){const p=await buildPlan(()=>pool.request());save('plan.json',p);console.log(JSON.stringify(p.summary));} else if(mode==='--backup'){const p=await buildPlan(()=>pool.request());requireRule(hash(p)===hash(read('plan.json')),'PLAN_CHANGED');console.log(JSON.stringify(await backup(pool,()=>pool.request())));} else await apply(pool,read('plan.json')); } finally { await pool.close(); }
