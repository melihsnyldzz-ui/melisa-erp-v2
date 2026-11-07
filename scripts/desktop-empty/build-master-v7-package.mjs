// Passive source/artifact packaging only. No SQL, credentials or installation.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT} from '../../apps/api/src/services/desktopFinalCancellationExportFence.mjs';

const buildRoot='C:/Users/Xaser/Desktop/ERP/kaynak-finans';
const root='C:/Users/Xaser/Desktop/ERP/kaynak-r1';
if(process.argv.length!==3||process.argv[2]!=='--prepare-candidate-only'||path.resolve(fileURLToPath(import.meta.url))!==path.resolve(buildRoot+'/scripts/desktop-empty/build-master-v7-package.mjs'))throw Error('MASTER_V7_PACKAGE_SOURCE');
const sources={},helpers={},assets={};
const hashBytes=b=>createHash('sha256').update(b).digest('hex');
const hashFile=f=>hashBytes(readFileSync(f));
function regular(file){const st=lstatSync(file);if(!st.isFile()||st.isSymbolicLink())throw Error('MASTER_V7_PACKAGE_PATH');}
function walk(dir){for(const e of readdirSync(buildRoot+'/'+dir,{withFileTypes:true})){const rel=dir+'/'+e.name,st=lstatSync(buildRoot+'/'+rel);if(st.isSymbolicLink())throw Error('MASTER_V7_PACKAGE_PATH');if(st.isDirectory())walk(rel);else if(/\.(mjs|js|sql)$/.test(rel)&&!rel.includes('.test.'))sources[rel]=hashFile(buildRoot+'/'+rel);}}
walk('infra/sql/migrations');
function visit(name){
 if(Object.hasOwn(sources,name)||name.startsWith('apps/api/node_modules/'))return;
 if(!/^(apps\/api\/|scripts\/|packages\/shared\/)[A-Za-z0-9_./-]+\.(mjs|js)$/.test(name)||name.split('/').includes('..'))throw Error('MASTER_V7_PACKAGE_IMPORT');
 regular(buildRoot+'/'+name);sources[name]=hashFile(buildRoot+'/'+name);
 const text=readFileSync(buildRoot+'/'+name,'utf8');
 for(const m of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g))visit(path.posix.normalize(path.posix.join(path.posix.dirname(name),m[1])));
}
for(const name of ['start-master-v7-worker.mjs','verify-master-v7-writer.mjs','master-v7-plan.mjs','build-master-v7-package.mjs'])visit('scripts/desktop-empty/'+name);
for(const name of ['start-master-v7.ps1','read-first-sale-operator.ps1']){const rel='scripts/desktop-empty/'+name;regular(buildRoot+'/'+rel);helpers[rel]=hashFile(buildRoot+'/'+rel);}
const web=buildRoot+'/apps/sites-workflow/dist-desktop-write-green';
regular(web+'/desktop-write-green.html');const html=readFileSync(web+'/desktop-write-green.html','utf8');
const js=[...html.matchAll(/src="\/([^" ]+\.js)"/g)].map(m=>m[1]),css=[...html.matchAll(/href="\/([^" ]+\.css)"/g)].map(m=>m[1]);
if(js.length!==1||css.length!==1||![...js,...css].every(n=>/^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(n)))throw Error('MASTER_V7_PACKAGE_ASSETS');
for(const name of ['desktop-write-green.html',...js,...css]){regular(web+'/'+name);assets[name]=hashFile(web+'/'+name);}
const publicFiles={'kurulum/master-v5-export-journal/desktop-target.json':hashBytes(DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT)};
const tree=inspectDesktopRuntimeTree();
if(tree.sha256!=='8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'||tree.entryCount!==11623)throw Error('MASTER_V7_PACKAGE_DEPENDENCIES');
const pkg={profile:'desktop-master-v7',sourceRoot:root,createdAt:new Date().toISOString(),sources,helpers,assets,publicFiles,dependencySha256:tree.sha256};
const bytes=Buffer.from(JSON.stringify(pkg,null,2)+'\n');const digest=hashBytes(bytes),dir='C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-packages';
mkdirSync(dir,{recursive:true});
const archive=dir+'/'+digest+'.json';
if(existsSync(archive)){if(hashFile(archive)!==digest)throw Error('MASTER_V7_PACKAGE_ARCHIVE');}else writeFileSync(archive,bytes,{flag:'wx'});
// Keep the active V6 manifest intact; install is a separate reviewed operation.
const candidate='C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-finance-candidate-package.json';
writeFileSync(candidate,bytes,{flag:'wx'});
process.stdout.write(JSON.stringify({profile:pkg.profile,packageSha256:digest,sources:Object.keys(sources).length,helpers:Object.keys(helpers).length,assets:Object.keys(assets).length}));
