// Source proposal for the whole first-sale package. No GRANT is executed.
// The original master-only manifest and guard remain separately available.
import {DESKTOP_WRITE_OBJECT_PERMISSION_MANIFEST,compileDesktopWritePermissionGuard} from './desktopWritePermissionPolicy.mjs';
const rows=[...DESKTOP_WRITE_OBJECT_PERMISSION_MANIFEST];
const add=(name,permission,column=null)=>rows.push(Object.freeze({schema:'dbo',name,permission,column}));
const workflow=['desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests','desktop_sale_request_resolutions'];
for(const name of ['system_settings','currency_rates','sales_invoices','sales_invoice_items','stock_movements','customer_movements',...workflow])add(name,'SELECT');
for(const name of ['sales_invoices','sales_invoice_items','stock_movements','customer_movements',...workflow])add(name,'INSERT');
for(const name of ['desktop_sale_cartons','desktop_sale_carton_items'])add(name,'DELETE');
const updates={sales_invoices:['account_currency','account_amount','account_exchange_rate_snapshot','status','estimated_profit_try','finalized_at','updated_at','party_entity_id','party_currency_account_id'],sales_invoice_items:['average_cost_try_snapshot','gross_profit_try','gross_profit_rate'],products:['current_stock_qty','updated_at'],customers:['balance','updated_at'],customer_movements:['account_currency','account_amount','document_exchange_rate_snapshot','account_exchange_rate_snapshot','amount_try','balance_effect','party_entity_id','party_currency_account_id'],party_currency_accounts:['current_balance'],desktop_sale_workflows:['state','sent_by','prepared_by','checked_by'],desktop_sale_reservations:['state']};
for(const [name,columns] of Object.entries(updates))for(const column of columns)add(name,'UPDATE',column);
export const DESKTOP_LIFECYCLE_PERMISSION_MANIFEST=Object.freeze(rows);
export const DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL=compileDesktopWritePermissionGuard(rows);
export const DESKTOP_LIFECYCLE_PERMISSION_LIMITS=Object.freeze({sourceOnly:true,grantsInstalled:false,realSqlVerified:false,allowsDdl:false,requiresEffectivePermissionsReadback:true,immutableJournals:true});
