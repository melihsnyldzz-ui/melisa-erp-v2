// Narrow, explicitly approved TEST batch. Importing performs no filesystem/SQL I/O.
import {createHash} from 'node:crypto';
import {hash} from './party-currency-readonly-plan.mjs';
export const TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'});
export const APPROVAL=Object.freeze({commentId:6038754582,parentPlanHash:'87d1afc526da80464e47249f69be5dc69ed78000645d13fdb94a1041828f19d0',sourceVersionHash:'8d0d72b5dd591e3a73f0c38dd504f556a675e9b89bc71cf9bdcea4ba1f6434eb'});
export const check=(yes,code)=>{if(!yes)throw Error(code);};
export const sqlHash=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
export function units(v){check(typeof v==='string'&&/^-?\d{1,20}\.\d{8}$/.test(v),'GOAL73_DECIMAL');return BigInt(v.replace('.',''));}
export const exact=n=>`${n<0n?'-':''}${(n<0n?-n:n)/100000000n}.${String((n<0n?-n:n)%100000000n).padStart(8,'0')}`;
export const inverseAfter=(current,delta)=>exact(units(current)-units(delta));
export function validate(parent,manifest){
 const {planHash,...p}=parent;check(hash(p)===planHash&&planHash===APPROVAL.parentPlanHash&&parent.sourceVersionHash===APPROVAL.sourceVersionHash&&parent.financialWriteAuthorized===false,'GOAL73_PARENT');
 const {manifestHash,...m}=manifest;check(hash(m)===manifestHash,'GOAL73_MANIFEST_HASH');
 check(manifest.schemaVersion==='melisa-goal73.supplier-delta.v1'&&manifest.commentId===APPROVAL.commentId&&manifest.parentPlanHash===planHash&&manifest.server===TARGET.server&&manifest.database===TARGET.database,'GOAL73_SCOPE');
 check(/^GOAL73-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(manifest.runId)&&manifest.actorId==='13','GOAL73_ACTOR_RUN');
 const ready=parent.accounts.filter(a=>a.status==='KANITI TAMAM');check(ready.length===16&&manifest.accounts?.length===16&&new Set(manifest.accounts.map(a=>a.nativeAccountId)).size===16,'GOAL73_FIXED_16');
 check(manifest.backup?.copyOnly===true&&manifest.backup.checksum===true&&manifest.backup.verifyOnlyPassed===true&&/^[a-f0-9]{64}$/i.test(manifest.backup.sha256)&&manifest.backup.server===TARGET.server&&manifest.backup.database===TARGET.database,'GOAL73_BACKUP');
 for(const a of manifest.accounts)validateAccount(ready.find(p=>p.key===a.key),a);
 check(manifest.accounts.filter(a=>units(a.delta)!==0n).length===15,'GOAL73_15_EFFECTS');return manifest;
}
export function validateAccount(approved,a){
  check(approved&&a.role==='supplier'&&a.sourceId===approved.sourceId&&a.targetId===approved.targetId&&a.nativeAccountId===approved.nativeAccountId&&a.currency===approved.currency&&a.sourceCode===approved.sourceCode,'GOAL73_ACCOUNT_SCOPE');
  check(a.delta===approved.proposal.nativeDelta&&a.beforeBalance===approved.nativeCurrent&&a.afterBalance===approved.proposal.expectedAfter&&units(a.afterBalance)===units(a.beforeBalance)+units(a.delta),'GOAL73_FIXED_DELTA');
  check(a.localEffects===approved.localEffects&&a.sourceFinancialHash&&a.sourceHeadersHash&&a.sourceUnchanged===true&&a.held===false,'GOAL73_SOURCE_HOLD');
  for(const table of ['account','supplier'])check(typeof a[table+'JSON']==='string'&&sqlHash(a[table+'JSON'])===a[table+'Hash'],'GOAL73_BEFORE_IMAGE');
  check(JSON.parse(a.accountJSON).id==a.nativeAccountId&&JSON.parse(a.accountJSON).supplier_id==a.targetId&&JSON.parse(a.accountJSON).currency_code===a.currency,'GOAL73_BEFORE_IDENTITY');
 return a;
}
export function replayDecision(existing,manifest){if(!existing)return 'APPLY';check(existing.manifest_hash===manifest.manifestHash&&existing.parent_plan_hash===manifest.parentPlanHash&&existing.status==='COMMITTED','GOAL73_UUID_BODY_CONFLICT');return 'REPLAY_NOOP';}
export const DDL=`CREATE TABLE dbo.goal73_supplier_currency_runs(run_id nvarchar(80) PRIMARY KEY,manifest_hash char(64) NOT NULL,parent_plan_hash char(64) NOT NULL,status nvarchar(20) NOT NULL CHECK(status=N'COMMITTED'),actor_id bigint NOT NULL,receipt_json nvarchar(max) NOT NULL);
CREATE TABLE dbo.goal73_supplier_currency_effects(run_id nvarchar(80) NOT NULL,parent_plan_hash char(64) NOT NULL,account_id bigint NOT NULL,supplier_id bigint NOT NULL,currency nvarchar(3) NOT NULL,delta decimal(28,8) NOT NULL,before_json nvarchar(max) NOT NULL,after_json nvarchar(max) NOT NULL,movement_id bigint NULL,audit_id bigint NULL,PRIMARY KEY(run_id,account_id),UNIQUE(parent_plan_hash,account_id),CHECK((delta=0 AND movement_id IS NULL AND audit_id IS NULL) OR(delta<>0 AND movement_id IS NOT NULL AND audit_id IS NOT NULL)));`;
export const JOURNAL_TABLES=['goal73_supplier_currency_runs','goal73_supplier_currency_effects'];
export const immutable=t=>`CREATE TRIGGER dbo.immutable_${t} ON dbo.${t} AFTER INSERT,UPDATE,DELETE AS BEGIN IF EXISTS(SELECT 1 FROM deleted) OR IS_SRVROLEMEMBER(N'sysadmin')<>1 OR OBJECT_ID(N'tempdb..#goal73_plan') IS NULL OR SESSION_CONTEXT(N'goal73_run') IS NULL OR EXISTS(SELECT 1 FROM inserted WHERE run_id<>CONVERT(nvarchar(80),SESSION_CONTEXT(N'goal73_run'))) THROW 51373,'GOAL73_JOURNAL_IMMUTABLE',1; END;`;
