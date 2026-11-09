// A policy row is configuration owned by a separately reviewed installation.
// This module neither creates that row nor grants product-card editing rights.
import {createHash} from 'node:crypto';
const fail=()=>{throw Object.assign(Error('DESKTOP_SALES_POLICY_REJECTED'),{code:'DESKTOP_SALES_POLICY_REJECTED'});};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const shape=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const version=v=>typeof v==='string'&&/^0x[0-9a-f]{16}$/i.test(v);
const rate=v=>typeof v==='string'&&/^[0-5]\.\d{4}$/.test(v)&&BigInt(v.replace('.',''))<=50000n;
export const DESKTOP_SALES_POLICY_SETTING=Object.freeze({group:'desktop-sales',key:'individualPolicyV1'});
export function parseDesktopSalesPolicyRow(row){
 if(!shape(row,['id','value','valueType','active','version'])||!id(row.id)||row.valueType!=='json'||row.active!==true||!version(row.version)||typeof row.value!=='string'||Buffer.byteLength(row.value,'utf8')>65536)fail();
 let data;try{data=JSON.parse(row.value);}catch{fail();}
 // Canonical compact JSON also rejects duplicate keys instead of accepting
 // JSON.parse's last-key-wins interpretation of an authorization record.
 if(JSON.stringify(data)!==row.value||!shape(data,['version','people'])||data.version!==1||!Array.isArray(data.people)||data.people.length>256)fail();
 const seen=new Set();for(const p of data.people){
  if(!shape(p,['actorId','roleId','roleCode','kind','canChangeSalePrice','maxDiscountRateExact4'])||!id(p.actorId)||!id(p.roleId)||seen.has(p.actorId)||typeof p.roleCode!=='string'||!/^[a-z][a-z0-9_]{0,79}$/.test(p.roleCode)||!['sales','manager','boss'].includes(p.kind)||typeof p.canChangeSalePrice!=='boolean'||p.maxDiscountRateExact4!==null&&!rate(p.maxDiscountRateExact4)||p.kind!=='sales'&&p.maxDiscountRateExact4!==null)fail();
  seen.add(p.actorId);Object.freeze(p);
 }
 return Object.freeze({rowId:row.id,rowVersion:row.version,people:Object.freeze(data.people),digest:createHash('sha256').update(row.value,'utf8').digest('hex')});
}
export function desktopSalesPolicyForUser(user,row=null){
 if(!user||!id(user.id)||!id(String(user.role?.id))||typeof user.role?.code!=='string'||!version(user.userVersion)||!version(user.roleVersion)||!Array.isArray(user.permissions))fail();
 const parsed=row===null?null:parseDesktopSalesPolicyRow(row),entry=parsed?.people.find(p=>p.actorId===user.id);
 if(entry&&(entry.roleId!==String(user.role.id)||entry.roleCode!==user.role.code))fail();
 const sale=['sales.create','sales.finalize'].every(k=>user.permissions.includes(k));
 const fallback=parsed===null&&user.role.code==='desktop_first_sale_operator'&&sale;
 const individual=entry?.maxDiscountRateExact4??'3.0000';
 const limit=entry?(entry.kind==='sales'?(BigInt(individual.replace('.',''))>30000n?'3.0000':individual):'5.0000'):(fallback?'3.0000':'0.0000');
 const binding={actorId:user.id,roleId:String(user.role.id),roleCode:user.role.code,userVersion:user.userVersion,roleVersion:user.roleVersion,settingId:parsed?.rowId??null,settingVersion:parsed?.rowVersion??null,settingDigest:parsed?.digest??null};
 const revision=createHash('sha256').update(JSON.stringify(binding),'utf8').digest('hex');
 return Object.freeze({version:1,actorId:user.id,revision,canChangeSalePrice:!!entry?.canChangeSalePrice&&sale,maxDiscountRateExact4:sale?limit:'0.0000',canApproveUpToFive:['manager','boss'].includes(entry?.kind)&&user.permissions.includes('sales.view'),canApproveAboveFive:entry?.kind==='boss'&&user.permissions.includes('sales.view')});
}

// Credit exceptions are distinct from the boss-only discount permission.
// Only a separately configured person entry confers company authority; a role
// name, broad operator permissions or the legacy TEST fallback never do.
export function desktopCreditAccessForUser(user,row=null){
 const pricing=desktopSalesPolicyForUser(user,row),parsed=row===null?null:parseDesktopSalesPolicyRow(row);
 const entry=parsed?.people.find(p=>p.actorId===user.id),authorized=entry?.kind==='manager'||entry?.kind==='boss';
 return Object.freeze({revision:pricing.revision,canManage:authorized&&user.permissions.includes('customer.edit'),canApprove:authorized&&user.permissions.includes('sales.view'),canApproveOwnDueException:entry?.kind==='boss'&&user.permissions.includes('sales.view')});
}
