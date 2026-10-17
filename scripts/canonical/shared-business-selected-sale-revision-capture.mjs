// Offline compilation of an owner-captured canonical v4/v5 input. This does not
// contact SQL or establish current runtime proof for a later application boot.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateIsolatedOperationCopyContext} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {configureBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from '../../apps/api/src/services/businessDailyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL} from '../../apps/api/src/services/businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL} from '../../apps/api/src/services/businessDailyNativeCheck.mjs';
import {buildBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-sql.mjs';

export async function compileCapturedBusinessSelectedSaleRevision(input){
 if(input?.readOnly!==true||!Array.isArray(input.proofs?.daily)||input.proofs.daily.length!==4||!Array.isArray(input.proofs.profit)||!Array.isArray(input.proofs.native))throw Error('SELECTED_SUCCESSOR_OWNER_CAPTURE');
 const copy=validateIsolatedOperationCopyContext(input.context);
 const pool={request:()=>({query:async sql=>{
  if(sql===BUSINESS_DAILY_REVISION_PROOF_SQL)return {recordsets:structuredClone(input.proofs.daily)};
  if(sql===businessDailyProfitReadSQL())return {recordset:structuredClone(input.proofs.profit)};
  if(sql===businessDailyNativeCheckReadSQL())return {recordsets:structuredClone(input.proofs.native)};
  throw Error('SELECTED_SUCCESSOR_OFFLINE_QUERY');
 }})};
 await configureBusinessDailyRevision(copy,input.base,input.performance,input.effects,input.dailyRevision,pool,input.profitRevision,input.nativeCheck);
 const bundle=buildBusinessSelectedSaleRevision({copy,daily:input.daily,profit:input.profit,schema:input.schema});
 return {copy,bundle};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [inputPath,outputPath]=process.argv.slice(2);if(!inputPath||!outputPath)throw Error('SELECTED_SUCCESSOR_CAPTURE_CLI');
 const input=JSON.parse(fs.readFileSync(inputPath,'utf8')),{bundle}=await compileCapturedBusinessSelectedSaleRevision(input);
 fs.writeFileSync(outputPath,JSON.stringify(bundle));
 process.stdout.write(JSON.stringify({output:outputPath,revisionHash:bundle.revision.revisionHash,modules:bundle.replacements.length,businessWrites:0}));
}
