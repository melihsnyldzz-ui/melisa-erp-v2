// Offline, schema-only compiler diagnosis. Never an install/Rehearse authority.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex').toUpperCase();
const check=(ok,code)=>{if(!ok)throw Error(code);};
const identifier=s=>{check(typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(s),'B6_DIAG_IDENTIFIER');return '['+s+']';};
const literal=s=>"N'"+s.replaceAll("'","''")+"'";
export function capturedTableDDL(columns,indexes=[]){
 const tables=new Map();
 for(const c of columns){
  check(['dbo','erp_migration'].includes(c.schemaName)&&!c.is_computed,'B6_DIAG_COLUMN_SCOPE');
  identifier(c.schemaName);identifier(c.tableName);identifier(c.columnName);const key=c.schemaName+'.'+c.tableName;
  if(!tables.has(key))tables.set(key,[]);tables.get(key).push(c);
 }
 return [...tables].map(([qualifiedName,cols])=>{
  const [schema,name]=qualifiedName.split('.');
  const declarations=cols.sort((a,b)=>a.columnId-b.columnId).map(c=>{
   let type=c.typeName;
   check(/^(bigint|bit|char|date|datetime|datetime2|decimal|int|money|nchar|numeric|nvarchar|smallint|sysname|timestamp|tinyint|uniqueidentifier|varbinary|varchar|float|real)$/.test(type),'B6_DIAG_COLUMN_TYPE');
   if(/^(n?varchar|n?char|varbinary)$/.test(type)){
    check(Number.isInteger(c.max_length)&&(c.max_length===-1?/^(n?varchar|varbinary)$/.test(type):c.max_length>0&&c.max_length<=8000),'B6_DIAG_TYPE_LENGTH');
    check(c.max_length===-1||!type.startsWith('n')||c.max_length%2===0,'B6_DIAG_TYPE_LENGTH');
    type+='('+(c.max_length===-1?'max':c.max_length/(c.typeName.startsWith('n')?2:1))+')';
   }
   if(/^(decimal|numeric)$/.test(type)){
    check(Number.isInteger(c.precision)&&c.precision>=1&&c.precision<=38&&Number.isInteger(c.scale)&&c.scale>=0&&c.scale<=c.precision,'B6_DIAG_TYPE_PRECISION');
    type+='('+c.precision+','+c.scale+')';
   }
   if(type==='datetime2'){check(Number.isInteger(c.scale)&&c.scale>=0&&c.scale<=7,'B6_DIAG_TYPE_SCALE');type+='('+c.scale+')';}
   if(c.collation_name&&/^(n?varchar|n?char)/.test(type)){identifier(c.collation_name);type+=' COLLATE '+c.collation_name;}
   return identifier(c.columnName)+' '+type+(c.is_identity?' IDENTITY(1,1)':'')+(c.is_nullable?' NULL':' NOT NULL');
  });
  const unique=new Map();for(const i of indexes.filter(i=>i.tableName===name&&i.is_unique&&!i.is_included_column&&i.key_ordinal>0)){
   if(!unique.has(i.indexName))unique.set(i.indexName,[]);unique.get(i.indexName).push(i);
  }
  for(const [index,keys] of unique)declarations.push('CONSTRAINT '+identifier(index)+' UNIQUE ('+keys.sort((a,b)=>a.key_ordinal-b.key_ordinal).map(i=>identifier(i.columnName)).join(',')+')');
  return {name:qualifiedName,sql:'CREATE TABLE '+identifier(schema)+'.'+identifier(name)+'('+declarations.join(',')+');'};
 });
}
const prefix='SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);\n';
export function diagnosticCommand({id,sql,phase,index}){
 check(/^[A-Za-z0-9_.:-]{1,180}$/.test(id),'B6_DIAG_BATCH_ID');
 check(Number.isSafeInteger(index)&&index>=0,'B6_DIAG_BATCH_INDEX');
 check(['Schema','Baseline','ProductionGuardExpectedReject','ApplyCompile','InverseCompile'].includes(phase),'B6_DIAG_BATCH_PHASE');
 check(typeof sql==='string'&&sql.length>0,'B6_DIAG_SQL_REQUIRED');
 // Catch outside the exact dynamic command preserves provider line/procedure.
 // All outcomes are diagnostic; production target/CAS failures remain failures.
 const command=/^(ApplyCompile|InverseCompile|ProductionGuardExpectedReject)$/.test(phase)?prefix+sql:sql;
 // sqlcmd has a separate input-line parser. Reconstruct bounded UTF-16 chunks
 // so embedded source comments/newlines and large CAS lines arrive unchanged.
 const variable='@diag_'+phase+'_'+index,hex=Buffer.from(command,'utf16le').toString('hex');
 let transport=`DECLARE ${variable} nvarchar(max)=N'';\n`;
 for(let at=0;at<hex.length;at+=4000)transport+=`SET ${variable}+=CONVERT(nvarchar(max),0x${hex.slice(at,at+4000)});\n`;
 return transport+`BEGIN TRY EXEC sys.sp_executesql ${variable}; SELECT ${literal(JSON.stringify({phase,index,id,sha256:sha(sql),ok:true}))}; END TRY BEGIN CATCH SELECT (SELECT ${literal(phase)} AS phase,${index} AS [index],${literal(id)} AS id,${literal(sha(sql))} AS sha256,CAST(0 AS bit) AS ok,ERROR_NUMBER() AS number,ERROR_PROCEDURE() AS [procedure],ERROR_LINE() AS line FOR JSON PATH,WITHOUT_ARRAY_WRAPPER); END CATCH;\n`;
}
export function buildB6IsolatedDiagnostic({artifact,before,auxiliary,readers=[],sourceTables=[],dependencyMetadata={columnsJson:[]},databaseName='B6_DIAG_SYNTH_20261029'}){
 check(['B6_DIAG_SYNTH_20261029','B6_DIAG_SYNTH_RTM_20261029','B6_DIAG_SYNTH_RTM_TR_20261029'].includes(databaseName),'B6_DIAG_DATABASE');
 check(artifact.installable===false&&artifact.executeAllowed===false&&artifact.newModules.length===31&&artifact.changedModules.length===25,'B6_DIAG_ARTIFACT_SCOPE');
 for(const b of [...artifact.applyBatches,...artifact.inverseBatches])check(sha(b.sql)===b.sourceHash,'B6_DIAG_BATCH_HASH');
 const cols=[...dependencyMetadata.columnsJson,...before.columnsJson,...auxiliary.columnsJson];
 const seen=new Set();const columns=cols.filter(c=>{const k=c.schemaName+'.'+c.tableName+'.'+c.columnName;if(seen.has(k))return false;seen.add(k);return true;});
 const tables=capturedTableDDL(columns,before.indexesJson);
 const capturedNames=new Set(tables.map(t=>t.name));
 const schemaCommands=[...tables,...sourceTables.filter(t=>!capturedNames.has(t.name))];
 const originals=new Map();
 for(const m of [...before.modulesJson,...auxiliary.modulesJson,...readers])if(m.definition&&!originals.has('dbo.'+m.name))originals.set('dbo.'+m.name,m.definition);
 for(const m of artifact.changedModules)originals.set(m.name,m.originalDefinition);
 const commands=[];let index=0;
 for(const t of schemaCommands)commands.push({phase:'Schema',index:index++,id:t.name,sql:t.sql});
 index=0;for(const [id,sql]of originals)commands.push({phase:'Baseline',index:index++,id,sql});
 // Explicitly exercise the unmodified production admission: it must reject
 // this differently named database. Never change server/DB/hash guards.
 commands.push({phase:'ProductionGuardExpectedReject',index:0,...artifact.applyBatches[0]});
 const excluded=[];
 artifact.applyBatches.forEach((b,index)=>{
  // Scope rows contain private business values. No real profile rows enter
  // the synthetic DB. Permission/data/CAS execution is not a compile probe.
  if(!/^(probe-stored-header-policy|create-|immutable-|alter-)/.test(b.id)){excluded.push({index,id:b.id,sha256:b.sourceHash});return;}
  commands.push({phase:'ApplyCompile',index,...b});
 });
 const sql=`SET NOCOUNT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; IF DB_NAME()<>${literal(databaseName)} THROW 51917,'B6_DIAG_WRONG_TARGET',1; IF SCHEMA_ID(N'erp_migration') IS NULL EXEC(N'CREATE SCHEMA erp_migration');\n`+
  `SELECT (SELECT CONVERT(varchar(128),SERVERPROPERTY('ProductVersion')) productVersion,CONVERT(varchar(128),SERVERPROPERTY('Collation')) serverCollation,collation_name databaseCollation,compatibility_level compatibilityLevel FROM sys.databases WHERE database_id=DB_ID() FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);\n`+
  commands.map(diagnosticCommand).join('');
 return {sql,manifest:{kind:'DIAGNOSTIC_PARTIAL_NOT_REHEARSAL',databaseName,actualT1:false,productionAdmission:false,fullRehearse:false,realRowsCopied:0,commands:commands.map(({phase,index,id,sql})=>({phase,index,id,sha256:sha(sql)})),excluded}};
}
