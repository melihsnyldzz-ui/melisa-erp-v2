import {assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL} from './cleanSyntheticContext.mjs';
import {parseCustomerCardId,parseCustomerCardQuery,customerCardError} from './customerCardModel.mjs';
import {currencyAccountBalanceFields} from './currencyAccountBalanceModel.mjs';
import {maskPhone} from './queryHelpers.js';
export function cleanCustomerCard(row,role='customer'){
 if(!['customer','supplier'].includes(role))throw customerCardError();
 const id=parseCustomerCardId(String(row.id)),known=['TRY','USD','EUR'].includes(row.currency)&&row.balance===row.ledger&&row.foreignMovements===0&&!row.held;
 return {id,contactEditable:['1','2','3','4'].includes(id)&&!row.held,[role+'Code']:row.code,[role+'Name']:row.name,isPassive:!row.active,quarantine:{blocked:row.held>0,reasons:row.held?['İnceleme bekliyor']:[]},source:{status:'synthetic',sourceAsOf:null,freshLive:false},accountCount:1,hasUnknownAccounts:!known,accounts:[{accountId:null,[role==='customer'?'nativeCustomerId':'nativeSupplierId']:id,currency:row.currency,balanceExact:known?row.balance:null,nativeBalanceExact:row.balance,sourceOpeningBalanceExact:null,confidence:row.held?'quarantined':known?'verified-native':'unknown',sourceStatus:'synthetic',sourceAsOf:null,reconciled:known,...currencyAccountBalanceFields({role,balanceExact:row.balance,localDeltaExact:row.ledger,proven:known})}],fields:{phoneMasked:maskPhone(row.phone??null),city:row.city??null,country:row.country??null,note:null}};
}
export async function readCleanCustomerCards(query={},rawId=null,role='customer'){
 if(!['customer','supplier'].includes(role))throw customerCardError();
 const context=assertRegisteredCleanContext();if(process.env.API_PORT!=='4194')throw customerCardError();
 const options=parseCustomerCardQuery(query),id=rawId===null?null:parseCustomerCardId(rawId),db=await import('../config/database.js'),pool=await db.getSqlPool();
 assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);
 const rows=(await pool.request().query(`SELECT c.id,c.${role}_code code,c.name,c.is_active active,c.currency_code currency,c.phone,c.city,c.country,CONVERT(varchar(60),CAST(c.balance AS decimal(28,8))) balance,
 CONVERT(varchar(60),CAST(COALESCE((SELECT SUM(m.balance_effect) FROM dbo.${role}_movements m WHERE m.${role}_id=c.id AND m.currency_code=c.currency_code),0) AS decimal(28,8))) ledger,
 (SELECT COUNT(*) FROM dbo.${role}_movements m WHERE m.${role}_id=c.id AND(m.currency_code IS NULL OR m.currency_code<>c.currency_code)) foreignMovements,
 (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'${role}' AND h.native_id=c.id) held
 FROM dbo.${role}s c WHERE c.is_deleted=0 ORDER BY c.id;`)).recordset.map(r=>cleanCustomerCard(r,role));
 const meta={...context,readOnly:true,sourceAsOf:null,freshLive:false};
 if(id!==null){const data=rows.find(r=>r.id===id);if(!data)throw customerCardError('CUSTOMER_CARD_NOT_FOUND','Müşteri kartı bulunamadı.',404);return {success:true,data,meta};}
 const search=options.search.toLocaleLowerCase('tr'),all=rows.filter(r=>(!search||[r[role+'Code'],r[role+'Name']].some(v=>v?.toLocaleLowerCase('tr').includes(search)))&&(options.status==='all'||r.isPassive===(options.status==='passive'))&&(options.quarantine==='all'||r.quarantine.blocked===(options.quarantine==='included')));
 return {success:true,data:all.slice((options.page-1)*options.limit,options.page*options.limit),meta:{...meta,total:all.length,page:options.page,limit:options.limit}};
}
