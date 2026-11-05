// Offline only: creates one new public plan or verifies it without changing files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compileEmptyLocalSchema,buildEmptyLocalReferenceSql} from './schema.mjs';

export const SOURCE_ROOT=String.raw`C:\Sirket\ERP\worktrees\erp-empty-local-20261105`;
export const TASK_ROOT=String.raw`C:\Users\Xaser\Documents\Codex\2026-11-05\task`;
export const INSTALL_ROOT=path.join(TASK_ROOT,'empty-local-20261105-94a8324f');
export const PLAN_PATH=path.join(INSTALL_ROOT,'plan.json');
const NODE_PATH=String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`;
const NODE_SHA256='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237';
const fail=code=>{throw Error(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function rejectLinks(candidate){
  const full=path.resolve(candidate),parsed=path.parse(full);
  let current=parsed.root;
  for(const part of full.slice(parsed.root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    if(!fs.existsSync(current))fail('EMPTY_LOCAL_PATH_MISSING');
    const s=fs.lstatSync(current);
    if(s.isSymbolicLink()||path.resolve(fs.realpathSync.native(current)).toLowerCase()!==current.toLowerCase())fail('EMPTY_LOCAL_REPARSE_REJECTED');
  }
  return full;
}
function files(relative){
  const absolute=path.join(SOURCE_ROOT,relative);
  const stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink())fail('EMPTY_LOCAL_SOURCE_LINK_REJECTED');
  if(stat.isFile())return [relative.replaceAll('\\','/')];
  if(!stat.isDirectory())fail('EMPTY_LOCAL_SOURCE_TYPE_REJECTED');
  return fs.readdirSync(absolute).sort().flatMap(name=>files(path.join(relative,name)));
}
function manifest(){
  // Includes built assets and installed runtime dependency bytes, including bcrypt's
  // native addon. No dependency or configuration is borrowed from an old install.
  const roots=['scripts','packages','apps/api/src','apps/api/canonical-test-listeners.mjs',
    'apps/api/package.json','apps/api/package-lock.json','apps/api/node_modules',
    'apps/web-admin/src','apps/web-admin/package.json',
    'apps/web-admin/package-lock.json','apps/web-admin/dist'];
  for(const root of roots)rejectLinks(path.join(SOURCE_ROOT,root));
  const all=[...new Set(roots.flatMap(files))].sort();
  if(!all.includes('apps/api/src/emptyLocalServer.mjs')||!all.includes('apps/api/node_modules/bcrypt/package.json')
    ||!all.includes('apps/api/node_modules/mssql/package.json')||!all.includes('apps/web-admin/dist/index.html'))fail('EMPTY_LOCAL_BUILD_REQUIRED');
  return all.map(relative=>({path:relative,sha256:sha(fs.readFileSync(path.join(SOURCE_ROOT,relative)))}));
}
export function buildPlan(createdAt){
  if(process.platform!=='win32')fail('EMPTY_LOCAL_WINDOWS_REQUIRED');
  if(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..').toLowerCase()!==SOURCE_ROOT.toLowerCase())fail('EMPTY_LOCAL_SOURCE_ROOT_REJECTED');
  rejectLinks(SOURCE_ROOT);rejectLinks(TASK_ROOT);rejectLinks(process.execPath);
  if(process.execPath.toLowerCase()!==NODE_PATH.toLowerCase()||sha(fs.readFileSync(process.execPath))!==NODE_SHA256)fail('EMPTY_LOCAL_NODE_REJECTED');
  for(const name of ['.env','.env.local'])if(fs.existsSync(path.join(SOURCE_ROOT,'apps/api',name)))fail('EMPTY_LOCAL_DOTENV_REJECTED');
  const schema=compileEmptyLocalSchema();
  const tables=[...new Set(schema.batches.flatMap(b=>[...b.sql.matchAll(/CREATE TABLE dbo\.([a-z_]+)\s*\(/g)].map(m=>m[1])))].sort();
  const referenceTables=new Set(['roles','permissions','users','audit_logs','empty_local_installation']);
  const businessTables=tables.filter(t=>!referenceTables.has(t));
  if(businessTables.length<10)fail('EMPTY_LOCAL_SCHEMA_PROOF_INCOMPLETE');
  return {formatVersion:1,profile:'empty-local-20261105',createdAt,
    sourceBaseline:'93aeccbcc1f136f7e4347c45f5c1ea4258e58dba',sourceRoot:SOURCE_ROOT,taskRoot:TASK_ROOT,installRoot:INSTALL_ROOT,
    server:'Semih\\MELISADEV',host:'127.0.0.1',sqlPort:1433,database:'MELISA_ERP_EMPTY_TEST_20261105',
    sqlLogin:'melisa_empty_test_read_20261105',environmentId:'94a8324f-124a-49e4-ad70-be3232989f47',
    schemaVersion:1,apiPort:4294,webPort:5294,actualT1:false,externalOperations:false,readOnly:true,
    appUsername:'kurulum',appRole:'empty_local_reader',apiEntry:'apps/api/src/emptyLocalServer.mjs',
    node:{path:process.execPath,sha256:sha(fs.readFileSync(process.execPath))},
    sources:manifest(),schema,referenceSql:buildEmptyLocalReferenceSql(),businessTables,
    emptyProofSql:'SELECT '+businessTables.map(t=>`(SELECT COUNT_BIG(*) FROM dbo.[${t}])`).join('+')+' AS businessRows;'};
}
export function verifyPlan(planPath=PLAN_PATH){
  if(path.resolve(planPath).toLowerCase()!==PLAN_PATH.toLowerCase())fail('EMPTY_LOCAL_PLAN_PATH_REJECTED');
  rejectLinks(planPath);
  const bytes=fs.readFileSync(planPath),plan=JSON.parse(bytes);
  if(typeof plan.createdAt!=='string'||!Number.isFinite(Date.parse(plan.createdAt)))fail('EMPTY_LOCAL_PLAN_TIME_REJECTED');
  if(JSON.stringify(plan)!==JSON.stringify(buildPlan(plan.createdAt)))fail('EMPTY_LOCAL_PLAN_SOURCE_MISMATCH');
  return {plan,sha256:sha(bytes)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length===4&&process.argv[2]==='--verify'){
      const {sha256}=verifyPlan(process.argv[3]);process.stdout.write(JSON.stringify({verified:true,sha256}));
    }else if(process.argv.length===2){
      const plan=buildPlan(new Date().toISOString());
      // mkdir without recursive is an atomic refusal to adopt an existing target.
      fs.mkdirSync(INSTALL_ROOT);rejectLinks(INSTALL_ROOT);
      fs.writeFileSync(PLAN_PATH,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
      process.stdout.write(JSON.stringify({prepared:true,planPath:PLAN_PATH,sha256:sha(fs.readFileSync(PLAN_PATH))}));
    }else fail('EMPTY_LOCAL_ARGUMENTS_REJECTED');
  }catch{process.stderr.write('EMPTY_LOCAL_PLAN_REJECTED\n');process.exitCode=1;}
}
