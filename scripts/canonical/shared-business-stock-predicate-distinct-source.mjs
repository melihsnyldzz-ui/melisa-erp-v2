// Pure preparation: the one captured stock leaf is never inferred from rows,
// HTTP, a caller-selected hash, or a different trigger. No native execution.
import {createHash} from 'node:crypto';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';

export const STOCK_PREDICATE_BASE=Object.freeze({name:'dbo.supplier_identity_quarantine_v2_stock_movements',nativeHash:'5C9EDDE75D6CAA400A9DD47861D47B0252CE5312E43462846B030C08CC40A718',utf8Hash:'60332C1760D25B8798BAA52181BC2E734AC8016F8BAB9C51735FB45913F9BCF2',definitionLength:67852,prefixHash:'466C2A8DB4AAF67E394F6F4B8FDCED9D580D549E0739DEC4138B968DECA36569',suffixHash:'78E7EF70377AB179EEC3C0F46D9E7876479D4D09A77840009D84A02AB57F4F60',predicateHash:'A9E44F07E0C37E891FFEB88E5DFC4E7A86A44EDD2A548E579CC6579576756F1B'});
export const STOCK_PREDICATE_TRIGGER_ORDER=Object.freeze({firstInsert:0,firstUpdate:0,firstDelete:0,lastInsert:0,lastUpdate:0,lastDelete:0});
export const STOCK_PREDICATE_NATIVE_NAMES=Object.freeze(['dbo.supplier_identity_quarantine_v2_stock_movements','dbo.usp_assert_operation_quarantine_v2','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context','dbo.usp_business_selected_sale_context_v2','dbo.usp_business_selected_sale_write_intent_v1']);
export const STOCK_PREDICATE_BRANCH_HASHES=Object.freeze(['6ED1B2BC166842CFB7A7A01C21EB66FE61D2DADAEF6913FC4DF1C7DF72C40A1E','3AA791DD7FC4E94E598FE1B6768C2CF49B5F21BAC3AC4CA752F3D4A22DE62D71','EC88C877087BD3787174EA71596DCE1212BE3EBA116307E4A231278FDDEFCC77','923917880F469F8738B7A74153631D7B1B17E3319934F5C89DB4C3F6B41A9BDB','1E0301BF18F2A4CBE169EA95A99DFAE82AB82075748E9C97A872D6D2E79BD09F','D99753DEB705511C20902275D794C4C089987B216B5EBBFCFDDC6F674B970879','1A56C22F7FAEF8E57AA9DD73EF416397A2A724702F8311939DB78CEB44952C44']);
const dependencies=[['product_id'],['customer_id'],['supplier_id'],...Array.from({length:4},()=>['source_id','source_type'])];
const marker='IF EXISTS(SELECT 1 FROM(SELECT * FROM inserted UNION ALL SELECT * FROM deleted)x WHERE ';
const check=(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});};
const exact=(v,ks)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join()===ks.toSorted().join();

// Shape-only helper for synthetic parser tests. It confers no source authority.
export function splitStockHoldDisjunction(text){
 check(typeof text==='string','STOCK_PREDICATE_SQL_INPUT');let depth=0,state='code',blockDepth=0;const ors=[];
 for(let i=0;i<text.length;i++){
  const a=text[i],b=text[i+1];
  if(state==='quote'){if(a==="'"&&b==="'")i++;else if(a==="'")state='code';continue;}
  if(state==='line'){if(a==='\n')state='code';continue;}
  if(state==='block'){if(a==='/'&&b==='*'){blockDepth++;i++;}else if(a==='*'&&b==='/'){if(--blockDepth===0)state='code';i++;}continue;}
  if(a==="'"){state='quote';continue;}if(a==='-'&&b==='-'){state='line';i++;continue;}if(a==='/'&&b==='*'){state='block';blockDepth=1;i++;continue;}
  if(a==='(')depth++;else if(a===')'){if(depth===0){const cuts=[0,...ors.map(p=>p+2)];return{end:i,branches:cuts.map((p,n)=>text.slice(p,n<ors.length?ors[n]:i))};}depth--;}
  if(depth===0&&text.slice(i,i+2)==='OR'&&!/[a-z_0-9]/i.test(text[i-1]??'')&&!/[a-z_0-9]/i.test(text[i+2]??'')){ors.push(i);i++;}
 }
 check(false,'STOCK_PREDICATE_SQL_BALANCE');
}
export function transformStockHoldDistinct(definition){
 check(typeof definition==='string'&&definition.split(marker).length===2,'STOCK_PREDICATE_SQL_SHAPE');
 const outer=definition.indexOf(marker),start=outer+marker.length,p=splitStockHoldDisjunction(definition.slice(start)),predicate=definition.slice(start,start+p.end),prefix=definition.slice(0,outer),suffix=definition.slice(start+p.end+1);
 check(p.branches.length===7&&p.branches.join('OR')===predicate,'STOCK_PREDICATE_SEVEN_BRANCHES');
 for(const [i,b] of p.branches.entries())check(isolatedCopyJSON([...new Set([...b.matchAll(/\bx\.([a-z_]+)/gi)].map(m=>m[1]))].sort())===isolatedCopyJSON(dependencies[i]),'STOCK_PREDICATE_DEPENDENCIES');
 const exists=(columns,predicate)=>`EXISTS(SELECT 1 FROM(SELECT DISTINCT ${columns} FROM(SELECT ${columns} FROM inserted UNION ALL SELECT ${columns} FROM deleted)affected)x WHERE ${predicate})`;
 const semanticDefinition=prefix+'IF '+[exists('product_id',p.branches[0]),exists('customer_id',p.branches[1]),exists('supplier_id',p.branches[2]),exists('source_type,source_id',p.branches.slice(3).join('OR'))].join(' OR ')+suffix;
 return {semanticDefinition,prefix,suffix,predicate,branches:p.branches};
}
export function validateStockPredicateSource(source){
 const b=STOCK_PREDICATE_BASE;
 check(exact(source,['name','definition','nativeHash','utf8Hash','triggerOrder','objectIds'])&&source.name===b.name&&source.nativeHash===b.nativeHash&&source.utf8Hash===b.utf8Hash&&isolatedCopyJSON(source.triggerOrder)===isolatedCopyJSON(STOCK_PREDICATE_TRIGGER_ORDER)&&exact(source.objectIds,STOCK_PREDICATE_NATIVE_NAMES)&&Object.values(source.objectIds).every(v=>Number.isSafeInteger(v)&&v>0)&&new Set(Object.values(source.objectIds)).size===6,'STOCK_PREDICATE_PRIVATE_SOURCE');
 check(typeof source.definition==='string'&&source.definition.length===b.definitionLength&&moduleHash(source.definition)===b.nativeHash&&createHash('sha256').update(source.definition,'utf8').digest('hex').toUpperCase()===b.utf8Hash&&source.definition.startsWith('CREATE TRIGGER '+b.name+' ON dbo.stock_movements '),'STOCK_PREDICATE_PRIVATE_SOURCE_BYTES');
 const t=transformStockHoldDistinct(source.definition);
 check(moduleHash(t.prefix)===b.prefixHash&&moduleHash(t.suffix)===b.suffixHash&&moduleHash(t.predicate)===b.predicateHash&&t.branches.every((v,i)=>moduleHash(v.trim())===STOCK_PREDICATE_BRANCH_HASHES[i]),'STOCK_PREDICATE_SOURCE_COMPONENTS');
 const proof={prefixHash:b.prefixHash,suffixHash:b.suffixHash,originalPredicateHash:b.predicateHash,branchHashes:[...STOCK_PREDICATE_BRANCH_HASHES],sevenBranchBytesPreserved:true,dependencySets:dependencies.map(v=>[...v]),insertedAndDeletedBothPreserved:true,allGlobalChecksAndNestedAssertPreserved:true,sourceColumnTypesAndCollationInherited:true,returnAndThrowUnchanged:true,requiresNewForwardRegistry:true,requiresFullCurrentModuleSelfProof:true,requiresRootActualStoredHashAndObjectIdProof:true};
 return {...t,name:b.name,beforeHash:b.nativeHash,sourceUtf8Hash:b.utf8Hash,proof};
}
export const stockPredicateLeafProof=()=>({prefixHash:STOCK_PREDICATE_BASE.prefixHash,suffixHash:STOCK_PREDICATE_BASE.suffixHash,originalPredicateHash:STOCK_PREDICATE_BASE.predicateHash,branchHashes:[...STOCK_PREDICATE_BRANCH_HASHES],sevenBranchBytesPreserved:true,dependencySets:dependencies.map(v=>[...v]),insertedAndDeletedBothPreserved:true,allGlobalChecksAndNestedAssertPreserved:true,sourceColumnTypesAndCollationInherited:true,returnAndThrowUnchanged:true,requiresNewForwardRegistry:true,requiresFullCurrentModuleSelfProof:true,requiresRootActualStoredHashAndObjectIdProof:true});
