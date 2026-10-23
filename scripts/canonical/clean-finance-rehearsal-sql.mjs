// Offline source selection only. No SQL execution, schema or runtime setup.
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildCleanOrderSaleProcedures} from './clean-order-sale-sql.mjs';
import {buildCleanStoreDayDefinitions,buildCleanStoreDayFinanceDefinitions,buildCleanStoreDayInventoryDefinitions,buildCleanInventoryCostFixtureDefinitions,buildCleanStoreAdministratorDefinitions} from './clean-store-day-cohort-sql.mjs';
export function buildCleanFinanceRehearsalPredecessors(){
 const day=buildCleanStoreDayDefinitions();
 // The cohort installs these upgraded guards separately from its procedures.
 // SQL stores the original CREATE spelling after ALTER; retain its exact body.
 const guards=Object.fromEntries(day.guards.map(g=>{
  const body=g.definition.replace(/^ALTER TRIGGER/,'CREATE TRIGGER');
  if(moduleHash(body)!==g.afterHash)throw Error('B4 inbound guard predecessor changed: '+g.name);
  return [g.name,body];
 }));
 return {...buildCleanOrderSaleProcedures(),...day.definitions,...guards,...buildCleanStoreDayFinanceDefinitions().definitions,...buildCleanStoreDayInventoryDefinitions().definitions,...buildCleanInventoryCostFixtureDefinitions().definitions,...buildCleanStoreAdministratorDefinitions().definitions};
}
