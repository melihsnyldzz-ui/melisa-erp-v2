// TEST-only operational quarantine. Source identity is never inferred from a card code/name.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUN,sql,testPool,readSource,readPrivate,privateRoot} from './target-opening-runtime.mjs';
import {hash,requireRule} from './mapping-opening.mjs';
import {EXPECTED,targetGuard} from './accepted-opening-prices.mjs';
import {guardSql,readerSql,guardTables,holdFields,holdOpenJson,rowHash,aggregateSeal} from './operation-quarantine-sql.mjs';

const sourceDir=privateRoot+'/source-capture-06',purpose='OPERATION-QUARANTINE-01';
const scope=p=>p.scope?.startsWith('IN_SCOPE');
const uniq=a=>[...new Set(a)];
const sameId=(a,b)=>a!==null&&a!==undefined&&b!==null&&b!==undefined&&String(a)===String(b);
const nativeKey=p=>`VEGA2026/${p.company??'F0102'}${p.role?'TBLCARI':'TBLSTOKLAR'}/${p.sourceId}`;
export function resolveHolds(snapshot,plan,native){
  const accepted=new Map(['product','customer','supplier'].map(entity=>[entity,new Set(plan.plans.filter(p=>p.table===({product:'products',customer:'customers',supplier:'suppliers'})[entity]).map(p=>p.sourceKey))]));
  const acceptedIds=new Map(['product','customer','supplier'].map(entity=>[entity,new Set(plan.plans.filter(p=>p.table===({product:'products',customer:'customers',supplier:'suppliers'})[entity]).map(p=>String(p.targetId)))]));
  const rows=[];
  for(const source of [...snapshot.products.filter(p=>scope(p)&&!accepted.get('product').has(p.sourceKey)),...snapshot.parties.filter(p=>scope(p)&&!accepted.get(p.role).has(p.sourceKey))]){
    const entity=source.role??'product',table=entity==='product'?native.products:native[entity+'s'],key=nativeKey(source),linked=entity==='product'?native.aliases.filter(a=>sameId(a.source_product_id,source.sourceId)).map(a=>String(a.product_id)):native.links.filter(l=>l.source_company===source.company&&sameId(l.source_id,source.sourceId)&&l[entity+'_id']!==null).map(l=>String(l[entity+'_id']));
    const direct=table.filter(r=>r.source_record_key===key).map(r=>String(r.id)),candidates=uniq([...linked,...direct]);
    requireRule(linked.length<=1&&direct.length<=1&&candidates.length<=1,'QUARANTINE_AMBIGUOUS_NATIVE_IDENTITY');
    requireRule(candidates.every(id=>!acceptedIds.get(entity).has(id)),'QUARANTINE_ACCEPTED_NATIVE_INTERSECTION');
    if(entity==='product')requireRule(candidates.length===1,'QUARANTINE_PRODUCT_TARGET_MISSING');
    const target=candidates.length?table.find(r=>sameId(r.id,candidates[0])):null;requireRule(!candidates.length||target,'QUARANTINE_ORPHAN_NATIVE_ID');
    if(target){
      requireRule(target.source_record_key===key,'QUARANTINE_NATIVE_SOURCE_KEY_DRIFT');
      const owners=entity==='product'?native.aliases.filter(a=>sameId(a.product_id,target.id)):native.links.filter(l=>sameId(l[entity+'_id'],target.id));
      requireRule(owners.length===1,'QUARANTINE_MULTIPLE_SOURCE_OWNERS');
      requireRule(linked.length===1&&direct.length===1,'QUARANTINE_DOUBLE_IDENTITY_PROOF_REQUIRED');
    }
    const reasons=uniq(plan.quarantine.filter(q=>q.sourceKey===source.sourceKey&&q.entity!=='product-price').map(q=>q.reason));
    if(!target)reasons.push('NATIVE_TARGET_NOT_PRESENT');
    if(source.role&&source.nativeBalanceMapped===null)reasons.push('SOURCE_BALANCE_UNKNOWN');
    if(source.role&&!['TRY','USD','EUR'].includes(source.currency))reasons.push('SOURCE_CURRENCY_UNKNOWN');
    rows.push({entity,source_key:source.sourceKey,source_id:String(source.sourceId),source_company:source.company??'F0102',source_code:source.stockCode??source.code,source_name:source.name,native_id:target?String(target.id):null,native_entity_id:target?.party_entity_id==null?null:String(target.party_entity_id),native_source_key:key,native_code:target?(target.stock_code??target.code):null,native_name:target?.name??null,status:target?'blocked':'not-present',reasons_json:JSON.stringify(reasons.sort()),binding_basis:target?'EXACT_SOURCE_ALIAS_AND_NATIVE_KEY':'UNRESOLVED_SOURCE_ONLY'});
  }
  requireRule(rows.length===176&&rows.filter(r=>r.entity==='product').length===54&&rows.filter(r=>r.entity==='customer').length===28&&rows.filter(r=>r.entity==='supplier').length===94&&rows.filter(r=>r.native_id!==null).length===172&&rows.filter(r=>r.native_id===null&&r.entity==='supplier').length===4,'QUARANTINE_FROZEN_COUNTS_CHANGED');
  requireRule(new Set(rows.filter(r=>r.native_id!==null).map(r=>r.entity+'/'+r.native_id)).size===172,'QUARANTINE_DUPLICATE_NATIVE_HOLD');
  const acceptedEntityIds=new Set([...native.customers.filter(r=>acceptedIds.get('customer').has(String(r.id))),...native.suppliers.filter(r=>acceptedIds.get('supplier').has(String(r.id)))].filter(r=>r.party_entity_id!==null).map(r=>String(r.party_entity_id)));
  requireRule(rows.every(r=>r.native_entity_id===null||!acceptedEntityIds.has(r.native_entity_id)),'QUARANTINE_ACCEPTED_ENTITY_INTERSECTION');
  return rows.sort((a,b)=>a.entity.localeCompare(b.entity)||a.source_key.localeCompare(b.source_key));
}
async function nativeProjection(request){
  const q=async s=>(await request().query(s)).recordset;
  return {products:await q('SELECT id,stock_code,name,source_record_key FROM dbo.products'),customers:await q('SELECT id,customer_code code,name,source_record_key,party_entity_id FROM dbo.customers'),suppliers:await q('SELECT id,supplier_code code,name,source_record_key,party_entity_id FROM dbo.suppliers'),aliases:await q('SELECT id,product_id,source_product_id,source_record_key FROM dbo.product_source_aliases'),links:await q('SELECT id,customer_id,supplier_id,source_company,source_id,source_record_key,party_entity_id FROM dbo.party_source_links')};
}
async function fingerprints(request,tables){
  const out={};for(const full of tables){const[schema,table]=full.split('.');requireRule(/^[a-z_]+$/i.test(schema+table),'SQL_IDENTIFIER_REQUIRED');
    if(schema==='dbo'){const rows=(await request().query(`SELECT x.id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM dbo.[${table}] x ORDER BY x.id`)).recordset;out[full]={count:rows.length,hash:hash(rows)};}
    else {const order=table==='runs'?'run_id':'run_id,entity,source_key';out[full]=(await request().query(`SELECT COUNT_BIG(*) n,CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CAST(h AS varchar(max)),'') WITHIN GROUP(ORDER BY ${order})),2) hash FROM(SELECT ${order},CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM erp_migration.[${table}] x)y`)).recordset[0];}
  }return out;
}
async function preservedMetadata(request){
  const guards=(await request().query("SELECT name,is_disabled,OBJECT_DEFINITION(object_id) definition,OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger') first_d FROM sys.triggers WHERE name LIKE 'test[_]guard[_]%' ORDER BY name")).recordset;
  const prices={};for(const table of ['accepted_price_manifest','accepted_price_products','accepted_price_values']){const key=table==='accepted_price_manifest'?'run_id':table==='accepted_price_products'?'product_id':'price_id';const rows=(await request().query(`SELECT CONVERT(varchar(100),x.${key}) row_key,CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) row_hash FROM erp_migration.${table} x ORDER BY x.${key}`)).recordset;prices[table]={count:rows.length,hash:hash(rows)};}
  const procs=(await request().query("SELECT name,OBJECT_DEFINITION(object_id) definition FROM sys.procedures WHERE name IN(N'usp_get_accepted_opening_prices',N'usp_list_accepted_opening_products') ORDER BY name")).recordset;
  const priceImmutable=(await request().query("SELECT name,is_disabled,OBJECT_DEFINITION(object_id) definition FROM sys.triggers WHERE name IN(N'immutable_accepted_price_manifest',N'immutable_accepted_price_products',N'immutable_accepted_price_values') ORDER BY name")).recordset;return{guards,prices,procs,priceImmutable};
}
async function validateInstalledObjects(request,seal){
  const triggers=(await request().query("SELECT name,parent_id,is_disabled,OBJECT_SCHEMA_NAME(parent_id) parent_schema,OBJECT_NAME(parent_id) parent_table,OBJECT_DEFINITION(object_id) definition,OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger') first_d FROM sys.triggers WHERE name LIKE 'operation[_]quarantine[_]%' OR name IN(N'immutable_operation_quarantine_manifest',N'immutable_operation_quarantine_holds') ORDER BY name")).recordset;
  requireRule(triggers.length===guardTables.length+2,'QUARANTINE_INSTALLED_GUARD_COUNT');
  for(const table of guardTables){const t=triggers.find(x=>x.name==='operation_quarantine_'+table);requireRule(t&&t.parent_schema==='dbo'&&t.parent_table===table&&!t.is_disabled&&t.first_i===1&&t.first_u===1&&t.first_d===1&&t.definition===guardSql(table,seal),'QUARANTINE_INSTALLED_GUARD_DRIFT');}
  for(const table of ['operation_quarantine_manifest','operation_quarantine_holds']){const t=triggers.find(x=>x.name==='immutable_'+table);requireRule(t&&t.parent_schema==='erp_migration'&&t.parent_table===table&&!t.is_disabled&&t.definition===immutableSql(table),'QUARANTINE_INSTALLED_IMMUTABLE_DRIFT');}
  const procs=(await request().query("SELECT name,OBJECT_DEFINITION(object_id) definition FROM sys.procedures WHERE name IN(N'usp_check_operation_quarantine',N'usp_list_operation_quarantine') ORDER BY name")).recordset;
  requireRule(procs.length===2&&procs.every(p=>p.definition===readerSql(p.name.includes('_check_')?'check':'list',seal)),'QUARANTINE_INSTALLED_READER_DRIFT');
  return{triggers,procs};
}
const immutableSql=table=>`CREATE TRIGGER erp_migration.immutable_${table} ON erp_migration.${table} INSTEAD OF INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;THROW 51076,'MIGRATION_OPERATION_QUARANTINED',1;END`;
const privateSave=(name,data)=>fs.writeFileSync(path.join(privateRoot,RUN,name),JSON.stringify(data,null,2),{flag:'wx'});
function verifyFrozenPlan(plan){const{planHash,...payload}=plan;requireRule(hash(payload)===planHash&&planHash===EXPECTED.planHash&&plan.sourceHash===EXPECTED.sourceHash,'QUARANTINE_SOURCE_PLAN_PIN');}
export async function prepareQuarantine(){
  const {snapshot,summary}=readSource(sourceDir),plan=readPrivate('native-plan.json');verifyFrozenPlan(plan);requireRule(summary.snapshotHash===EXPECTED.sourceHash,'QUARANTINE_SOURCE_PLAN_PIN');
  const pool=await testPool();try{const holds=resolveHolds(snapshot,plan,await nativeProjection(()=>pool.request())),inputHash=hash(holds);
    const rowHashes=(await pool.request().input('rows',sql.NVarChar(sql.MAX),JSON.stringify(holds)).query(`SELECT x.source_key,${rowHash('x')} row_hash FROM OPENJSON(@rows) WITH(${holdOpenJson})x ORDER BY x.source_key`)).recordset;
    const sealHash=(await pool.request().input('hashes',sql.NVarChar(sql.MAX),JSON.stringify(rowHashes)).query(`SELECT ${aggregateSeal('OPENJSON(@hashes) WITH(source_key nvarchar(250),row_hash char(64))')} seal_hash`)).recordset[0].seal_hash;
    requireRule(rowHashes.length===176,'QUARANTINE_SOURCE_ROWS_MISSING');const artifact={run:RUN,sourceHash:EXPECTED.sourceHash,planHash:EXPECTED.planHash,inputHash,sealHash,holds,rowHashes,guardDefinitionsHash:hash(guardTables.map(t=>guardSql(t,sealHash))),readerDefinitionsHash:hash(['check','list'].map(k=>readerSql(k,sealHash))),nativeWrites:0};
    const file=path.join(privateRoot,RUN,'quarantine-plan-03.json');if(fs.existsSync(file))requireRule(hash(JSON.parse(fs.readFileSync(file)))===hash(artifact),'QUARANTINE_DIFFERENT_PLAN_REJECTED');else privateSave('quarantine-plan-03.json',artifact);
    return {status:'PASS_READONLY_PREPARED',run:RUN,sourceRows:176,nativeHolds:172,notPresent:4,sealHash,inputHash,newBusinessGuards:guardTables.length,nativeWrites:0};
  }finally{await pool.close();}
}
export async function installQuarantine(){
  const {snapshot,summary}=readSource(sourceDir),plan=readPrivate('native-plan.json');verifyFrozenPlan(plan);requireRule(summary.snapshotHash===EXPECTED.sourceHash,'QUARANTINE_SOURCE_PLAN_PIN');
  const pool=await testPool();let tx=null;try{
    const tables=Object.keys(JSON.parse(fs.readFileSync(privateRoot+'/independent-replay-06.json')).before);requireRule(tables.length===37,'FULL_37_BASELINE_REQUIRED');
    const before=await fingerprints(()=>pool.request(),tables),metaBefore=await preservedMetadata(()=>pool.request());requireRule(metaBefore.guards.length===22&&metaBefore.guards.every(g=>!g.is_disabled)&&metaBefore.priceImmutable.length===3&&metaBefore.priceImmutable.every(g=>!g.is_disabled),'OLD_22_GUARDS_AND_PRICE_IMMUTABLE_REQUIRED');
    const holds=resolveHolds(snapshot,plan,await nativeProjection(()=>pool.request())),inputHash=hash(holds),prepared=readPrivate('quarantine-plan-03.json');requireRule(prepared.inputHash===inputHash&&prepared.sourceHash===EXPECTED.sourceHash&&prepared.planHash===EXPECTED.planHash&&prepared.guardDefinitionsHash===hash(guardTables.map(t=>guardSql(t,prepared.sealHash)))&&prepared.readerDefinitionsHash===hash(['check','list'].map(k=>readerSql(k,prepared.sealHash))),'QUARANTINE_FROZEN_PREPARED_PLAN_CHANGED');
    privateSave('quarantine-before-'+Date.now()+'.json',{before,metaBefore,scopeHash:inputHash});
    const existing=(await pool.request().query("SELECT OBJECT_ID(N'erp_migration.operation_quarantine_manifest') id")).recordset[0].id;
    if(existing){
      const m=(await pool.request().query('SELECT * FROM erp_migration.operation_quarantine_manifest')).recordset;requireRule(m.length===1&&m[0].input_hash===inputHash&&m[0].source_hash===EXPECTED.sourceHash&&m[0].plan_hash===EXPECTED.planHash,'QUARANTINE_DIFFERENT_SEAL_REJECTED');
      const installedObjects=await validateInstalledObjects(()=>pool.request(),prepared.sealHash);
      await pool.request().input('entities_json',sql.NVarChar(sql.MAX),'[]').execute('dbo.usp_check_operation_quarantine');
      const after=await fingerprints(()=>pool.request(),tables),metaAfter=await preservedMetadata(()=>pool.request());requireRule(hash(before)===hash(after)&&hash(metaBefore)===hash(metaAfter),'QUARANTINE_REPLAY_PROTECTED_DRIFT');
      const receipt={status:'PASS_IDENTICAL_NOOP',writes:0,nativeWrites:0,sourceRows:176,nativeHolds:172,notPresent:4,protectedTables:37,protectedDifferences:0,oldGuards:22,oldGuardDifferences:0,installedObjects,before,after,metaBefore,metaAfter};privateSave('quarantine-replay-'+Date.now()+'.json',receipt);return receipt;
    }
    tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new sql.Request(tx),q=async s=>(await request().query(s)).recordset;
    await q(`SET XACT_ABORT ON;${targetGuard} DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'${purpose}',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @lock<0 THROW 51076,'MIGRATION_QUARANTINE_NOT_READY',1;`);
    requireRule(hash(resolveHolds(snapshot,plan,await nativeProjection(request)))===inputHash,'QUARANTINE_IDENTITY_CHANGED_BEFORE_INSTALL');
    await q(`CREATE TABLE erp_migration.operation_quarantine_manifest(run_id nvarchar(80) PRIMARY KEY,source_hash char(64) NOT NULL,plan_hash char(64) NOT NULL,input_hash char(64) NOT NULL,seal_hash char(64) NOT NULL,source_as_of varchar(10) NOT NULL,source_rows int NOT NULL,native_holds int NOT NULL,not_present int NOT NULL,sealed bit NOT NULL CHECK(sealed=1));
CREATE TABLE erp_migration.operation_quarantine_holds(entity nvarchar(20) NOT NULL,source_key nvarchar(250) NOT NULL PRIMARY KEY,source_id varchar(20) NOT NULL,source_company nvarchar(10) NOT NULL,source_code nvarchar(250) NOT NULL,source_name nvarchar(500) NULL,native_id bigint NULL,native_entity_id bigint NULL,native_source_key nvarchar(250) NOT NULL,native_code nvarchar(250) NULL,native_name nvarchar(500) NULL,status nvarchar(20) NOT NULL,reasons_json nvarchar(max) NOT NULL,binding_basis nvarchar(80) NOT NULL,row_hash char(64) NOT NULL);
CREATE UNIQUE INDEX UX_operation_hold_native ON erp_migration.operation_quarantine_holds(entity,native_id) WHERE native_id IS NOT NULL;CREATE INDEX IX_operation_hold_source ON erp_migration.operation_quarantine_holds(source_company,source_id);CREATE INDEX IX_operation_hold_entity ON erp_migration.operation_quarantine_holds(native_entity_id);`);
    await request().input('rows',sql.NVarChar(sql.MAX),JSON.stringify(holds)).query(`INSERT erp_migration.operation_quarantine_holds SELECT ${holdFields.map(f=>'x.'+f).join(',')},REPLICATE('0',64) FROM OPENJSON(@rows) WITH(${holdOpenJson})x;UPDATE h SET row_hash=${rowHash('h')} FROM erp_migration.operation_quarantine_holds h;`);
    const sealed=(await q('SELECT source_key,row_hash FROM erp_migration.operation_quarantine_holds ORDER BY source_key'));requireRule(sealed.length===176,'QUARANTINE_SOURCE_ROWS_MISSING');const sealHash=(await q(`SELECT ${aggregateSeal('erp_migration.operation_quarantine_holds')} seal_hash`))[0].seal_hash;requireRule(sealHash===prepared.sealHash,'QUARANTINE_PREPARED_SEAL_CHANGED');
    await request().input('i',sql.Char(64),inputHash).input('s',sql.Char(64),sealHash).query(`INSERT erp_migration.operation_quarantine_manifest VALUES(N'${RUN}','${EXPECTED.sourceHash}','${EXPECTED.planHash}',@i,@s,'2026-09-30',176,172,4,1)`);
    for(const table of ['operation_quarantine_manifest','operation_quarantine_holds'])await q(immutableSql(table));
    for(const table of guardTables){
      const prior=(await q(`SELECT COUNT(*) n FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.${table}') AND (OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 OR OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 OR OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)`))[0];requireRule(prior.n===0,'QUARANTINE_EXISTING_FIRST_TRIGGER_PRESERVED');
      await q(guardSql(table,sealHash));for(const event of ['INSERT','UPDATE','DELETE'])await q(`EXEC sys.sp_settriggerorder @triggername=N'dbo.operation_quarantine_${table}',@order=N'First',@stmttype=N'${event}'`);
    }
    await q(readerSql('check',sealHash));await q(readerSql('list',sealHash));
    await q('GRANT EXECUTE ON OBJECT::dbo.usp_check_operation_quarantine TO [melisa_sirket_sales_test_20260929_01];GRANT EXECUTE ON OBJECT::dbo.usp_list_operation_quarantine TO [melisa_sirket_sales_test_20260929_01];');
    const installedObjects=await validateInstalledObjects(request,sealHash);
    const after=await fingerprints(request,tables),metaAfter=await preservedMetadata(request);requireRule(hash(before)===hash(after)&&hash(metaBefore)===hash(metaAfter),'QUARANTINE_PROTECTED_NATIVE_OR_METADATA_DRIFT');await tx.commit();tx=null;
    const receipt={status:'PASS_INSTALLED',sourceRows:176,productSources:54,partySources:122,nativeHolds:172,nativeProducts:54,nativeCustomers:28,nativeSuppliers:90,notPresent:4,nativeWrites:0,liveWrites:0,vegaWrites:0,protectedTables:37,protectedDifferences:0,oldGuards:22,oldGuardDifferences:0,existingPriceMetadataDifferences:0,sealHash,inputHash,newBusinessGuards:guardTables.length,installedObjects,before,after,metaBefore,metaAfter};privateSave('quarantine-install.json',receipt);return receipt;
  }catch(e){if(tx)await tx.rollback().catch(()=>{});throw e;}finally{await pool.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)Promise.resolve().then(()=>{requireRule(process.argv.length===3&&['--prepare','--install-test'].includes(process.argv[2]),'QUARANTINE_EXPLICIT_MODE_REQUIRED');return process.argv[2]==='--prepare'?prepareQuarantine():installQuarantine();}).then(r=>console.log(JSON.stringify({...r,before:undefined,after:undefined,metaBefore:undefined,metaAfter:undefined,installedObjects:undefined}))).catch(e=>{console.error(JSON.stringify({code:/^[A-Z0-9_]+$/.test(e.message??'')?e.message:'QUARANTINE_INSTALL_FAILED',number:e.number??null}));process.exitCode=1;});
