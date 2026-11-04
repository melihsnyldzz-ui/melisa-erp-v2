// Offline extension of the established same-transaction native guard pattern.
// This compiler is not an installer and cannot authorize an inbound operation.
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';

const admitted=Object.freeze({
 clean_sale_products_guard:'products',
 clean_sale_stock_movements_guard:'stock_movements',
 clean_sale_audit_logs_guard:'audit_logs',
});
const fail=()=>{throw Error('CLEAN_INBOUND_GUARD_COMPILER_SCOPE');};
const base=buildCleanOrderSaleProcedures();
export function compileCleanInboundGuardBranch(name,definition){
 if(!Object.hasOwn(admitted,name)||definition!==base[name])fail();
 const marker='AS BEGIN';
 const offset=definition.indexOf(marker);
 if(offset<0||definition.indexOf(marker,offset+marker.length)>=0)fail();
 const table=admitted[name];
 // The new verifier must be installed and sealed in the SAME schema transaction
 // before this ALTER is usable. Absence/drift fails closed; no legacy fallback
 // follows a rejected inbound intent. Without an inbound intent, the complete
 // existing SALE guard still runs unchanged.
 const branch=`\n/* CLEAN_INBOUND same-TX branch; original SALE body follows. */
 ${CLEAN_TARGET_SQL}
 IF EXISTS(SELECT 1 FROM dbo.clean_store_day_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()) BEGIN
 DECLARE @clean_inbound_inserted nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@clean_inbound_deleted nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);
 EXEC dbo.usp_clean_store_day_guard @table_name=N'${table}',@inserted=@clean_inbound_inserted,@deleted=@clean_inbound_deleted;
 RETURN;END;\n`;
 const stored=definition.slice(0,offset+marker.length)+branch+definition.slice(offset+marker.length);
 const beforeHash=moduleHash(definition),afterHash=moduleHash(stored);
 if(beforeHash===afterHash||!stored.endsWith(definition.slice(offset+marker.length)))fail();
 return Object.freeze({name,table,beforeHash,afterHash,definition:stored.replace(/^CREATE TRIGGER/,'ALTER TRIGGER')});
}

export function cleanInboundGuardUpgradePlan(){
 return Object.freeze(Object.keys(admitted).map(name=>compileCleanInboundGuardBranch(name,base[name])));
}

export function cleanInboundEffectiveDefinitionHashSql(alias='d'){
 if(alias!=='d')fail();
 // Immutable old evidence remains the before witness. A current hash may only
 // replace the exact same object AND the exact recorded previous hash. The
 // eventual active-ready procedure must independently validate the new sealed
 // manifest and its verifier; this expression alone grants no write authority.
 return `COALESCE((SELECT e.after_hash FROM dbo.clean_store_day_module_manifest e WHERE e.name=${alias}.name AND e.before_hash=${alias}.definition_hash),${alias}.definition_hash)`;
}
