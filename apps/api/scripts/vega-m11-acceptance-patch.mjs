// Updates acceptance decisions only. No commercial row or source write.
import fs from 'node:fs';import path from 'node:path';
import {getTestPool,sql,root,SPEC,hash,requireRule,literal,protectedManifest} from './vega-native-migration-runtime.mjs';
const run='m11-20260917-patch01',dir=path.join(root,run),read=(d,n)=>JSON.parse(fs.readFileSync(path.join(root,d,n)));
const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v),{flag:'wx'});
requireRule(process.argv.length===3&&process.argv[2]==='--commit-test','EXPLICIT_TEST_COMMIT_REQUIRED');fs.mkdirSync(dir);
const pool=await getTestPool(),q=()=>pool.request();
const gaps=read('m11-20260917-before','barcode-original-1120.json'),gapMap=new Map(gaps.map(g=>[g.barcode,g]));
const differences=fs.readFileSync(path.join(root,'m11-20260917-before/record-differences.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const baseline=read('m11-20260917-before','acceptance-report.json'),source=read('m11-20260917-source','receipt.json'),deltas=read('m11-20260917-source','delta-summary.json');
async function state(request){
 const tables={};for(const t of ['product_barcodes','party_currency_accounts'])tables[t]=hash((await request().query(`SELECT (SELECT * FROM dbo.${t} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) j`)).recordset[0].j);
 tables.terminal=(await protectedManifest(request)).hash;return tables;
}
try{
 const prior=(await q().input('run',run).query('SELECT id FROM dbo.migration_runs WHERE run_name=@run')).recordset;requireRule(!prior.length,'RUN_ALREADY_COMMITTED');
 const decisions=(await q().query("SELECT id,status,details_json,source_record_key FROM dbo.migration_decisions WHERE record_type=N'barcode_previous_gap'")).recordset;
 const updates=decisions.flatMap(d=>{const old=JSON.parse(d.details_json),g=gapMap.get(old.barcode),next=g?.resolved?'RESOLVED':'UNRESOLVED';return g&&next!==d.status?[{id:d.id,old:d.status,next,barcode:old.barcode,canonicalSourceId:g.canonicalSourceId,expectedProduct:g.matches[0]?.product_id??null,reason:g.resolved?'TRIMMED_BARCODE_SAME_ACTIVE_PRODUCT':'CONFLICT_QUARANTINE_NOT_RESOLVED',sourceKey:d.source_record_key}]:[];});
 requireRule(updates.length===4&&updates.filter(u=>u.next==='RESOLVED').length===2,'EXPECTED_CLASSIFICATION_FIXES');
 // Prove the current lookup, not only the saved report, before changing status.
 for(const u of updates){const found=(await q().input('b',u.barcode.trim()).query('SELECT id,product_id FROM dbo.product_barcodes WHERE barcode=@b AND is_active=1')).recordset;
  if(u.next==='RESOLVED'){const alias=(await q().input('s',Number(u.canonicalSourceId)).query('SELECT product_id FROM dbo.product_source_aliases WHERE source_product_id=@s')).recordset;requireRule(alias.length===1&&found.length===1&&String(alias[0].product_id)===String(found[0].product_id),'BARCODE_OWNER_CHANGED');}
  else requireRule(found.length===0,'QUARANTINE_CHANGED');
 }
 const before=await state(q);requireRule(before.terminal===baseline.terminalHash,'TERMINAL_CHANGED');save('before.json',{updates,state:before});
 const backupDir=(await q().query("SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) dir")).recordset[0].dir,file=path.win32.join(backupDir,`${SPEC.target}_before_${run}.bak`);
 requireRule(path.win32.isAbsolute(backupDir)&&path.win32.dirname(file)===path.win32.normalize(backupDir).replace(/\\$/,''),'BACKUP_PATH');
 requireRule((await q().input('p',file).query('SELECT file_exists FROM sys.dm_os_file_exists(@p)')).recordset[0].file_exists===0,'BACKUP_EXISTS');
 await q().query(`BACKUP DATABASE [MELISA_ERP_FULL_TEST_20260916] TO DISK=${literal(file)} WITH COPY_ONLY,CHECKSUM,NOINIT,NAME=${literal(run)}`);
 await q().query(`RESTORE VERIFYONLY FROM DISK=${literal(file)} WITH CHECKSUM`);
 const h=(await q().query(`RESTORE HEADERONLY FROM DISK=${literal(file)}`)).recordset;requireRule(h.length===1&&h[0].DatabaseName===SPEC.target&&h[0].IsCopyOnly&&h[0].HasBackupChecksums,'BACKUP_HEADER');
 save('backup-receipt.json',{run,file,guid:h[0].BackupSetGUID,verified:true,restoreExecuted:false});console.log(JSON.stringify({phase:'backup',verified:true}));
 const reviews=differences.filter(d=>d.reason==='TYPE90_OPERATING_EFFECT_DISABLED_REVIEW').map(d=>({sourceKey:`M11/TYPE90/${hash(d.record)}`,related:d.record,reason:'DATED_DEVIR_BALANCE_EFFECT_REQUIRES_DECISION',detail:JSON.stringify({...d,status:'Manual Decision Required',plan:'Confirm whether this dated DEVIR record is an actual period transaction or a repeated opening; preserve history and reconcile currencies before posting any correction.'})}));
 for(const t of source.changed)reviews.push({sourceKey:'M11/SOURCE-DRIFT/'+t.table,related:t.table,reason:'SOURCE_CHANGED_AFTER_MIGRATION_CAPTURE',detail:JSON.stringify({table:t.table,oldCount:t.expectedCount,currentCount:t.count,delta:deltas.results.find(r=>r.table===t.table),status:'Manual Decision Required',plan:'Agree a source cutoff and replay the record-level delta with terminal/document deduplication; no blind overwrite.'})});
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const tr=()=>new sql.Request(tx);let committed=false;
 try{
  await tr().query("SET XACT_ABORT ON; DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'M11_ACCEPTANCE_TEST_ONLY',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 51000,'M11_LOCK_FAILED',1;");
  requireRule(hash(await state(tr))===hash(before),'PROTECTED_STATE_CHANGED');
  for(const u of updates){const r=await tr().input('id',sql.BigInt,u.id).input('old',u.old).input('next',u.next).query('UPDATE dbo.migration_decisions SET status=@next WHERE id=@id AND status=@old; SELECT @@ROWCOUNT n');requireRule(r.recordset[0].n===1,'DECISION_CONCURRENT_CHANGE');}
  const all=[...reviews,...updates.map(u=>({sourceKey:'M11/BARCODE-CLASSIFICATION/'+u.id,related:u.sourceKey,reason:u.reason,status:'RESOLVED',detail:JSON.stringify(u)}))];
  await tr().input('j',sql.NVarChar(sql.MAX),JSON.stringify(all)).input('run',run).query(`INSERT dbo.migration_decisions(record_type,reason,status,details_json,source_record_key,migration_run_id,related_source_key)
SELECT N'M1.1_acceptance',reason,COALESCE(status,N'UNRESOLVED'),detail,sourceKey,@run,related FROM OPENJSON(@j) WITH(reason nvarchar(120),status nvarchar(40),detail nvarchar(max),sourceKey nvarchar(250),related nvarchar(250));`);
  requireRule(hash(await state(tr))===hash(before),'BUSINESS_STATE_CHANGED');
  const report={...baseline,run,acceptanceRun:baseline.run,at:new Date().toISOString(),migration:'FAIL',status:'COMMITTED_ACCEPTANCE_FAIL',sourceFreshness:{tables:source.tables,matched:source.matched,changed:source.changed.length,atomicSnapshot:false},corrections:{resolvedWhitespaceFalsePositives:2,reopenedQuarantinedFalsePositives:2,barcodeOwnershipChanges:0},addedManualDecisions:reviews.length,committed:true,rollback:false,sourceWrites:0,commercialDataWrites:0,targetMetadataWrites:all.length+updates.length+1,qaAccepted:false,businessAccepted:false};
  await tr().input('run',run).input('target',SPEC.target).input('j',sql.NVarChar(sql.MAX),JSON.stringify(report)).query("INSERT dbo.migration_runs(run_name,status,target_database,source_snapshot,start_date,finished_at,receipt_json,source_record_key,migration_run_id) VALUES(@run,N'COMMITTED_ACCEPTANCE_FAIL',@target,N'spec-20260917-01','20200101',SYSUTCDATETIME(),@j,N'RUN/'+@run,@run)");
  await tx.commit();committed=true;save('acceptance-report.json',report);save('manual-decision-additions.json',reviews);save('commit-receipt.json',{run,committed:true,rollback:false,updates,manualDecisions:reviews.length,terminalHash:before.terminal});console.log(JSON.stringify({run,committed:true,rollback:false,updates:updates.length,manualDecisions:reviews.length,migration:'FAIL'}));
 }catch(e){if(!committed){try{await tx.rollback();}catch{}}throw e;}
 const after=await state(q);requireRule(hash(after)===hash(before),'POST_COMMIT_STATE_CHANGED');
 const statuses=(await q().input('run',run).query('SELECT reason,status,COUNT(*) n FROM dbo.migration_decisions WHERE migration_run_id=@run GROUP BY reason,status')).recordset;save('post-commit-check.json',{businessStateUnchanged:true,terminalHash:after.terminal,statuses});
}finally{await pool.close();}
