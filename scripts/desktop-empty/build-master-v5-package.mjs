// Source packaging only; no connection or runtime modification.
import {createHash} from 'node:crypto';import {readFileSync,readdirSync,lstatSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';import path from 'node:path';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {compileMasterV5Snapshot} from './master-v5-transition.mjs';
import {DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT} from '../../apps/api/src/services/desktopFinalCancellationExportFence.mjs';

const root='C:/Users/Xaser/Desktop/ERP/kaynak-r1',buildRoot=process.argv.length===3&&process.argv[2]==='--prepare-only'?'C:/Users/Xaser/Desktop/ERP/kaynak-birimler':root,sources={},assets={};if(process.argv.length>2&&!(process.argv.length===3&&process.argv[2]==='--prepare-only'))throw Error('MASTER_V5_PACKAGE_ARGUMENTS');const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const retiredSource='kaynak-'+'v3';
function assertCurrentSource(text){if(text.includes(retiredSource))throw Error('RETIRED_DESKTOP_SOURCE_PATH');}
function walk(dir){for(const e of readdirSync(buildRoot+'/'+dir,{withFileTypes:true})){const rel=dir+'/'+e.name,st=lstatSync(buildRoot+'/'+rel);if(st.isSymbolicLink())throw Error('SYMLINK');if(st.isDirectory())walk(rel);else if(/\.(mjs|js|sql)$/.test(rel)&&!rel.includes('.test.'))sources[rel]=hash(buildRoot+'/'+rel);}}
walk('infra/sql/migrations');
// Every literal repository-relative runtime import must resolve to a pinned
// source, including dynamic import() chains. Bare dependencies use the exact
// independently digested node_modules tree. Filesystem SQL inputs are above.
function visit(name){
 if(Object.hasOwn(sources,name))return;
 if(name.startsWith('apps/api/node_modules/'))return; // covered by exact dependency digest
 if(!/^(apps\/api\/|scripts\/|packages\/shared\/)[A-Za-z0-9_./-]+\.(mjs|js)$/.test(name)||name.split('/').includes('..')||lstatSync(buildRoot+'/'+name).isSymbolicLink())throw Error('UNPINNED_SOURCE '+name);
 sources[name]=hash(buildRoot+'/'+name);
 const content=readFileSync(buildRoot+'/'+name,'utf8');
 assertCurrentSource(content);
 for(const match of content.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
  visit(target);
 }
}
for(const seed of ['scripts/desktop-empty/start-master-v5-worker.mjs','scripts/desktop-empty/master-v5-transition.mjs','scripts/desktop-empty/build-master-v5-package.mjs','scripts/desktop-empty/verify-master-v5-writer.mjs','scripts/desktop-empty/prepare-master-v5-export-journal.mjs','scripts/desktop-empty/prepare-master-v5-plan.mjs','scripts/desktop-empty/verify-master-v5-transition.mjs','scripts/desktop-empty/assert-master-v5-plan.mjs'])visit(seed);
const web=buildRoot+'/apps/sites-workflow/dist-desktop-write-green';const html=readFileSync(web+'/desktop-write-green.html','utf8');
const js=[...html.matchAll(/src="\/([^" ]+\.js)"/g)].map(x=>x[1]),css=[...html.matchAll(/href="\/([^" ]+\.css)"/g)].map(x=>x[1]);
if(js.length!==1||!/^assets\/[A-Za-z0-9_-]+\.js$/.test(js[0])||css.length>1||css.some(n=>!/^assets\/[A-Za-z0-9_-]+\.css$/.test(n)))throw Error('ASSETS');
for(const n of ['desktop-write-green.html',...js,...css])assets[n]=hash(web+'/'+n);
const helpers={};for(const f of ['scripts/desktop-empty/start-master-v5.ps1','scripts/desktop-empty/stop-master-v5-runtime.ps1','scripts/desktop-empty/readmit-master-v5-runtime.ps1','scripts/desktop-empty/master-v3-runner-common.ps1','scripts/desktop-empty/read-first-sale-operator.ps1','scripts/desktop-empty/invoke-master-v5-sql.ps1']){assertCurrentSource(readFileSync(buildRoot+'/'+f,'utf8'));helpers[f]=hash(buildRoot+'/'+f);}
const publicFiles={'kurulum/master-v5-export-journal/desktop-target.json':createHash('sha256').update(DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT).digest('hex')};
const pkg={publicFiles,profile:'desktop-master-v5',sourceRoot:root,createdAt:new Date().toISOString(),sources,helpers,assets,snapshotSqlSha256:compileMasterV5Snapshot().sha256,dependencySha256:inspectDesktopRuntimeTree().sha256};
const file='C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-package.json',archive='C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-packages';mkdirSync(archive,{recursive:true});
function retain(bytes){const digest=createHash('sha256').update(bytes).digest('hex'),f=archive+'/'+digest+'.json';if(existsSync(f)){if(hash(f)!==digest)throw Error('PACKAGE_ARCHIVE_DRIFT');}else writeFileSync(f,bytes,{flag:'wx'});}
if(existsSync(file))retain(readFileSync(file));const bytes=Buffer.from(JSON.stringify(pkg,null,2)+'\n');retain(bytes);writeFileSync(file,bytes);process.stdout.write(JSON.stringify({packageSha256:hash(file),sources:Object.keys(sources).length,assets:Object.keys(assets).length}));
