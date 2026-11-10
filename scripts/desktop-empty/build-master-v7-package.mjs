// Passive source/artifact packaging only. No SQL, credentials or installation.
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT} from '../../apps/api/src/services/desktopFinalCancellationExportFence.mjs';
import {EMPTY_V7_PROFILE_ID,EMPTY_V7_PUBLIC_PATH,EMPTY_V7_PUBLIC_BINDING_TEXT} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';

const empty=process.argv[2]==='--prepare-empty-db9-candidate-only';
const buildRoot=empty?path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..').replaceAll('\\','/'):'C:/Users/Xaser/Desktop/ERP/kaynak-finans';
const root='C:/Users/Xaser/Desktop/ERP/'+(empty?'runtime-clean-v7':'kaynak-r1');
if(process.argv.length!==3||!['--prepare-candidate-only','--prepare-empty-db9-candidate-only'].includes(process.argv[2])||path.resolve(fileURLToPath(import.meta.url))!==path.resolve(buildRoot+'/scripts/desktop-empty/build-master-v7-package.mjs'))throw Error('MASTER_V7_PACKAGE_SOURCE');
let sourceHead;
if(empty){
 const git=args=>execFileSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',buildRoot,...args],{encoding:'utf8',windowsHide:true}).trim();
 if(!buildRoot.toLowerCase().startsWith('c:/sirket/erp/melisa-erp-v2/.git/codex-worktrees/')||git(['remote','get-url','origin'])!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'||git(['status','--porcelain']).length)throw Error('MASTER_V7_PACKAGE_REVIEWED_SOURCE_REQUIRED');
 sourceHead=git(['rev-parse','HEAD']);if(!/^[a-f0-9]{40}$/.test(sourceHead))throw Error('MASTER_V7_PACKAGE_HEAD');
}
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
for(const name of ['start-master-v7-worker.mjs','verify-master-v7-profile.mjs','master-v7-plan.mjs','build-master-v7-package.mjs',...(empty?[]:['verify-master-v7-writer.mjs'])])visit('scripts/desktop-empty/'+name);
if(empty)for(const name of ['empty-v7-setup-local.mjs','empty-v7-setup-core.mjs'])visit('scripts/desktop-empty/'+name);
// The native catalog compiler reads these pinned files as source text, not as
// imports. Keep this finite data closure alongside the executable import graph.
if(empty)for(const rel of ['apps/api/scripts/vega-native-migration-store.mjs','scripts/canonical/fixtures/night-20261006-before.json']){regular(buildRoot+'/'+rel);sources[rel]=hashFile(buildRoot+'/'+rel);}
for(const name of ['start-master-v7.ps1',...(empty?[]:['read-first-sale-operator.ps1'])]){const rel='scripts/desktop-empty/'+name;regular(buildRoot+'/'+rel);helpers[rel]=hashFile(buildRoot+'/'+rel);}
if(empty){const rel='scripts/desktop-empty/empty-v7-setup-window.ps1';regular(buildRoot+'/'+rel);helpers[rel]=hashFile(buildRoot+'/'+rel);}
const web=buildRoot+'/apps/sites-workflow/dist-desktop-write-green';
regular(web+'/desktop-write-green.html');const html=readFileSync(web+'/desktop-write-green.html','utf8');
const js=[...html.matchAll(/src="\/([^" ]+\.js)"/g)].map(m=>m[1]),css=[...html.matchAll(/href="\/([^" ]+\.css)"/g)].map(m=>m[1]);
if(js.length!==1||css.length!==1||![...js,...css].every(n=>/^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(n)))throw Error('MASTER_V7_PACKAGE_ASSETS');
for(const name of ['desktop-write-green.html',...js,...css]){regular(web+'/'+name);assets[name]=hashFile(web+'/'+name);}
const publicFiles=empty?{[EMPTY_V7_PUBLIC_PATH]:hashBytes(EMPTY_V7_PUBLIC_BINDING_TEXT)}:{'kurulum/master-v5-export-journal/desktop-target.json':hashBytes(DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT)};
const tree=inspectDesktopRuntimeTree();
if(tree.sha256!=='8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'||tree.entryCount!==11623)throw Error('MASTER_V7_PACKAGE_DEPENDENCIES');
const pkg={profile:'desktop-master-v7',sourceRoot:root,createdAt:new Date().toISOString(),sources,helpers,assets,publicFiles,dependencySha256:tree.sha256};
if(empty){pkg.targetProfile=EMPTY_V7_PROFILE_ID;pkg.sourceHead=sourceHead;}
const bytes=Buffer.from(JSON.stringify(pkg,null,2)+'\n');const digest=hashBytes(bytes),dir='C:/Users/Xaser/Desktop/ERP/kurulum/master-v7-packages';
mkdirSync(dir,{recursive:true});
const archive=dir+'/'+digest+'.json';
if(existsSync(archive)){if(hashFile(archive)!==digest)throw Error('MASTER_V7_PACKAGE_ARCHIVE');}else writeFileSync(archive,bytes,{flag:'wx'});
// Keep the active V6 manifest intact; install is a separate reviewed operation.
const candidate='C:/Users/Xaser/Desktop/ERP/kurulum/'+(empty?'master-v7-empty-db9-candidate-package.'+sourceHead+'.json':'master-v7-finance-candidate-package.json');
writeFileSync(candidate,bytes,{flag:'wx'});
process.stdout.write(JSON.stringify({profile:pkg.profile,packageSha256:digest,sources:Object.keys(sources).length,helpers:Object.keys(helpers).length,assets:Object.keys(assets).length}));
