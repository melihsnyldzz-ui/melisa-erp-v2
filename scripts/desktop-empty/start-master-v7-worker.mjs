// Fixed Desktop TEST process. The owning parent retains the private SQL pipe.
import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveReaderSecret} from './start-initial-green-worker.mjs';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {desktopRuntimeInfo} from '../../packages/shared/src/desktopRuntimeInfo.mjs';
import {readMasterV7Profile} from './master-v7-profile-binding.mjs';
import {fileURLToPath} from 'node:url';
const empty=process.argv[4]==='empty-db9-v7-v1';
const root='C:/Users/Xaser/Desktop/ERP/'+(empty?'runtime-clean-v7':'kaynak-r1'),manifest='C:/Users/Xaser/Desktop/ERP/kurulum/'+(empty?'empty-profile-db9-v1/runtime-package.json':'master-v7-package.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const name of ['log','info','warn','error','debug'])console[name]=()=>{};
let input,secret,connector,runtime,api,web,closeConnector,failed=false,phase='INITIALIZE';
const failures=Object.freeze({INITIALIZE:'MASTER_V7_START_FAILED:INITIALIZE\n',PUBLIC_PROFILE:'MASTER_V7_START_FAILED:PUBLIC_PROFILE\n',MANIFEST:'MASTER_V7_START_FAILED:MANIFEST\n',PUBLIC_BINDING:'MASTER_V7_START_FAILED:PUBLIC_BINDING\n',DEPENDENCIES:'MASTER_V7_START_FAILED:DEPENDENCIES\n',SOURCES:'MASTER_V7_START_FAILED:SOURCES\n',PUBLIC_CERTIFICATE:'MASTER_V7_START_FAILED:PUBLIC_CERTIFICATE\n',PRIVATE_INPUT:'MASTER_V7_START_FAILED:PRIVATE_INPUT\n',TLS:'MASTER_V7_START_FAILED:TLS\n',APPLICATION:'MASTER_V7_START_FAILED:APPLICATION\n',API_LISTEN:'MASTER_V7_START_FAILED:API_LISTEN\n',WEB_LISTEN:'MASTER_V7_START_FAILED:WEB_LISTEN\n',OWNER_PIPE:'MASTER_V7_START_FAILED:OWNER_PIPE\n'});
const fatal=()=>{secret?.fill(0);process.stderr.write(failures[phase]??failures.INITIALIZE);process.exit(1);};
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
try{
 input=receiveReaderSecret(process.stdin);input.input.then(value=>{secret=value;if(failed){value.fill(0);secret=null;}}).catch(()=>{});
 if(![3,4,5].includes(process.argv.length)||!/^[A-F0-9]{64}$/.test(process.argv[2])||(process.argv.length===5&&!empty)||fileURLToPath(import.meta.url).replaceAll('\\','/').toLowerCase()!==(root+'/scripts/desktop-empty/start-master-v7-worker.mjs').toLowerCase())throw Error();
 phase='PUBLIC_PROFILE';
 const profileBinding=readMasterV7Profile(process.argv[2],process.argv[3],empty?'empty-db9-v7-v1':null);
 phase='MANIFEST';
 const bytes=await readFile(manifest);if(hash(bytes)!==process.argv[2].toLowerCase())throw Error();
 const pkg=JSON.parse(bytes);
 const binding=profileBinding.publicPath;
 phase='PUBLIC_BINDING';if(!pkg.publicFiles||Object.keys(pkg.publicFiles).length!==1||hash(await readFile('C:/Users/Xaser/Desktop/ERP/'+binding))!==pkg.publicFiles[binding]||process.env.MELISA_INVOICE_EXPORT_JOURNAL!==profileBinding.exportDirectory.replaceAll('/','\\'))throw Error();
 phase='DEPENDENCIES';
 if(pkg.profile!=='desktop-master-v7'||pkg.sourceRoot!==root||pkg.dependencySha256!==inspectDesktopRuntimeTree().sha256
  ||(await realpath(root+'/apps/api/node_modules')).toLowerCase()!=='c:\\users\\xaser\\desktop\\erp\\kaynak\\apps\\api\\node_modules')throw Error();
 phase='SOURCES';
 for(const [name,digest] of Object.entries(pkg.sources)){
  if((!/^(apps\/api\/|scripts\/|packages\/shared\/|infra\/sql\/migrations\/)[A-Za-z0-9_./-]+\.(mjs|js|sql)$/.test(name)&&name!=='scripts/canonical/fixtures/night-20261006-before.json')||name.split('/').includes('..')||hash(await readFile(root+'/'+name))!==digest)throw Error();
 }
 const {openDesktopMasterV7TlsConnector,openDesktopEmptyV7TlsConnector,closeDesktopWriteTlsConnector}=await import('../../apps/api/src/config/desktopWriteTlsConnector.mjs');
 closeConnector=closeDesktopWriteTlsConnector;
 phase='PUBLIC_CERTIFICATE';const pem=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/MELISAERP-sql-public.pem','utf8');
 phase='PRIVATE_INPUT';secret=await input.input;
 phase='TLS';
 connector=profileBinding.targetProfile?await openDesktopEmptyV7TlsConnector({password:secret.toString('ascii'),publicCertificatePem:pem,profileBinding}):await openDesktopMasterV7TlsConnector({password:secret.toString('ascii'),publicCertificatePem:pem});secret.fill(0);secret=null;
 phase='APPLICATION';const {registerDesktopWriteRuntime}=await import('../../apps/api/src/config/desktopWriteRuntime.mjs');registerDesktopWriteRuntime(connector);
 const {default:sql}=await import('../../apps/api/node_modules/mssql/index.js');const Request=sql.Request;
 await import('../../apps/api/src/services/invoiceDraftService.js');if(sql.Request!==Request)throw Error();
 const {createDesktopWriteApplication}=await import('../../apps/api/src/desktopWriteApplication.mjs');runtime=createDesktopWriteApplication({connector,runtimeInfo:desktopRuntimeInfo({packageSha256:hash(bytes),createdAt:pkg.createdAt,schemaVersion:7,targetProfile:profileBinding.targetProfile})});
 if(runtime.profile!=='desktop-master-v7')throw Error();
 phase='API_LISTEN';api=await new Promise((resolve,reject)=>{const s=runtime.app.listen(4294,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
 phase='WEB_LISTEN';const {startMasterV3Web}=await import('./master-v3-web.mjs');web=await startMasterV3Web(pkg.assets,{targetProfile:profileBinding.targetProfile,runtimeRoot:root});
 phase='OWNER_PIPE';if(input.isClosed())throw Error();process.stdout.write('DESKTOP_MASTER_V7_READY\n');await input.done;
}catch{failed=true;process.stderr.write(failures[phase]??failures.INITIALIZE);process.exitCode=1;}
finally{
 secret?.fill(0);
 try{if(web)await web.close();if(api)await new Promise(resolve=>api.close(resolve));runtime?.closeSessions();if(connector)await closeConnector(connector);}
 catch{failed=true;process.stderr.write('MASTER_V7_CLOSE_FAILED\n');process.exitCode=1;}
 finally{if(failed)process.stdin.destroy(Error('INPUT_REJECTED'));}
}
