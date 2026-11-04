import {getCanonicalBusinessSaleDefinitionHash} from './canonicalBusinessSessionContext.mjs';
import {paymentError,supplierPaymentContext} from './workSupplierPaymentModel.mjs';
export async function legacyPaymentScope(ctx,actor){
 const s=ctx.sqlDriver,request=()=>new s.Request(ctx.transaction);
 const permissions=(await request().input('actor',s.BigInt,actor.id).query("SELECT p.permission_key FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor AND u.is_active=1 AND r.is_active=1 AND r.code=N'isolated_test_ilker' AND p.can_view=1")).recordset;
 ctx.actualPaymentPermissions=permissions?.map(p=>p.permission_key)??[];
 if(String(actor.id)!=='16'||!['finance.view','supplier.view'].every(k=>actor.permissions?.includes(k)&&permissions?.some(p=>p.permission_key===k)))throw Object.assign(Error('Bu işlem için yetkiniz bulunmuyor.'),{statusCode:403,code:'TEST_PAYMENT_ACTOR'});
 const definitions=(await request().query("SELECT OBJECT_ID(N'dbo.usp_work_supplier_payment_context',N'P') installed,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_work_supplier_payment_ready'))),2) readyHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_work_supplier_payment_context'))),2) contextHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_work_supplier_payment_effects'))),2) effectsHash")).recordset?.[0];
 if(!definitions)throw paymentError();if(definitions.installed===null&&['readyHash','contextHash','effectsHash'].every(k=>definitions[k]===null))return null;
 const {WORK_SUPPLIER_PAYMENT_SQL_PROOF:baseProof}=await import('./workSupplierPaymentSqlProof.mjs');const proof={...baseProof,readyHash:getCanonicalBusinessSaleDefinitionHash('dbo.usp_work_supplier_payment_ready',baseProof.readyHash)};if(!definitions.installed||Object.keys(proof).some(k=>definitions[k]!==proof[k]))throw paymentError();
 const row=(await request().input('actor_id',s.BigInt,actor.id).execute('dbo.usp_work_supplier_payment_context')).recordset?.[0];if(Object.keys(proof).some(k=>row?.[k]!==proof[k]))throw paymentError();const context=supplierPaymentContext(JSON.parse(row.context_json),actor);if(!context.capabilities.canView)throw paymentError();const supplier=context.suppliers.find(s=>s.currency==='TRY'),account=context.accounts.find(a=>a.currency==='TRY');return {supplierId:supplier.id,accountId:account.id,invoiceIds:supplier.invoices.map(i=>i.id)};
}
function canonicalNativeId(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?String(value):null;
 if(typeof value==='string'&&/^[1-9]\d*$/.test(value)){const number=Number(value);return Number.isSafeInteger(number)&&String(number)===value?value:null;}
 return null;
}
export function assertLegacyPaymentScope(scope,input){
 if(!scope)return;
 // The legacy route converts these fields with Number() before querying SQL.
 // Reject noncanonical forms first so text comparison cannot be bypassed by
 // whitespace, leading zeroes, decimals, exponents, arrays or unsafe integers.
 const supplier=canonicalNativeId(input.supplierId),account=canonicalNativeId(input.accountId),invoice=input.purchaseInvoiceId==null?null:canonicalNativeId(input.purchaseInvoiceId);
 if(supplier===scope.supplierId||account===scope.accountId||invoice!==null&&scope.invoiceIds.includes(invoice))throw Object.assign(Error('Bu ödeme normal tedarikçi ödeme ekranından yapılmalı.'),{statusCode:403,code:'TEST_PAYMENT_SCOPE'});
 if(supplier===null||account===null||input.purchaseInvoiceId!=null&&invoice===null)throw Object.assign(Error('Ödeme bilgileri geçersiz.'),{statusCode:400,code:'TEST_PAYLOAD'});
}
export function filterLegacyPaymentContext(scope,data){if(!scope)return data;return {...data,suppliers:data.suppliers.filter(v=>String(v.id)!==scope.supplierId),accounts:data.accounts.filter(v=>String(v.id)!==scope.accountId),invoices:data.invoices.filter(v=>!scope.invoiceIds.includes(String(v.id))),movements:data.movements.filter(v=>String(v.supplier_id)!==scope.supplierId)};}
