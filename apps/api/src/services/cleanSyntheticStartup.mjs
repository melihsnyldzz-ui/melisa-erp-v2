// Startup-only full integrity proof. Ordinary request and identity budgets stay
// unchanged; no successful result is cached for later business operations.
export async function validateCleanOperationalStartup({pool,sql,environment=process.env}) {
 if(environment.API_PORT!=='4194')return;
 const day=environment.MELISA_CLEAN_STORE_DAY==='20261022';
 const finance=environment.MELISA_CLEAN_FINANCE==='20261022';
 const inventory=day&&environment.MELISA_CLEAN_INVENTORY==='20261022';
 if(!day&&!finance)return;
 const checks=[];
 if(finance)checks.push("IF OBJECT_ID(N'dbo.clean_store_finance_manifest') IS NULL THROW 51960,'CLEAN_INBOUND_COHORT_DRIFT',1;");
 if(inventory)checks.push("IF OBJECT_ID(N'dbo.clean_store_inventory_manifest') IS NULL THROW 51960,'CLEAN_INBOUND_COHORT_DRIFT',1;");
 checks.push('EXEC dbo.usp_clean_store_day_ready;');
 await new sql.Request(pool,{requestTimeout:30000}).query(checks.join('\n'));
}
