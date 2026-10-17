import test from 'node:test';
import assert from 'node:assert/strict';
import {splitStockHoldDisjunction,transformStockHoldDistinct,validateStockPredicateSource,STOCK_PREDICATE_BASE,STOCK_PREDICATE_NATIVE_NAMES,STOCK_PREDICATE_TRIGGER_ORDER} from './shared-business-stock-predicate-distinct-source.mjs';
const branches=['x.product_id IN(1,2)','x.customer_id=3','x.supplier_id=4',"x.source_type=N'A' AND x.source_id=5","x.source_type=N'B' AND x.source_id=6","x.source_type=N'C' AND x.source_id=7","x.source_type=N'D' AND x.source_id=8"];
const prefix='CREATE TRIGGER dbo.synthetic ON dbo.stock_movements AS BEGIN EXEC dbo.usp_assert_operation_quarantine_v2;';
const marker='IF EXISTS(SELECT 1 FROM(SELECT * FROM inserted UNION ALL SELECT * FROM deleted)x WHERE ';
const suffix=" THROW 51904,'SYNTHETIC_HELD',1;RETURN;END;";
test('synthetic seven branches keep byte exact predicate fragments, both rowsets and whole dependency tuples',()=>{
 const source=prefix+marker+branches.join(' OR ')+')'+suffix,t=transformStockHoldDistinct(source);
 assert.equal(t.prefix,prefix);assert.equal(t.suffix,suffix);assert.equal(t.branches.length,7);assert.equal(t.branches.join('OR'),t.predicate);
 for(const branch of t.branches)assert(t.semanticDefinition.includes(branch));
 for(const columns of ['product_id','customer_id','supplier_id','source_type,source_id'])assert(t.semanticDefinition.includes(`SELECT DISTINCT ${columns} FROM(SELECT ${columns} FROM inserted UNION ALL SELECT ${columns} FROM deleted)affected`));
 assert.equal((t.semanticDefinition.match(/EXEC dbo\.usp_assert_operation_quarantine_v2/g)||[]).length,1);
 assert(!/\b(?:NOLOCK|READUNCOMMITTED|GRANT|DENY|REVOKE|DISABLE)\b/.test(t.semanticDefinition));
});
test('outer SQL splitter masks escaped quotes, OR literals, nested block comments and nested disjunctions',()=>{
 const value="(x.source_type=N'OR)''quote' AND (1=1 OR 2=2))/* OR /* ) */ */ OR x.source_id=7)-- ignored OR";
 const parsed=splitStockHoldDisjunction(value);assert.equal(parsed.branches.length,2);assert.equal(value[parsed.end],')');
 for(const value of ["(x.source_id=1", "'unterminated)", '/* unterminated )'])assert.throws(()=>splitStockHoldDisjunction(value));
});
test('unknown dependencies, absent duplicate marker and branch-count drift never produce a transformation',()=>{
 for(const source of [prefix+suffix,prefix+marker+branches.join(' OR ')+')'+marker+branches.join(' OR ')+')'+suffix,prefix+marker+branches.slice(1).join(' OR ')+')'+suffix,prefix+marker+['x.product_id=1 AND x.quantity=2',...branches.slice(1)].join(' OR ')+')'+suffix])assert.throws(()=>transformStockHoldDistinct(source));
});
test('DISTINCT domains preserve boolean existence over duplicate/NULL rows and source pairs from inserted AND deleted',()=>{
 const predicates=[r=>r.product_id===1,r=>r.customer_id===3,r=>r.supplier_id===4,...['A','B','C','D'].map((type,i)=>r=>r.source_type===type&&r.source_id===i+5)];
 const rows=[{product_id:null,customer_id:null,supplier_id:null,source_type:null,source_id:null},{product_id:1,customer_id:null,supplier_id:null,source_type:'A',source_id:9},{product_id:null,customer_id:3,supplier_id:null,source_type:'A',source_id:5},{product_id:null,customer_id:null,supplier_id:4,source_type:'B',source_id:5}];
 for(let a=0;a<16;a++)for(let b=0;b<16;b++){
  const union=[...rows.filter((r,i)=>a&(1<<i)),...rows.filter((r,i)=>b&(1<<i))];
  const old=union.some(r=>predicates.some(p=>p(r))),domains=[['product_id'],['customer_id'],['supplier_id'],['source_type','source_id']];
  const distinct=domains.some((keys,i)=>[...new Map(union.map(r=>[JSON.stringify(keys.map(k=>r[k])),r])).values()].some(r=>(i===3?predicates.slice(3):[predicates[i]]).some(p=>p(r))));assert.equal(distinct,old);
 }
});
test('a shape-only synthetic leaf, self-reported hash or ordering/object substitution cannot earn source authority',()=>{
 const source={name:STOCK_PREDICATE_BASE.name,definition:prefix+marker+branches.join(' OR ')+')'+suffix,nativeHash:STOCK_PREDICATE_BASE.nativeHash,utf8Hash:STOCK_PREDICATE_BASE.utf8Hash,triggerOrder:{...STOCK_PREDICATE_TRIGGER_ORDER},objectIds:Object.fromEntries(STOCK_PREDICATE_NATIVE_NAMES.map((n,i)=>[n,100+i]))};
 for(const edit of [v=>{},v=>v.definition+='\n',v=>v.extra=true,v=>v.triggerOrder.firstInsert=1,v=>v.triggerOrder.lastDelete=1,v=>delete v.objectIds[STOCK_PREDICATE_BASE.name],v=>v.objectIds[STOCK_PREDICATE_BASE.name]=1.5,v=>v.objectIds[STOCK_PREDICATE_BASE.name]=-1,v=>v.objectIds[STOCK_PREDICATE_BASE.name]=101]){const v=structuredClone(source);edit(v);assert.throws(()=>validateStockPredicateSource(v));}
});
