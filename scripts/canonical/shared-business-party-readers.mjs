// Offline alias recipe; originals stay byte-exact provenance anchors.
import {BUSINESS_COPY_DATABASE} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {assertSharedPartyContext,sharedPartyReaderDefinition} from '../../apps/api/src/services/isolatedPartyCardReader.mjs';
import {CUSTOMER_CARD_PROC_SQL} from '../../apps/api/src/services/customerCardReadStore.mjs';
import {SUPPLIER_CARD_PROC_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {CURRENT_FINANCE_PARTY_PROC_SQL,currentFinanceContext} from '../../apps/api/src/services/currentFinanceDeltaRead.mjs';
const q=s=>"N'"+s.replaceAll("'","''")+"'";
export function buildBusinessPartyReaderAdjunct(context,financeContext){
 assertSharedPartyContext(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE)throw Error('BUSINESS_PARTY_TARGET_REQUIRED');
 const finance=currentFinanceContext(financeContext);
 if(!finance||finance.accountIds.length!==283)throw Error('BUSINESS_PARTY_FINANCE_CONTEXT_REQUIRED');
 const replacements=[['customer',CUSTOMER_CARD_PROC_SQL],['supplier',SUPPLIER_CARD_PROC_SQL],['currentFinance',CURRENT_FINANCE_PARTY_PROC_SQL]].map(([role,sourceSQL])=>sharedPartyReaderDefinition(context,{role,sourceSQL}));
 const preflightSQL=`IF DB_NAME()<>${q(context.target.database)} OR @@SERVERNAME<>${q(context.target.server)} OR @@TRANCOUNT=0 THROW 51904,'BUSINESS_PARTY_INSTALL_TARGET',1;
IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_manifest WHERE copy_id=CONVERT(uniqueidentifier,${q(context.copyId)}) AND sealed=1 AND seal_hash=${q(context.sealHash)} AND backup_sha=${q(context.backupSHA)}) THROW 51904,'BUSINESS_PARTY_SEAL',1;
${replacements.map(r=>`IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(r.sourceName)}))),2),'')<>${q(r.sourceHash)} OR OBJECT_ID(${q(r.name)}) IS NOT NULL THROW 51904,'BUSINESS_PARTY_SOURCE_DRIFT',1;`).join('\n')}`;
 const postflightSQL=replacements.map(r=>`IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(r.name)}))),2),'')<>${q(r.afterHash)} THROW 51904,'BUSINESS_PARTY_ALIAS_DRIFT',1;`).join('\n');
 const permissionsSQL=replacements.map(r=>`REVOKE EXECUTE ON OBJECT::${r.sourceName} FROM [${context.target.login}]; GRANT EXECUTE ON OBJECT::${r.name} TO [${context.target.login}];`).join('\n');
 return {schemaVersion:'melisa-business-party-reader-adjunct.v1',target:context.target,copyId:context.copyId,baseSealHash:context.sealHash,backupSHA:context.backupSHA,replacements,preflightSQL,postflightSQL,permissionsSQL,restorations:[],registryWrites:0,businessWrites:0,sourceWrites:0};
}
