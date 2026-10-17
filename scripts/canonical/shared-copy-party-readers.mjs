// Offline recipe only. The caller owns the exact copy transaction and approval.
import {createHash} from 'node:crypto';
import {assertSharedPartyContext,sharedPartyReaderDefinition} from '../../apps/api/src/services/isolatedPartyCardReader.mjs';
import {CUSTOMER_CARD_PROC_SQL} from '../../apps/api/src/services/customerCardReadStore.mjs';
import {SUPPLIER_CARD_PROC_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {CURRENT_FINANCE_PARTY_PROC_SQL,currentFinanceContext} from '../../apps/api/src/services/currentFinanceDeltaRead.mjs';
const q=s=>"N'"+s.replaceAll("'","''")+"'";
export function buildSharedPartyReaderAdjunct(context,financeContext){
 assertSharedPartyContext(context);const finance=currentFinanceContext(financeContext);if(!finance||finance.accountIds.length!==283)throw Error('SHARED_PARTY_CURRENT_FINANCE_CONTEXT');
 const customer=sharedPartyReaderDefinition(context,{role:'customer',sourceSQL:CUSTOMER_CARD_PROC_SQL});
 const supplier=sharedPartyReaderDefinition(context,{role:'supplier',sourceSQL:SUPPLIER_CARD_PROC_SQL});
 const current=sharedPartyReaderDefinition(context,{role:'currentFinance',sourceSQL:CURRENT_FINANCE_PARTY_PROC_SQL});
 const replacements=[customer,supplier,current];
 const originals=[CUSTOMER_CARD_PROC_SQL,SUPPLIER_CARD_PROC_SQL,CURRENT_FINANCE_PARTY_PROC_SQL];
 const previousHashes=['20A1E0164E756F0D7A06DD954C572F6D0FBC81A0ED18ED0DCF5F5E835E13032E','24B255AE092AE3D1766FB4320FF8FC0344D06E11EBBC7C8EB8CDAF31B539A880','579377DB939129251CDF22B811D272D02184259B50056DDC429FBAAAD4086407'];
 if(context.catalogProof.customerReaderHash!==customer.sourceHash||context.catalogProof.supplierReaderHash!==supplier.sourceHash)throw Error('SHARED_PARTY_CATALOG_ORIGINAL_DEPENDENCIES');
 const restorations=replacements.map((r,i)=>({name:r.sourceName,beforeHash:previousHashes[i],afterHash:r.sourceHash,definition:originals[i],sql:originals[i].replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ')}));
 const names=[...replacements.map(r=>r.name),...restorations.map(r=>r.name)].map(q).join(',');
 const preflightSQL=`IF DB_NAME()<>${q(context.target.database)} OR @@SERVERNAME<>${q(context.target.server)} OR @@TRANCOUNT=0 THROW 51904,'SHARED_PARTY_INSTALL_TARGET',1;
IF EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest WHERE name IN(${names})) THROW 51904,'SHARED_PARTY_IMMUTABLE_MEMBER',1;
IF (SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest)<>184 OR (SELECT COUNT(*) FROM dbo.stage4_copy_module_revisions)<>3 THROW 51904,'SHARED_PARTY_BASE_SCOPE',1;
IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_manifest WHERE copy_id=CONVERT(uniqueidentifier,${q(context.copyId)}) AND sealed=1 AND seal_hash=${q(context.sealHash)} AND backup_sha=${q(context.backupSHA)}) THROW 51904,'SHARED_PARTY_SEAL',1;
${restorations.map(r=>`IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(r.name)}))),2),'') <>${q(r.beforeHash)} OR NOT EXISTS(SELECT 1 FROM sys.objects WHERE object_id=OBJECT_ID(${q(r.name)}) AND type=N'P') THROW 51904,'SHARED_PARTY_BEFORE_HASH',1;`).join('\n')}
${replacements.map(r=>`IF OBJECT_ID(${q(r.name)}) IS NOT NULL THROW 51904,'SHARED_PARTY_ALIAS_ALREADY_EXISTS',1;`).join('\n')}`;
 const postflightSQL=[...restorations,...replacements].map(r=>`IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(r.name)}))),2),'')<>${q(r.afterHash)} THROW 51904,'SHARED_PARTY_AFTER_HASH',1;`).join('\n');
 const permissionsSQL=restorations.map(r=>`REVOKE EXECUTE ON OBJECT::${r.name} FROM [melisa_shared_test_rw_20261009_01];`).join('\n')+'\n'+replacements.map(r=>`GRANT EXECUTE ON OBJECT::${r.name} TO [melisa_shared_test_rw_20261009_01];`).join('\n');
 const contextSHA=createHash('sha256').update(JSON.stringify(financeContext)).digest('hex');
 return {schemaVersion:'melisa-shared-party-reader-adjunct.v1',target:context.target,copyId:context.copyId,baseSealHash:context.sealHash,backupSHA:context.backupSHA,preservedGuardHash:context.catalogProof.preservedGuardHash,baseModuleManifestCount:184,adapterRevisionRows:3,registryWrites:0,businessWrites:0,sourceWrites:0,currentFinanceContext:financeContext,currentFinanceContextSHA:contextSHA,restorations,replacements,preflightSQL,postflightSQL,permissionsSQL,executionOrder:['preflightSQL','restorations[].sql individually','replacements[].sql individually','postflightSQL','permissionsSQL','same-TX serializable customer/supplier/current proof smoke','ROLLBACK rehearsal / controlled root COMMIT']};
}
