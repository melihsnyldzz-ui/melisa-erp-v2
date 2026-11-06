// Finite offline DDL inventory for the pinned installation compilers. Never executes SQL.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,base),'utf8'));
const source=read('k02-02-source-ddl.json'),observed=read('k02-02-installed-metadata.json');
assert.equal(source.sourceHead,'701bc1b694b2b6393ecaacbefd2e09efb9bde2f1');
assert.equal(source.installedManifestBytesSha256,'99c6da2b7278da9ef4a32f1fac8de57fc01e599db3bd8cd645d3ecc9089d7ae3');
assert.equal(source.trackedTreeClean,true);assert.equal(source.installedSourceHashesVerified,true);assert.equal(source.installedSourceCount,184);
for(const batch of source.batches)assert.equal(createHash('sha256').update(batch.sql).digest('hex'),batch.sha256);
assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'),'6468340f1420e77a77b0cc1d8d2c9526330ca726cdf1427047c8974192a6b024');
assert.equal(createHash('sha256').update(JSON.stringify(observed)).digest('hex'),'4fece4310a128f3baa401815e17de54f7af23076dabe8aa6fb4326b672c37fea');
const indexOptions=read('k02-02-index-options.json');
assert.equal(createHash('sha256').update(JSON.stringify(indexOptions)).digest('hex'),'09e904b4815922ff329b0c18e75e9c478ef89bb1e6d3b4930720b36378496f55');
assert.equal(indexOptions.metadata.indexOptions.length,83);
const verifyOnly=process.argv[2]==='--verify-capture';
const mutation=verifyOnly?null:process.argv[2]??null;
const mutations={
 'missing-table':m=>m.tables.pop(),
 'column-type':m=>m.columns.find(c=>c.table==='products'&&c.name==='stock_code').type='varchar',
 'column-size':m=>m.columns.find(c=>c.table==='products'&&c.name==='stock_code').maxLength--,
 'decimal-scale':m=>m.columns.find(c=>c.table==='products'&&c.name==='sales_price').scale--,
 'column-nullable':m=>m.columns.find(c=>c.table==='products'&&c.name==='id').nullable=true,
 'foreign-target':m=>m.foreignKeys.find(f=>f.name==='FK_empty_local_products_supplier').columns[0].referenced='supplier_code',
 'foreign-untrusted':m=>m.foreignKeys[0].untrusted=true,
 'index-order':m=>m.indexes.find(i=>i.name==='IX_products_category_brand').keys.reverse().forEach((k,i)=>k.ordinal=i+1),
 'index-filter':m=>m.indexes.find(i=>i.name==='UX_desktop_v3_supplier_account').filterDefinition=null,
 'index-include':m=>m.indexes.find(i=>i.name==='IX_desktop_active_reservations').included.pop(),
 'check-missing':m=>m.checks.pop(),
 'check-replaced':m=>m.checks[0].name='CK_unexpected_replacement',
 'index-ignore-dup-key':m=>{},
};
if(mutation){assert.ok(Object.hasOwn(mutations,mutation));mutations[mutation](observed.metadata);}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function tokens(sql){
 const result=[];let p=0;
 while(p<sql.length){
  const rest=sql.slice(p);let m;
  if((m=/^\s+|^--[^\n]*|^\/\*[\s\S]*?\*\//.exec(rest))){p+=m[0].length;continue;}
  if((m=/^N?'(?:[^']|'')*'|^\[(?:[^\]]|\]\])*\]|^[A-Za-z_@][A-Za-z_@0-9]*|^\d+(?:\.\d+)?|^[^\s]/.exec(rest))){result.push(m[0].startsWith('[')?m[0].slice(1,-1).replaceAll(']]',']').toLowerCase():m[0].toLowerCase());p+=m[0].length;}else throw Error('TOKEN_REJECTED');
 }return result;
}
function group(t,p){assert.equal(t[p],'(');let depth=1;for(let i=p+1;i<t.length;i++){if(t[i]==='(')depth++;if(t[i]===')'&&!--depth)return [t.slice(p+1,i),i+1];}throw Error('GROUP_UNCLOSED');}
function split(t){const out=[];let depth=0,start=0;for(let i=0;i<t.length;i++){if(t[i]==='(')depth++;if(t[i]===')')depth--;if(t[i]===','&&depth===0){out.push(t.slice(start,i));start=i+1;}}out.push(t.slice(start));return out;}
const list=t=>split(t).map(s=>{assert.match(s[0],/^[a-z_][a-z_0-9]*$/);assert.ok(s.length===1||s.length===2&&['asc','desc'].includes(s[1]));return {name:s[0],descendingKey:s[1]==='desc'};});
const tables=new Map(),foreignKeys=[],indexes=[],checks=new Map(),conditionalDuplicates=[];
function tableName(t,p){assert.equal(t[p],'dbo');assert.equal(t[p+1],'.');return t[p+2];}
function index(table,name,keys,kind,extra={}){indexes.push({table,name,keys,unique:kind!=='index',primaryKey:kind==='primary',uniqueConstraint:kind==='unique',type:kind==='primary'?'CLUSTERED':'NONCLUSTERED',included:[],filterDefinition:null,...extra});}
function constraints(table,t,column=null){
 for(let i=0;i<t.length-2;i++)if(t[i]==='constraint'&&t[i+2]==='check'){
  const key=table+'.'+t[i+1];assert.ok(!checks.has(key),'DUPLICATE_CHECK');checks.set(key,{table,name:t[i+1]});
 }
 let pos=t.indexOf('foreign');
 if(pos>=0){
  assert.equal(t[pos+1],'key');const [parents]=group(t,pos+2),r=t.indexOf('references',pos);
  assert.ok(r>pos);const refTable=tableName(t,r+1),[refs]=group(t,r+4);
  assert.ok(pos>=2&&t[pos-2]==='constraint');assert.equal(list(parents).length,list(refs).length);
  foreignKeys.push({table,name:t[pos-1],refTable,columns:list(parents).map((v,i)=>({parent:v.name,referenced:list(refs)[i].name})),deleteAction:'NO_ACTION',updateAction:'NO_ACTION'});
  assert.ok(!t.includes('cascade'));return;
 }
 pos=t.indexOf('primary');let kind='primary';if(pos<0){pos=t.indexOf('unique');kind='unique';}if(pos<0)return;
 const name=pos>=2&&t[pos-2]==='constraint'?t[pos-1]:null;
 let p=pos+(kind==='primary'?2:1),keys;
 if(column){keys=[{name:column,descendingKey:false}];}else {const [raw]=group(t,p);keys=list(raw);}
 index(table,name,keys,kind);
}
function column(table,t,conditional=false){
 const name=t[0],rawType=t[1],type=rawType==='rowversion'?'timestamp':rawType;
 assert.match(name,/^[a-z_][a-z_0-9]*$/);assert.ok(['bigint','int','tinyint','bit','nvarchar','varchar','char','binary','varbinary','decimal','datetime2','date','uniqueidentifier','timestamp'].includes(type),`UNKNOWN_TYPE:${table}.${name}:${type}`);
 let args=[],p=2;if(t[p]==='('){[args,p]=group(t,p);args=args.filter(x=>x!==',').map(x=>x==='max'?-1:Number(x));}
 const identity=t.includes('identity'),seedPos=t.indexOf('identity'),identityArgs=identity&&t[seedPos+1]==='('?group(t,seedPos+1)[0].filter(x=>x!==','):['1','1'];
 const nullable=!t.some((v,i)=>v==='not'&&t[i+1]==='null')&&!t.includes('primary');
 assert.ok(t.includes('null')||t.includes('primary'),`NULLABILITY_UNSPECIFIED:${table}.${name}`);
 const result={table,name,type,args,nullable,identity,identitySeed:identity?identityArgs[0]:null,identityIncrement:identity?identityArgs[1]:null};
 const columns=tables.get(table);assert.ok(columns,'MISSING_PARENT:'+table);
 if(columns.has(name)){assert.ok(conditional,'UNCONDITIONAL_DUPLICATE:'+table+'.'+name);assert.deepEqual(result,columns.get(name));conditionalDuplicates.push(table+'.'+name);return;}
 columns.set(name,result);constraints(table,t,name);
}
for(const batch of source.batches){
 const t=tokens(batch.sql);
 for(let p=0;p<t.length;p++){
  if(t[p]==='create'&&t[p+1]==='table'){
   const table=tableName(t,p+2);assert.ok(!tables.has(table),'DUPLICATE_TABLE');tables.set(table,new Map());
   const [body,end]=group(t,p+5);for(const segment of split(body)){if(segment[0]==='constraint')constraints(table,segment);else column(table,segment);}p=end-1;
  }else if(t[p]==='alter'&&t[p+1]==='table'){
   const table=tableName(t,p+2);let a=p+5;if(t[a]==='with'){assert.equal(t[a+1],'check');a+=2;}
   const end=t.indexOf(';',a);assert.ok(end>a);const action=t[a],body=t.slice(a+1,end);
   if(action==='add'){if(body[0]==='constraint')constraints(table,body);else for(const s of split(body))column(table,s,/IF COL_LENGTH/i.test(batch.sql));}
   else {assert.equal(action,'drop');assert.equal(body[0],'constraint');assert.match(body[1],/^ck_/);assert.ok(checks.delete(table+'.'+body[1]),'MISSING_DROPPED_CHECK');}
   p=end;
  }else if(t[p]==='create'&&(t[p+1]==='index'||t[p+1]==='unique'&&t[p+2]==='index')){
   const unique=t[p+1]==='unique',n=p+(unique?3:2),name=t[n];assert.equal(t[n+1],'on');const table=tableName(t,n+2),[raw,end]=group(t,n+5);
   let a=end,included=[],filterDefinition=null;if(t[a]==='include'){const [inc,next]=group(t,a+1);included=list(inc).map(x=>x.name);a=next;}
   if(t[a]==='where'){const e=t.indexOf(';',a);assert.ok(e>a);filterDefinition=t.slice(a+1,e).join(' ');a=e;}
   assert.equal(t[a],';');index(table,name,list(raw),unique?'explicitUnique':'index',{included,filterDefinition});p=a;
  }
 }
}
assert.equal(tables.size,36);assert.equal(foreignKeys.length,47);assert.equal(indexes.length,83);assert.equal(checks.size,30);
const expected={tables:[...tables.keys()].sort(),columns:[...tables.values()].flatMap(m=>[...m.values()]),foreignKeys,indexes,checks:[...checks.values()],conditionalDuplicates};
// The target uses Turkish_CI_AS identifiers. Constraint/index case is preserved
// in the raw observation; compare their case-insensitive catalog identity.
const actual=structuredClone(observed.metadata),diffs=[];
for(const a of actual.foreignKeys)a.name=a.name.toLowerCase();
for(const a of actual.indexes){
 const options=indexOptions.metadata.indexOptions.filter(o=>o.table===a.table&&o.name===a.name);assert.equal(options.length,1);a.ignoreDupKey=options[0].ignoreDupKey;
 if(mutation==='index-ignore-dup-key'&&a.table==='products'&&a.primaryKey)a.ignoreDupKey=true;
 a.name=a.name.toLowerCase();
 // SQL scalar FOR JSON yields NULL for an empty included-column subquery.
 if(a.included===null)a.included=[];
 assert.ok(Array.isArray(a.included));
 a.keys=a.keys.map((k,i)=>{assert.equal(k.ordinal,i+1);return {name:k.name,descendingKey:k.descendingKey};});
}
function check(label,a,b){try{assert.deepEqual(a,b);}catch{diffs.push({label,expected:a,actual:b});}}
check('table set',expected.tables,actual.tables.map(t=>{assert.equal(t.schema,'dbo');return t.name;}).sort());
check('column count',expected.columns.length,actual.columns.length);
const colActual=new Map(actual.columns.map(c=>[c.table+'.'+c.name,c]));
for(const c of expected.columns){
 const key=c.table+'.'+c.name,a=colActual.get(key);if(!a){diffs.push({label:'missing column '+key});continue;}
 const shape={type:a.type,nullable:a.nullable,identity:a.identity,identitySeed:a.identitySeed,identityIncrement:a.identityIncrement};
 check('column '+key, Object.fromEntries(Object.keys(shape).map(k=>[k,c[k]])),shape);
 check('column flags '+key,[false,false],[a.computed,a.sparse]);
 if(['nvarchar','varchar','char','binary','varbinary'].includes(c.type))check('length '+key,c.args[0]===-1?-1:c.args[0]*(c.type==='nvarchar'?2:1),a.maxLength);
 else if(c.type==='decimal')check('decimal '+key,c.args,[a.precision,a.scale]);
 else if(c.type==='datetime2')check('datetime scale '+key,c.args[0]??7,a.scale);
 else check('fixed length '+key,({bigint:8,int:4,tinyint:1,bit:1,date:3,uniqueidentifier:16,timestamp:8})[c.type],a.maxLength);
}
check('FK count',foreignKeys.length,actual.foreignKeys.length);
for(const e of foreignKeys){const a=actual.foreignKeys.find(a=>a.table===e.table&&a.name===e.name);if(!a){diffs.push({label:'missing FK '+e.name});continue;}check('FK '+e.name,e,Object.fromEntries(Object.keys(e).map(k=>[k,a[k]])));check('FK flags '+e.name,[false,false,false],[a.disabled,a.untrusted,a.notForReplication]);}
function filter(s){if(s==null)return null;return tokens(s).filter(x=>!['(',')'].includes(x)).join(' ');}
check('index count',indexes.length,actual.indexes.length);
const matched=new Set();
for(const e of indexes){
 const candidates=actual.indexes.filter((a,i)=>!matched.has(i)&&a.table===e.table&&(e.name?a.name===e.name:a.primaryKey===e.primaryKey&&a.uniqueConstraint===e.uniqueConstraint&&JSON.stringify(a.keys)===JSON.stringify(e.keys)));
 if(candidates.length!==1){diffs.push({label:'index match '+e.table+'.'+e.name,count:candidates.length});continue;}
 const a=candidates[0];matched.add(actual.indexes.indexOf(a));
 for(const key of ['keys','unique','primaryKey','uniqueConstraint','type'])check('index '+(e.name??e.table)+' '+key,e[key],a[key]);
 check('index included '+e.name,[...e.included].sort(),a.included.map(v=>v.name).sort());check('index filter '+e.name,filter(e.filterDefinition),filter(a.filterDefinition));check('index flags '+e.name,[false,false,false],[a.disabled,a.hypothetical,a.ignoreDupKey]);
}
check('CHECK names/parents',expected.checks.map(c=>c.table+'.'+c.name).sort(),actual.checks.map(c=>c.table+'.'+c.name.toLowerCase()).sort());
for(const a of actual.checks)check('CHECK status '+a.name,[false,false],[a.disabled,a.untrusted]);
const result={state:diffs.length?'K02_SCHEMA_DIFFERENCES':'K02_PACKAGE_SCHEMA_MATCH',sourceHead:source.sourceHead,sourceInventorySha256:hash(expected),sourceDdlRecordSha256:hash(source),installedSourceHashesVerified:source.installedSourceHashesVerified,installedManifestBytesSha256:source.installedManifestBytesSha256,observationSha256:hash(observed),indexOptionsObjectSha256:'09e904b4815922ff329b0c18e75e9c478ef89bb1e6d3b4930720b36378496f55',target:observed.target,capturedAt:observed.capturedAt,comparedAt:new Date().toISOString(),scope:'All user tables; exact column set/type/size/decimal scale/nullability/identity; all FK mappings/actions/trust; all PK/UQ/explicit index keys/includes/filter/type and disabled/hypothetical/IGNORE_DUP_KEY flags; CHECK name/parent set and enabled/trusted status. No default/CHECK-expression semantic equality claim.',counts:{tables:tables.size,columns:expected.columns.length,foreignKeys:foreignKeys.length,indexes:indexes.length,checks:actual.checks.length},conditionalDuplicates,diffs,sqlExecuted:false,installedMetadataReadOnly:true};
if(mutation){assert.ok(diffs.length>0,'MUTATION_FALSE_PASS');console.log(JSON.stringify({mutation,rejected:true,differenceCount:diffs.length,sqlExecuted:false}));}
else {
 if(!verifyOnly)writeFileSync(new URL('k02-02-expected-schema.json',base),JSON.stringify(expected,null,2));
 if(!verifyOnly)writeFileSync(new URL('k02-02-schema-comparison.json',base),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));if(diffs.length)process.exitCode=1;
}
