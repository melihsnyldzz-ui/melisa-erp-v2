// Source packaging only; no connection or runtime modification.
import {createHash} from 'node:crypto';import {readFileSync,readdirSync,lstatSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';import path from 'node:path';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {compileMasterV3Snapshot} from './master-v3-transition.mjs';

const root='C:/Users/Xaser/Desktop/ERP/kaynak-v3',sources={},assets={};const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
function walk(dir){for(const e of readdirSync(root+'/'+dir,{withFileTypes:true})){const rel=dir+'/'+e.name,st=lstatSync(root+'/'+rel);if(st.isSymbolicLink())throw Error('SYMLINK');if(st.isDirectory())walk(rel);else if(/\.(mjs|js|sql)$/.test(rel)&&!rel.includes('.test.'))sources[rel]=hash(root+'/'+rel);}}
walk('infra/sql/migrations');
// Every literal repository-relative runtime import must resolve to a pinned
// source, including dynamic import() chains. Bare dependencies use the exact
// independently digested node_modules tree. Filesystem SQL inputs are above.
function visit(name){
 if(Object.hasOwn(sources,name))return;
 if(name.startsWith('apps/api/node_modules/'))return; // covered by exact dependency digest
 if(!/^(apps\/api\/|scripts\/|packages\/shared\/)[A-Za-z0-9_./-]+\.(mjs|js)$/.test(name)||name.split('/').includes('..')||lstatSync(root+'/'+name).isSymbolicLink())throw Error('UNPINNED_SOURCE '+name);
 sources[name]=hash(root+'/'+name);
 const content=readFileSync(root+'/'+name,'utf8');
 for(const match of content.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
  visit(target);
 }
}
for(const seed of ['scripts/desktop-empty/start-master-v3-worker.mjs','scripts/desktop-empty/master-v3-transition.mjs','scripts/desktop-empty/build-master-v3-package.mjs','scripts/desktop-empty/verify-master-v3-writer.mjs'])visit(seed);
const web=root+'/apps/sites-workflow/dist-desktop-write-green';const html=readFileSync(web+'/desktop-write-green.html','utf8');const js=[...html.matchAll(/src="\/([^" ]+\.js)"/g)].map(x=>x[1]);if(js.length!==1||!/^assets\/[A-Za-z0-9_-]+\.js$/.test(js[0]))throw Error('ASSETS');for(const n of ['desktop-write-green.html',...js])assets[n]=hash(web+'/'+n);
const helpers={};for(const f of ['scripts/desktop-empty/start-master-v3.ps1','scripts/desktop-empty/stop-master-v3-runtime.ps1','scripts/desktop-empty/readmit-master-v3-runtime.ps1','scripts/desktop-empty/master-v3-runner-common.ps1','scripts/desktop-empty/read-first-sale-operator.ps1'])helpers[f]=hash(root+'/'+f);
const pkg={profile:'desktop-master-v3',sourceRoot:root,createdAt:new Date().toISOString(),sources,helpers,assets,snapshotSqlSha256:compileMasterV3Snapshot().sha256,dependencySha256:inspectDesktopRuntimeTree().sha256};
const file='C:/Users/Xaser/Desktop/ERP/kurulum/master-v3-package.json',archive='C:/Users/Xaser/Desktop/ERP/kurulum/master-v3-packages';mkdirSync(archive,{recursive:true});
function retain(bytes){const digest=createHash('sha256').update(bytes).digest('hex'),f=archive+'/'+digest+'.json';if(existsSync(f)){if(hash(f)!==digest)throw Error('PACKAGE_ARCHIVE_DRIFT');}else writeFileSync(f,bytes,{flag:'wx'});}
if(existsSync(file))retain(readFileSync(file));const bytes=Buffer.from(JSON.stringify(pkg,null,2)+'\n');retain(bytes);writeFileSync(file,bytes);process.stdout.write(JSON.stringify({packageSha256:hash(file),sources:Object.keys(sources).length,assets:Object.keys(assets).length}));
