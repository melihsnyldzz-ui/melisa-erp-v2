// Offline compiler. Only the DB02 owner may rehearse/apply the resulting DDL.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {BUSINESS_DAILY_PROFIT_MODULES,businessDailyProfitReadSQL,validateBusinessDailyProfitRevision} from '../../apps/api/src/services/businessDailyProfitRevision.mjs';
export const PROFIT_REGISTRY='dbo.stage4_copy_business_daily_profit_revisions';
export const PROFIT_TRIGGER='dbo.immutable_stage4_copy_business_daily_profit_revisions';
export const PROFIT_GUARD='dbo.usp_business_daily_guard';
export const PROFIT_READY='dbo.usp_stage4_copy_ready';
const oldRegistry='dbo.stage4_copy_business_daily_revisions';
const check=(x,c)=>{if(!x)throw Error(c);};
const hex=x=>typeof x==='string'&&/^[A-F0-9]{64}$/.test(x);
const one=(s,a,b)=>{check(s.split(a).length===2,'DAILY_PROFIT_SOURCE_ANCHOR');return s.replace(a,b);};
const alter=s=>s.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ');
const create=s=>s.replace(/^ALTER PROCEDURE /,'CREATE PROCEDURE ');
export function profitSnapshotGuardSQL(){return `
IF @table_name=N'sales_invoice_items' AND @operation=N'sale_finalize' BEGIN
 IF (SELECT COUNT(*) FROM OPENJSON(@inserted)) NOT BETWEEN 1 AND 2 OR (SELECT COUNT(*) FROM OPENJSON(@inserted))<>(SELECT COUNT(*) FROM OPENJSON(@deleted)) THROW 51904,'BUSINESS_DAILY_PROFIT_UPDATE_ONLY',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i LEFT JOIN OPENJSON(@deleted)d ON JSON_VALUE(i.value,'$.id')=JSON_VALUE(d.value,'$.id') WHERE d.value IS NULL OR EXISTS(SELECT 1 FROM OPENJSON(i.value)x FULL JOIN OPENJSON(d.value)y ON x.[key]=y.[key] WHERE COALESCE(x.[key],y.[key]) NOT IN(N'average_cost_try_snapshot',N'gross_profit_try',N'gross_profit_rate',N'row_version') AND(x.[key] IS NULL OR y.[key] IS NULL OR x.type<>y.type OR ISNULL(x.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(y.value,N'') COLLATE Latin1_General_100_BIN2))) THROW 51904,'BUSINESS_DAILY_PROFIT_IMMUTABLE_LINE',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE NOT EXISTS(
  SELECT 1 FROM dbo.sales_invoices v JOIN dbo.work_sales_links l ON l.invoice_id=v.id JOIN dbo.stage4_copy_requests j ON j.copy_id=@copy_id AND j.operation=N'sale_draft' AND j.request_id=l.request_id AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.invoice.id'))=v.id
  JOIN OPENJSON(@daily,'$.customers')WITH(id bigint,accountId bigint,currency nvarchar(3))c ON c.id=v.customer_id AND c.currency=v.document_currency
  JOIN OPENJSON(@daily,'$.products')WITH(id bigint,salePriceExact8 decimal(28,8),costExact4 decimal(18,4))p ON p.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.product_id'))
  JOIN dbo.products nativeProduct ON nativeProduct.id=p.id AND nativeProduct.average_cost_try=p.costExact4
  CROSS APPLY(SELECT TRY_CONVERT(decimal(18,3),JSON_VALUE(i.value,'$.quantity')) qty,TRY_CONVERT(decimal(18,4),JSON_VALUE(i.value,'$.line_total')) amount)q
  CROSS APPLY(SELECT CONVERT(decimal(18,4),ROUND(q.amount-p.costExact4*q.qty,4)) profit)g
  WHERE v.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.sales_invoice_id')) AND v.id=TRY_CONVERT(bigint,JSON_VALUE(@payload,'$.id')) AND v.id>TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.sales_invoices')) AND v.status=N'draft' AND v.document_currency=N'TRY' AND v.exchange_rate_snapshot=1 AND v.created_by=j.actor_id AND l.actor_id=j.actor_id AND JSON_VALUE(j.payload_json,'$.businessDailyScopeHash')=@dailyHash AND JSON_VALUE(l.preview_json,'$.copyId')=LOWER(CONVERT(nvarchar(36),@copy_id)) AND JSON_VALUE(l.preview_json,'$.sealHash')=JSON_VALUE(@p,'$.sealHash')
  AND JSON_VALUE(i.value,'$.currency_code')=N'TRY' AND q.qty BETWEEN 1 AND 5 AND q.qty=FLOOR(q.qty) AND TRY_CONVERT(decimal(28,8),JSON_VALUE(i.value,'$.unit_price'))=p.salePriceExact8 AND q.amount=ROUND(q.qty*p.salePriceExact8,4) AND TRY_CONVERT(decimal(18,4),JSON_VALUE(i.value,'$.average_cost_try_snapshot'))=p.costExact4 AND TRY_CONVERT(decimal(18,4),JSON_VALUE(i.value,'$.gross_profit_try'))=g.profit AND TRY_CONVERT(decimal(18,6),JSON_VALUE(i.value,'$.gross_profit_rate'))=CONVERT(decimal(18,6),CASE WHEN q.amount>0 THEN g.profit/q.amount ELSE 0 END)
 )) THROW 51904,'BUSINESS_DAILY_PROFIT_OWNED_EXACT_LINE',1;
END;
IF @table_name=N'audit_logs' AND @operation=N'sale_finalize' AND EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.action')=N'sales_profit_snapshot_created' AND (ISNULL(JSON_VALUE(i.value,'$.entity_id'),'')<>JSON_VALUE(@payload,'$.id') OR ISNULL(JSON_VALUE(JSON_VALUE(i.value,'$.after_json'),'$.invoiceId'),'')<>JSON_VALUE(@payload,'$.id') OR ISNULL(ISJSON(JSON_VALUE(i.value,'$.after_json')),0)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.work_sales_links l JOIN dbo.stage4_copy_requests j ON j.copy_id=@copy_id AND j.operation=N'sale_draft' AND j.request_id=l.request_id WHERE l.invoice_id=TRY_CONVERT(bigint,JSON_VALUE(@payload,'$.id')) AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.invoice.id'))=l.invoice_id AND JSON_VALUE(j.payload_json,'$.businessDailyScopeHash')=@dailyHash))) THROW 51904,'BUSINESS_DAILY_PROFIT_AUDIT_OWNERSHIP',1;
`;} 
export function extendDailyProfitGuard(before){
 let s=one(before,"(N'sale_finalize',N'sales_invoices')","(N'sale_finalize',N'sales_invoices'),(N'sale_finalize',N'sales_invoice_items')");
 check(s.includes("(N'sale_finalize',N'sales_profit_snapshot_created',N'sales_invoice')"),'DAILY_PROFIT_EXISTING_AUDIT_ACTION');
 const anchor="IF @table_name=N'finance_accounts' AND EXISTS";
 s=one(s,anchor,profitSnapshotGuardSQL()+anchor);
 return alter(s);
}
export function buildDailyProfitRevision(daily){
 check(daily?.schemaVersion==='melisa-business-copy-daily-install.v1'&&daily.revision?.version===4&&daily.replacements?.length===8&&daily.revision.modules?.length===8&&daily.target.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'&&daily.businessWrites===0,'DAILY_PROFIT_BASE');
 const d=daily.revision;
 const old=name=>{const m=daily.replacements.find(x=>x.name===name);check(m&&hex(m.afterHash)&&moduleHash(create(m.definition))===m.afterHash,'DAILY_PROFIT_BASE_PIN');return m;};
 const names=[...BUSINESS_DAILY_PROFIT_MODULES],before=names.map(old);
 const tableSQL=`CREATE TABLE ${PROFIT_REGISTRY}(copy_id uniqueidentifier NOT NULL REFERENCES dbo.stage4_copy_manifest(copy_id),name sysname NOT NULL CHECK(name IN(${names.map(n=>`N'${n}'`).join(',')})),revision int NOT NULL CHECK(revision=5),base_seal_hash char(64) NOT NULL,base_daily_revision_hash char(64) NOT NULL,daily_scope_hash char(64) NOT NULL,before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,revision_hash char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(copy_id,name));`;
 const beforePins=before.map(m=>`(N'${m.name}',N'${m.afterHash}')`).join(',');
 const immutableSQL=`CREATE TRIGGER ${PROFIT_TRIGGER} ON ${PROFIT_REGISTRY} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${daily.target.database}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'${daily.target.server}' OR IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1 OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>3 OR(SELECT COUNT(*) FROM ${PROFIT_REGISTRY})<>3 OR(SELECT COUNT(*) FROM ${oldRegistry})<>8 OR(SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest)<>185 THROW 51904,'BUSINESS_DAILY_PROFIT_IMMUTABLE',1;
IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN(VALUES ${beforePins})p(name,before_hash) ON p.name=i.name WHERE p.name IS NULL OR i.before_hash<>p.before_hash OR i.copy_id<>N'${d.copyId}' OR i.revision<>5 OR i.base_seal_hash<>N'${d.baseSealHash}' OR i.base_daily_revision_hash<>N'${d.revisionHash}' OR i.daily_scope_hash<>N'${d.dailyScopeHash}' OR i.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(i.name))),2) OR i.revision_hash LIKE '%[^A-F0-9]%') OR(SELECT COUNT(DISTINCT revision_hash) FROM inserted)<>1 THROW 51904,'BUSINESS_DAILY_PROFIT_IMMUTABLE_PIN',1;END;`;
 const triggerHash=moduleHash(immutableSQL);
 const effective=`COALESCE((SELECT v.after_hash FROM ${PROFIT_REGISTRY} v WHERE v.copy_id=@copy_id AND v.revision=5 AND v.name=d.name AND v.before_hash=d.after_hash),d.after_hash)`;
 let ready=one(before[1].definition,'d.after_hash<>CONVERT(varchar(64),HASHBYTES(\'SHA2_256\',OBJECT_DEFINITION(OBJECT_ID(d.name))),2)',`${effective}<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(d.name))),2)`);
 const prefix=`IF(SELECT COUNT(*) FROM ${PROFIT_REGISTRY})<>3 OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${PROFIT_TRIGGER}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${PROFIT_TRIGGER}'))),2),'')<>N'${triggerHash}' OR EXISTS(SELECT 1 FROM ${PROFIT_REGISTRY} v LEFT JOIN ${oldRegistry} d ON d.copy_id=v.copy_id AND d.name=v.name AND d.revision=4 AND d.after_hash=v.before_hash WHERE d.name IS NULL OR v.copy_id<>@copy_id OR v.revision<>5 OR v.base_seal_hash<>JSON_VALUE(@p,'$.sealHash') OR v.base_daily_revision_hash<>N'${d.revisionHash}' OR v.daily_scope_hash<>N'${d.dailyScopeHash}' OR v.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(v.name))),2)) OR(SELECT COUNT(DISTINCT revision_hash) FROM ${PROFIT_REGISTRY})<>1 THROW 51904,'BUSINESS_DAILY_PROFIT_REVISION_DRIFT',1;\n`;
 ready=one(ready,`IF(SELECT COUNT(*) FROM ${oldRegistry})<>8`,prefix+`IF(SELECT COUNT(*) FROM ${oldRegistry})<>8`);
 ready=one(ready,'COALESCE(d.after_hash,COALESCE(w.after_hash,v.after_hash,r.after_hash,p.after_hash))',`COALESCE((SELECT z.after_hash FROM ${PROFIT_REGISTRY} z WHERE z.copy_id=@copy_id AND z.revision=5 AND z.name=d.name AND z.before_hash=d.after_hash),d.after_hash,COALESCE(w.after_hash,v.after_hash,r.after_hash,p.after_hash))`);
 // The historical ready self pin appears separately in predecessor checks.
 const self=`COALESCE((SELECT z.after_hash FROM ${oldRegistry} z WHERE z.copy_id=w.copy_id AND z.revision=4 AND z.name=w.name AND z.before_hash=w.after_hash),w.after_hash)`;
 check(ready.includes(self),'DAILY_PROFIT_READY_SELF_PIN');
 ready=ready.replaceAll(self,`COALESCE((SELECT v.after_hash FROM ${PROFIT_REGISTRY} v JOIN ${oldRegistry} z ON z.copy_id=v.copy_id AND z.name=v.name AND z.after_hash=v.before_hash WHERE z.copy_id=w.copy_id AND z.revision=4 AND z.name=w.name AND z.before_hash=w.after_hash),${self})`);
 let context=before[2].definition;
 for(const name of [PROFIT_READY]){const pin=`(SELECT after_hash FROM ${oldRegistry} WHERE copy_id=@copy_id AND name=N'${name}' AND revision=4)`;context=one(context,pin,`COALESCE((SELECT v.after_hash FROM ${PROFIT_REGISTRY} v JOIN ${oldRegistry} d ON d.copy_id=v.copy_id AND d.name=v.name AND d.after_hash=v.before_hash WHERE v.copy_id=@copy_id AND v.name=N'${name}' AND v.revision=5),${pin})`);}
 // Both context routes execute the new fully verified ready procedure; proofs
 // expose current definitions and explicitly bind the adjunct revision.
 context=one(context,'EXEC dbo.usp_stage4_copy_ready @copy_id;','EXEC dbo.usp_stage4_copy_ready @copy_id;\n-- Verified revision 5 supplies exact ready/context effective pins.');
 
 const replacements=[extendDailyProfitGuard(before[0].definition),alter(ready),alter(context)].map((definition,i)=>({name:names[i],beforeHash:before[i].afterHash,afterHash:moduleHash(create(definition)),definition}));
 const body={schemaVersion:'melisa-business-daily-profit-revision.v1',version:5,copyId:d.copyId,baseSealHash:d.baseSealHash,baseDailyRevisionHash:d.revisionHash,dailyScopeHash:d.dailyScopeHash,modules:replacements.map(({definition,...m})=>m),immutableTriggerHash:triggerHash};
 const revision={...body,revisionHash:isolatedCopyHash(body)};
 return {schemaVersion:'melisa-business-daily-profit-install.v1',target:daily.target,copyId:d.copyId,baseSealHash:d.baseSealHash,baseDailyRevision:d,baseDefinitions:daily.replacements,revision,replacements,tableSQL,immutableSQL,businessWrites:0,openingHumanAccepted:false,realFinancialOpeningAuthorized:false,nativeChecksUnchanged:true,rolesChanged:false};
}
export const dailyProfitReadSQL=businessDailyProfitReadSQL;
export const validateDailyProfitProof=validateBusinessDailyProfitRevision;
export function validateDailyProfitInstall(a){const base={schemaVersion:'melisa-business-copy-daily-install.v1',target:a.target,revision:a.baseDailyRevision,replacements:a.baseDefinitions,businessWrites:0};check(isolatedCopyHash(buildDailyProfitRevision(base))===isolatedCopyHash(a),'DAILY_PROFIT_CANONICAL_INSTALL');return true;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [action,input,output]=process.argv.slice(2);check(['build','verify'].includes(action)&&input,'DAILY_PROFIT_CLI');const data=JSON.parse(fs.readFileSync(input,'utf8'));if(action==='verify'){validateDailyProfitInstall(data);process.stdout.write('DAILY_PROFIT_CANONICAL_PASS');}else{check(output,'DAILY_PROFIT_CLI');const bundle=buildDailyProfitRevision(data);fs.writeFileSync(output,JSON.stringify(bundle));process.stdout.write(JSON.stringify({output,revisionHash:bundle.revision.revisionHash,moduleCount:bundle.replacements.length}));}}
