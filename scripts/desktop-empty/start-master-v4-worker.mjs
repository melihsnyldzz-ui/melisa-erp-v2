// Fixed Desktop TEST process. The owning parent retains the private SQL pipe.
import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveReaderSecret} from './start-initial-green-worker.mjs';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {desktopRuntimeInfo} from '../../packages/shared/src/desktopRuntimeInfo.mjs';
const root='C:/Users/Xaser/Desktop/ERP/kaynak-r1',manifest='C:/Users/Xaser/Desktop/ERP/kurulum/master-v4-package.json';
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const name of ['log','info','warn','error','debug'])console[name]=()=>{};
const input=receiveReaderSecret(process.stdin);let secret,connector,runtime,api,web,closeConnector;
const fatal=()=>{secret?.fill(0);process.stderr.write('MASTER_V4_START_FAILED\n');process.exit(1);};
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
try{
 if(process.argv.length!==3||!/^[A-F0-9]{64}$/.test(process.argv[2]))throw Error();
 secret=await input.input;
 const bytes=await readFile(manifest);if(hash(bytes)!==process.argv[2].toLowerCase())throw Error();
 const pkg=JSON.parse(bytes);
 if(pkg.profile!=='desktop-master-v4'||pkg.sourceRoot!==root||pkg.dependencySha256!==inspectDesktopRuntimeTree().sha256
  ||(await realpath(root+'/apps/api/node_modules')).toLowerCase()!=='c:\\users\\xaser\\desktop\\erp\\kaynak\\apps\\api\\node_modules')throw Error();
 for(const [name,digest] of Object.entries(pkg.sources)){
  if(!/^(apps\/api\/|scripts\/|packages\/shared\/|infra\/sql\/migrations\/)[A-Za-z0-9_./-]+\.(mjs|js|sql)$/.test(name)||name.split('/').includes('..')||hash(await readFile(root+'/'+name))!==digest)throw Error();
 }
 const {openDesktopMasterV4TlsConnector,closeDesktopWriteTlsConnector}=await import('../../apps/api/src/config/desktopWriteTlsConnector.mjs');
 closeConnector=closeDesktopWriteTlsConnector;
 const pem=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/MELISAERP-sql-public.pem','utf8');
 connector=await openDesktopMasterV4TlsConnector({password:secret.toString('ascii'),publicCertificatePem:pem});secret.fill(0);secret=null;
 const {registerDesktopWriteRuntime}=await import('../../apps/api/src/config/desktopWriteRuntime.mjs');registerDesktopWriteRuntime(connector);
 const {default:sql}=await import('../../apps/api/node_modules/mssql/index.js');const Request=sql.Request;
 await import('../../apps/api/src/services/invoiceDraftService.js');if(sql.Request!==Request)throw Error();
 const {createDesktopWriteApplication}=await import('../../apps/api/src/desktopWriteApplication.mjs');runtime=createDesktopWriteApplication({connector,runtimeInfo:desktopRuntimeInfo({packageSha256:hash(bytes),createdAt:pkg.createdAt,schemaVersion:4})});
 if(runtime.profile!=='desktop-master-v4')throw Error();
 api=await new Promise((resolve,reject)=>{const s=runtime.app.listen(4294,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
 const {startMasterV3Web}=await import('./master-v3-web.mjs');web=await startMasterV3Web(pkg.assets);
 if(input.isClosed())throw Error();process.stdout.write('DESKTOP_MASTER_V4_READY\n');await input.done;
}catch{process.stderr.write('MASTER_V4_START_FAILED\n');process.exitCode=1;}
finally{
 secret?.fill(0);
 try{if(web)await web.close();if(api)await new Promise(resolve=>api.close(resolve));runtime?.closeSessions();if(connector)await closeConnector(connector);}
 catch{process.stderr.write('MASTER_V4_CLOSE_FAILED\n');process.exitCode=1;}
}
