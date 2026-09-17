// Owner-authorized TEST writer. Uses only the frozen, hashed SELECT-only source export.
import{getTestPool,save,run,runDir}from'./vega-native-migration-runtime.mjs';
import{makeStore,ensureSchema}from'./vega-native-migration-store.mjs';
import{migrateMasters}from'./vega-native-migration-masters.mjs';
import{migrateDocuments,migrateLines}from'./vega-native-migration-documents.mjs';
import{migrateLedgers,migrateStock,migrateFinance,migrateRelations}from'./vega-native-migration-movements.mjs';
import{finalizeBalances,finalReceipt}from'./vega-native-migration-finalize.mjs';
import{preserveAndClassify}from'./vega-native-migration-preserve.mjs';
import{repairPurchaseAdoption}from'./vega-native-migration-adoption.mjs';
import{exposeBusinessFields}from'./vega-native-migration-readfields.mjs';
const[phase,table]=process.argv.slice(2);const actions={schema:async s=>{await ensureSchema(s.request);return{schema:true}},masters:migrateMasters,documents:migrateDocuments,lines:s=>migrateLines(s,table),ledgers:migrateLedgers,stock:s=>migrateStock(s,table),finance:migrateFinance,relations:migrateRelations,balances:finalizeBalances,preserve:preserveAndClassify,adoption:repairPurchaseAdoption,read_fields:exposeBusinessFields,receipt:finalReceipt};
if(!actions[phase])throw Error('EXPLICIT_NATIVE_MIGRATION_PHASE_REQUIRED');const pool=await getTestPool();try{const store=await makeStore(pool),result=await store.phase([phase,table].filter(Boolean).join('/'),()=>actions[phase](store));if(phase==='receipt')save('final-receipt.json',result);}finally{await pool.close();}
