import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {env} from '../config/env.js';
import {cardHash,planCards,prepareCards} from './vegaCardPlan.mjs';
const execFileAsync=promisify(execFile);
const pending=new Map();
const completedNoops=new Map();
const reject=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
export async function readVegaCards(configPath){
 try{
  const {stdout}=await execFileAsync(process.execPath,[fileURLToPath(new URL('../../scripts/read-vega-cards.mjs',import.meta.url)),configPath],{timeout:90000,maxBuffer:40*1024*1024,windowsHide:true});
  return JSON.parse(stdout);
 }catch{reject('CARD_SOURCE_UNAVAILABLE','Vega kartları okunamadı. Hiçbir kart güncellenmedi.',503);}
}
export async function readCardTarget(request){
 const result=await request.query("SELECT id,stock_code,name,brand,category,unit,currency_code,sales_price,is_active,is_deleted FROM dbo.products ORDER BY id;SELECT id,product_id,barcode,is_active,is_primary FROM dbo.product_barcodes ORDER BY id;SELECT id,entity_id,after_json FROM dbo.audit_logs WHERE entity_type=N'product' AND action IN(N'pilot_product_opening_imported',N'full_stock_product_imported',N'vega_card_imported') ORDER BY id;");
 return {products:result.recordsets[0],barcodes:result.recordsets[1],mappings:result.recordsets[2]};
}
export function assertCardSyncPermission(actor){
 if(!actor?.permissions?.includes('product.edit'))reject('AUTH_PERMISSION_DENIED','Ürün düzenleme yetkisi gerekli.',403);
 if(env.sql.database!=='MELISA_ERP_V2'||env.sql.readOnly||process.env.MELISA_PILOT_RUNTIME!=='true')reject('CARD_TARGET_DISABLED','Kart güncellemesi yalnız test ERP’sinde açıktır.',403);
}
export async function previewVegaCards(configPath,actor){
 assertCardSyncPermission(actor);
 for(const [id,p] of pending)if(p.expiresAt<Date.now())pending.delete(id);
 if(pending.size>=5)pending.delete(pending.keys().next().value);
 const source=await readVegaCards(configPath),pool=await getSqlPool(),target=await readCardTarget(pool.request());
 const plan=planCards(source,target),previewId=randomUUID(),expiresAt=Date.now()+10*60*1000;
 pending.set(previewId,{actorId:Number(actor.id),expiresAt,plan});
 return {previewId,expiresAt:new Date(expiresAt).toISOString(),sourceAt:source.at,counts:plan.counts,issues:plan.issues,warnings:plan.warnings,
 changes:plan.updates.filter(u=>u.changed).map(u=>({stockCode:u.stockCode,name:u.name,kind:u.id?'Güncelle':'Yeni',fields:u.fields.length?u.fields:['Kaynak birim/satış uygunluğu'],before:u.before,after:Object.fromEntries(['stockCode','name','brand','category','unit','currency','price','barcodes'].map(k=>[k,u.after[k]]))}))};
}
async function completed(request,previewId,actor){
 const noop=completedNoops.get(previewId);
 if(noop?.actorId===Number(actor.id))return noop.result;
 const sql=getSqlDriver();
 const row=(await request.input('run',sql.NVarChar(120),previewId).input('actor',sql.BigInt,actor.id).query("SELECT TOP(1) after_json FROM dbo.audit_logs WHERE action=N'vega_card_sync_completed' AND actor_user_id=@actor AND JSON_VALUE(after_json,'$.previewId')=@run ORDER BY id DESC")).recordset[0];
 return row?JSON.parse(row.after_json):null;
}
export async function vegaCardStatus(previewId,actor){
 assertCardSyncPermission(actor);const pool=await getSqlPool();
 const result=await completed(pool.request(),previewId,actor);
 return result||{state:'NOT_COMPLETED',previewId};
}
export async function applyVegaCards(configPath,previewId,actor,mayApply=()=>true){
 assertCardSyncPermission(actor);
 if(typeof previewId!=='string'||!/^[a-f0-9-]{36}$/.test(previewId))reject('CARD_PREVIEW_REQUIRED','Önce değişiklikleri önizleyin.');
 const pool=await getSqlPool(),previous=await completed(pool.request(),previewId,actor);if(previous)return previous;
 const saved=pending.get(previewId);
 if(!saved||saved.actorId!==Number(actor.id)||saved.expiresAt<Date.now())reject('CARD_PREVIEW_EXPIRED','Önizleme süresi doldu. Vega kartlarını yeniden okuyun.');
 if(saved.plan.issues.length)reject('CARD_CONFLICT','Çakışmalar çözülmeden güncelleme yapılamaz.');
 const source=await readVegaCards(configPath),sql=getSqlDriver(),tx=new sql.Transaction(pool);
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const request=()=>{const r=new sql.Request(tx);r.timeout=120000;return r;};
  const lock=await request().query("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'melisa-vega-card-sync',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000; SELECT @r AS lockResult,DB_NAME() AS db,@@SERVERNAME AS server;");
  const identity=lock.recordset[0];
  if(identity.lockResult<0||identity.db!=='MELISA_ERP_V2'||String(identity.server).toUpperCase()!=='SEMIH\\MELISADEV')reject('CARD_TARGET_MISMATCH','Test veritabanı doğrulanamadı.');
  const already=await completed(request(),previewId,actor);if(already){await tx.rollback();return already;}
  const target=await readCardTarget(request()),plan=planCards(source,target);
  if(plan.issues.length||plan.sourceHash!==saved.plan.sourceHash||plan.targetHash!==saved.plan.targetHash)reject('CARD_PREVIEW_CHANGED','Kart bilgileri önizlemeden sonra değişti. Yeniden önizleyin.');
  const changes=plan.updates.filter(u=>u.changed).map(u=>({...u.after,id:u.id,before:u.before,cardHash:cardHash(u.after?Object.fromEntries(Object.entries(u.after).filter(([k])=>!['isActive','isDeleted'].includes(k))):null)}));
  const result={state:'COMPLETED',previewId,at:new Date().toISOString(),sourceAt:source.at,counts:plan.counts,inventoryChanged:false};
  if(!mayApply())reject('CARD_AUTO_STOPPED','Otomatik güncelleme kapatıldı.');
  if(!changes.length){
   await tx.rollback();pending.delete(previewId);
   if(completedNoops.size>=100)completedNoops.delete(completedNoops.keys().next().value);
   completedNoops.set(previewId,{actorId:Number(actor.id),result});return result;
  }
  await request().input('cards',sql.NVarChar(sql.MAX),JSON.stringify(changes)).input('actorId',sql.BigInt,actor.id).input('preview',sql.NVarChar(120),previewId).input('sourceAt',sql.NVarChar(40),source.at).input('result',sql.NVarChar(sql.MAX),JSON.stringify(result)).query(`
   SELECT id,current_stock_qty INTO #ProtectedQuantity FROM dbo.products WITH(UPDLOCK,HOLDLOCK);
   CREATE TABLE #Cards(id bigint NULL,sourceId int,stockCode nvarchar(50) COLLATE DATABASE_DEFAULT,name nvarchar(250),brand nvarchar(120),category nvarchar(120),unit nvarchar(20),currency nvarchar(3),price decimal(18,4),barcodes nvarchar(max),beforeJson nvarchar(max),sourceRow nvarchar(max));
   INSERT #Cards SELECT c.id,c.sourceId,c.stockCode,c.name,c.brand,c.category,c.unit,c.currency,c.price,c.barcodes,c.beforeJson,r.value FROM OPENJSON(@cards) r CROSS APPLY OPENJSON(r.value) WITH(id bigint,sourceId int,stockCode nvarchar(50),name nvarchar(250),brand nvarchar(120),category nvarchar(120),unit nvarchar(20),currency nvarchar(3),price decimal(18,4),barcodes nvarchar(max) AS JSON,beforeJson nvarchar(max) '$.before' AS JSON) c;
   INSERT dbo.products(stock_code,name,brand,category,unit,currency_code,sales_price,current_stock_qty,is_active,is_deleted,created_by)
   SELECT stockCode,name,brand,category,unit,currency,price,0,1,0,@actorId FROM #Cards WHERE id IS NULL;
   UPDATE s SET id=p.id FROM #Cards s JOIN dbo.products p ON p.stock_code=s.stockCode WHERE s.id IS NULL;
   UPDATE p SET stock_code=s.stockCode,name=s.name,brand=s.brand,category=s.category,unit=s.unit,currency_code=s.currency,sales_price=s.price,is_active=1,is_deleted=0,passive_at=NULL,passive_reason=NULL,updated_by=@actorId,updated_at=SYSUTCDATETIME()
   FROM dbo.products p JOIN #Cards s ON s.id=p.id;
   UPDATE b SET is_active=0,is_primary=0,updated_by=@actorId,updated_at=SYSUTCDATETIME() FROM dbo.product_barcodes b JOIN #Cards s ON s.id=b.product_id WHERE b.is_active=1;
   SELECT s.id AS productId,CONVERT(nvarchar(80),b.value) COLLATE DATABASE_DEFAULT AS barcode,CASE WHEN b.[key]='0' THEN 1 ELSE 0 END AS isPrimary INTO #Barcodes FROM #Cards s CROSS APPLY OPENJSON(s.barcodes) b;
   UPDATE old SET is_active=1,is_primary=b.isPrimary,barcode_type=CASE WHEN b.isPrimary=1 THEN N'primary' ELSE N'extra' END,updated_by=@actorId,updated_at=SYSUTCDATETIME()
   FROM dbo.product_barcodes old JOIN #Barcodes b ON old.product_id=b.productId AND old.barcode=b.barcode
   WHERE old.id=(SELECT MIN(x.id) FROM dbo.product_barcodes x WHERE x.product_id=b.productId AND x.barcode=b.barcode);
   INSERT dbo.product_barcodes(product_id,barcode,barcode_type,is_primary,is_active,created_by)
   SELECT b.productId,b.barcode,CASE WHEN b.isPrimary=1 THEN N'primary' ELSE N'extra' END,b.isPrimary,1,@actorId FROM #Barcodes b WHERE NOT EXISTS(SELECT 1 FROM dbo.product_barcodes x WHERE x.product_id=b.productId AND x.barcode=b.barcode);
   IF EXISTS(SELECT 1 FROM dbo.products p JOIN #ProtectedQuantity q ON p.id=q.id WHERE p.current_stock_qty<>q.current_stock_qty) THROW 51000,'CARD_QUANTITY_CHANGED',1;
   IF EXISTS(SELECT 1 FROM dbo.products p WHERE NOT EXISTS(SELECT 1 FROM #ProtectedQuantity q WHERE q.id=p.id) AND p.current_stock_qty<>0) THROW 51000,'CARD_NEW_QUANTITY_NONZERO',1;
   INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source,created_at)
   SELECT @actorId,N'vega_card_imported',N'product',s.id,s.beforeJson,JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(s.sourceRow,'$.source','VEGA2026/F0102'),'$.sourceAt',@sourceAt),'$.previewId',@preview),N'Owner approved all active Vega cards; quantities and commercial history preserved',N'pilot-card-sync',SYSUTCDATETIME() FROM #Cards s;
   INSERT dbo.audit_logs(actor_user_id,action,entity_type,after_json,reason,source,created_at)
   VALUES(@actorId,N'vega_card_sync_completed',N'import',@result,N'Card-only update; no Vega writes or inventory import',N'pilot-card-sync',SYSUTCDATETIME());
  `);
  await tx.commit();pending.delete(previewId);return result;
 }catch(error){await tx.rollback().catch(()=>{});if(error.statusCode)throw error;reject('CARD_APPLY_FAILED','Kart güncellemesi tamamlanamadı. Sonucu kontrol edin; gerekirse önizlemeyi yenileyin.',500);}
}

// Only a successful reconciliation advances this in-memory source baseline.
// A restart intentionally reconciles against the target again (no blind cache trust).
export async function syncVegaCardsOnce(configPath,actor,previousHash=null,mayApply=()=>true){
 assertCardSyncPermission(actor);
 const source=await readVegaCards(configPath),prepared=prepareCards(source);
 if(prepared.issues.length)reject('CARD_CONFLICT',`Vega kartlarında ${prepared.issues.length} çakışma var. Manuel önizlemeyi inceleyin.`);
 const sourceHash=cardHash(prepared.cards);
 const base={sourceHash,sourceAt:source.at,activeSource:prepared.cards.length,sourceMetrics:source.metrics};
 if(sourceHash===previousHash)return {...base,new:0,updated:0,changed:0,unchanged:prepared.cards.length};
 const pool=await getSqlPool(),target=await readCardTarget(pool.request()),plan=planCards(source,target);
 if(plan.issues.length)reject('CARD_CONFLICT',`${plan.issues.length} kart eşleme çakışması var. Manuel önizlemeyi inceleyin.`);
 if(!mayApply())reject('CARD_AUTO_STOPPED','Otomatik güncelleme kapatıldı.');
 if(!plan.updates.some(u=>u.changed))return {...base,...plan.counts};
 const previewId=randomUUID();
 pending.set(previewId,{actorId:Number(actor.id),expiresAt:Date.now()+10*60*1000,plan});
 try{
  const result=await applyVegaCards(configPath,previewId,actor,mayApply);
  return {...base,...result.counts,previewId};
 }finally{pending.delete(previewId);}
}
