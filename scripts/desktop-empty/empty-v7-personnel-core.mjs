// Pure, finite DB9 personnel contract. No I/O, credential values or execution authority.
import {createHash} from 'node:crypto';
import {EMPTY_V7_TARGET} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
export const EMPTY_V7_PERSONNEL_TARGET=EMPTY_V7_TARGET;
export const EMPTY_V7_PERSONNEL_OWNER_SID='S-1-5-21-2170750028-1005938530-2568122015-1001';
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const read=[1,0,0,0,0],write=[1,1,0,0,0];
export const EMPTY_V7_PERSONNEL_ROLES=freeze([
 {key:'sales',code:'desktop_db9_sales_test',rights:['product.view','customer.view','sales.view','sales.create','sales.edit','sales.finalize'].map(key=>({key,flags:[...read]}))},
 {key:'warehouse',code:'desktop_db9_warehouse_test',rights:['warehouse.view','warehouse.prepare','warehouse.pack'].map(key=>({key,flags:[...read]}))},
 {key:'approval',code:'desktop_db9_approval_test',rights:[{key:'sales.view',flags:[...read]}]},
 {key:'accounting',code:'desktop_db9_accounting_test',rights:[{key:'customer.view',flags:[...read]},{key:'supplier.view',flags:[...read]},{key:'finance.collection',flags:[...write]},{key:'finance.payment',flags:[...write]}]},
 {key:'creditSetup',code:'desktop_db9_credit_setup_test',rights:[{key:'customer.view',flags:[...read]},{key:'customer.edit',flags:[1,1,1,0,0]}]}
]);
export const EMPTY_V7_PERSONNEL_ROSTER=freeze([
 {key:'sales',username:'erp_db9_sales_test',role:'sales',kind:'sales',maxDiscountRateExact4:'3.0000'},
 {key:'warehouse',username:'erp_db9_warehouse_test',role:'warehouse',kind:null,maxDiscountRateExact4:null},
 {key:'manager',username:'erp_db9_manager_test',role:'approval',kind:'manager',maxDiscountRateExact4:null},
 {key:'boss',username:'erp_db9_boss_test',role:'approval',kind:'boss',maxDiscountRateExact4:null},
 {key:'accounting',username:'erp_db9_accounting_test',role:'accounting',kind:null,maxDiscountRateExact4:null},
 {key:'creditSetup',username:'erp_db9_credit_setup_test',role:'creditSetup',kind:'manager',maxDiscountRateExact4:null}
]);
export const personnelDigest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x),'utf8').digest('hex');
export const EMPTY_V7_PERSONNEL_ROSTER_SHA256=personnelDigest(EMPTY_V7_PERSONNEL_ROSTER);
export const EMPTY_V7_PERSONNEL_HASH_KEYS=freeze(['metadataSha256','securitySha256','businessSha256','adminSha256','settingsSha256','auditSha256','pendingSha256']);
export const EMPTY_V7_PERSONNEL_BUSINESS_NAMES=freeze('currency_rates customer_movements customers desktop_finance_requests desktop_goods_purchase_links desktop_goods_receipt_lines desktop_goods_receipts desktop_goods_requests desktop_local_master_requests desktop_local_price_units desktop_local_product_units desktop_sale_carton_items desktop_sale_cartons desktop_sale_request_resolutions desktop_sale_reservations desktop_sale_workflow_requests desktop_sale_workflows finance_account_movements party_currency_accounts party_entities product_barcodes product_images product_prices products purchase_invoice_items purchase_invoices sales_invoice_items sales_invoices stock_movements supplier_movements suppliers terminal_sync_queue'.split(' '));
export const EMPTY_V7_PERSONNEL_FIELDS=freeze(['state','mode','rosterOperationId','operationId','rosterSha256','userCount','roleCount','permissionCount','identitiesJson','policyId','policyVersion','policySha256',...EMPTY_V7_PERSONNEL_HASH_KEYS,'businessFingerprintsJson']);
const fail=()=>{throw Error('EMPTY_V7_PERSONNEL_INPUT_REJECTED');};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,names)=>plain(x)&&Reflect.ownKeys(x).length===names.length&&names.every(k=>{const d=Object.getOwnPropertyDescriptor(x,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const same=(x,y)=>exact(x,Object.keys(y))&&Object.entries(y).every(([k,v])=>x[k]===v);
const id=x=>typeof x==='string'&&/^[1-9]\d{0,15}$/.test(x)&&BigInt(x)<=9007199254740991n;
const rv=x=>typeof x==='string'&&/^0x[0-9a-f]{16}$/.test(x)&&x!=='0x0000000000000000';
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
export const personnelUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
const parse=x=>{if(typeof x!=='string'||x.length>65536)fail();try{return JSON.parse(x);}catch{fail();}};
function identities(users,active){
 if(typeof active!=='boolean'||!Array.isArray(users)||users.length!==6||Object.keys(users).length!==6)fail();
 const userIds=new Set(),roleIds=new Map();
 for(let i=0;i<6;i++){
  const u=users[i],p=EMPTY_V7_PERSONNEL_ROSTER[i],r=EMPTY_V7_PERSONNEL_ROLES.find(x=>x.key===p.role);
  if(!exact(u,['key','username','userId','userVersion','roleId','roleVersion','roleCode','active'])||u.key!==p.key||u.username!==p.username||u.roleCode!==r.code||!id(u.userId)||!id(u.roleId)||u.userId==='1'||u.roleId==='1'||!rv(u.userVersion)||!rv(u.roleVersion)||u.active!==active||userIds.has(u.userId))fail();
  userIds.add(u.userId);const existing=roleIds.get(p.role);
  if(existing&&(existing.id!==u.roleId||existing.version!==u.roleVersion))fail();
  if(!existing&&[...roleIds.values()].some(x=>x.id===u.roleId))fail();
  roleIds.set(p.role,{id:u.roleId,version:u.roleVersion});
 }
 return users;
}
export function personnelPolicy(users){
 if(!Array.isArray(users)||users.length!==6)fail();
 identities(users,users[0]?.active);
 return JSON.stringify({version:1,people:EMPTY_V7_PERSONNEL_ROSTER.filter(x=>x.kind!==null).map(p=>{const u=users.find(x=>x.key===p.key);return {actorId:u.userId,roleId:u.roleId,roleCode:u.roleCode,kind:p.kind,canChangeSalePrice:false,maxDiscountRateExact4:p.maxDiscountRateExact4};})});
}
export function parsePersonnelObservation(row){
 if(!exact(row,EMPTY_V7_PERSONNEL_FIELDS)||!['preflight','rollback','create-inactive','activate','deactivate'].includes(row.mode)||!personnelUuid(row.rosterOperationId)||!personnelUuid(row.operationId)||row.operationId===row.rosterOperationId||row.rosterSha256!==EMPTY_V7_PERSONNEL_ROSTER_SHA256||!EMPTY_V7_PERSONNEL_HASH_KEYS.every(k=>hex(row[k])))fail();
 const users=parse(row.identitiesJson),business=parse(row.businessFingerprintsJson),absent=row.userCount===1;
 if(!Array.isArray(business)||business.length!==32||Object.keys(business).length!==32||business.some((x,i)=>!exact(x,['name','count','sha256'])||x.name!==EMPTY_V7_PERSONNEL_BUSINESS_NAMES[i]||!Number.isSafeInteger(x.count)||x.count<0||x.count>1000||!hex(x.sha256)))fail();
 let policy=null;
 if(absent){if(row.mode!=='preflight'||row.state!=='EMPTY_V7_PERSONNEL_OBSERVED'||row.roleCount!==1||row.permissionCount!==35||!Array.isArray(users)||users.length||row.policyId!==null||row.policyVersion!==null||row.policySha256!==null)fail();}
 else{
  const active=row.mode==='activate'||row.mode==='preflight'&&users[0]?.active===true;
  if(row.userCount!==7||row.roleCount!==6||row.permissionCount!==51||!id(row.policyId)||!rv(row.policyVersion)||!hex(row.policySha256))fail();
  identities(users,active);
  const expected=row.mode==='preflight'?'EMPTY_V7_PERSONNEL_OBSERVED':row.mode==='activate'?'EMPTY_V7_PERSONNEL_ACTIVATED':row.mode==='deactivate'?'EMPTY_V7_PERSONNEL_DEACTIVATED':'EMPTY_V7_PERSONNEL_CREATED_INACTIVE';
  if(row.state!==expected||createHash('sha256').update(personnelPolicy(users),'utf16le').digest('hex')!==row.policySha256)fail();
  policy={id:row.policyId,version:row.policyVersion,sha256:row.policySha256};
 }
 return freeze({version:1,state:row.state,mode:row.mode,target:{...EMPTY_V7_TARGET},rosterOperationId:row.rosterOperationId,operationId:row.operationId,rosterSha256:row.rosterSha256,counts:{users:row.userCount,roles:row.roleCount,permissions:row.permissionCount},users,policy,hashes:Object.fromEntries(EMPTY_V7_PERSONNEL_HASH_KEYS.map(k=>[k,row[k]])),business});
}
export function validatePersonnelReceipt(r){
 if(!exact(r,['version','state','target','rosterOperationId','operationId','rosterSha256','users','policy','hashes'])||r.version!==1||!['EMPTY_V7_PERSONNEL_CREATED_INACTIVE','EMPTY_V7_PERSONNEL_ACTIVATED','EMPTY_V7_PERSONNEL_DEACTIVATED'].includes(r.state)||!same(r.target,EMPTY_V7_TARGET)||!personnelUuid(r.rosterOperationId)||!personnelUuid(r.operationId)||r.operationId===r.rosterOperationId||r.rosterSha256!==EMPTY_V7_PERSONNEL_ROSTER_SHA256||!exact(r.hashes,EMPTY_V7_PERSONNEL_HASH_KEYS)||!Object.values(r.hashes).every(hex)||!exact(r.policy,['id','version','sha256'])||!id(r.policy.id)||!rv(r.policy.version)||!hex(r.policy.sha256))fail();
 identities(r.users,r.state==='EMPTY_V7_PERSONNEL_ACTIVATED');
 if(createHash('sha256').update(personnelPolicy(r.users),'utf16le').digest('hex')!==r.policy.sha256)fail();
 return true;
}
export function personnelReceipt(observation){
 if(!['create-inactive','activate','deactivate'].includes(observation?.mode))fail();
 const r={version:1,state:observation?.state,target:observation?.target,rosterOperationId:observation?.rosterOperationId,operationId:observation?.operationId,rosterSha256:observation?.rosterSha256,users:observation?.users,policy:observation?.policy,hashes:observation?.hashes};
 validatePersonnelReceipt(r);return freeze(structuredClone(r));
}
export function assertPersonnelPreservation(before,after){
 if(!before||!after||!same(before.target,EMPTY_V7_TARGET)||!same(after.target,EMPTY_V7_TARGET)||before.rosterOperationId!==after.rosterOperationId||before.rosterSha256!==EMPTY_V7_PERSONNEL_ROSTER_SHA256||after.rosterSha256!==EMPTY_V7_PERSONNEL_ROSTER_SHA256||!exact(before.hashes,EMPTY_V7_PERSONNEL_HASH_KEYS)||!exact(after.hashes,EMPTY_V7_PERSONNEL_HASH_KEYS)||!hashKeysEqual(before.hashes,after.hashes)||JSON.stringify(before.business)!==JSON.stringify(after.business))fail();
 if(before.policy!==null&&JSON.stringify(before.policy)!==JSON.stringify(after.policy))fail();return true;
}
const hashKeysEqual=(a,b)=>EMPTY_V7_PERSONNEL_HASH_KEYS.every(k=>hex(a[k])&&a[k]===b[k]);
