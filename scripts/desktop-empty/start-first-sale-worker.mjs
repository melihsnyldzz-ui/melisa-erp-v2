// Parent holds the shared desktop runtime lock and stdin for process lifetime.
// No secrets in argv, environment, output or disk plaintext.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveReaderSecret} from './start-initial-green-worker.mjs';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
import {openDesktopWriteTlsConnector,closeDesktopWriteTlsConnector} from '../../apps/api/src/config/desktopWriteTlsConnector.mjs';
import {registerDesktopWriteRuntime} from '../../apps/api/src/config/desktopWriteRuntime.mjs';
import {startFirstSaleWeb} from './first-sale-web.mjs';
for(const name of ['log','info','warn','error','debug'])console[name]=()=>{};
const input=receiveReaderSecret(process.stdin);let secret,connector,runtime,api,web;
const fatal=()=>{process.stderr.write('FIRST_SALE_START_FAILED\n');process.exit(1);};process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
try{
 secret=await input.input;
 const pkg=JSON.parse(await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/first-sale-package.json','utf8'));
 if(pkg.profile!=='desktop-first-sale-v1'||pkg.dependencySha256!==inspectDesktopRuntimeTree().sha256)throw Error();
 for(const [name,hash] of Object.entries(pkg.sources)){if(!/^(apps\/api\/|scripts\/|packages\/shared\/|infra\/sql\/migrations\/)[A-Za-z0-9_./-]+\.(mjs|js|sql)$/.test(name)||name.split('/').some(p=>p==='..'))throw Error();if(createHash('sha256').update(await readFile('C:/Users/Xaser/Desktop/ERP/kaynak/'+name)).digest('hex')!==hash)throw Error();}
 const pem=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/MELISAERP-sql-public.pem','utf8');
 connector=await openDesktopWriteTlsConnector({password:secret.toString('ascii'),publicCertificatePem:pem});secret.fill(0);secret=null;
 registerDesktopWriteRuntime(connector);
 const {default:sql}=await import('../../apps/api/node_modules/mssql/index.js');const Request=sql.Request;
 await import('../../apps/api/src/services/invoiceDraftService.js');if(sql.Request!==Request)throw Error('DRIVER_CHANGED');
 const {createDesktopWriteApplication}=await import('../../apps/api/src/desktopWriteApplication.mjs');runtime=createDesktopWriteApplication({connector});
 api=await new Promise((resolve,reject)=>{const s=runtime.app.listen(4294,'127.0.0.1',()=>resolve(s));s.once('error',reject);});web=await startFirstSaleWeb(pkg.assets);
 if(input.isClosed())throw Error();process.stdout.write('DESKTOP_FIRST_SALE_READY\n');await input.done;
}catch{process.stderr.write('FIRST_SALE_START_FAILED\n');process.exitCode=1;}
finally{secret?.fill(0);try{if(web)await web.close();if(api)await new Promise(resolve=>api.close(resolve));runtime?.closeSessions();if(connector)await closeDesktopWriteTlsConnector(connector);}catch{process.stderr.write('FIRST_SALE_CLOSE_FAILED\n');process.exitCode=1;}}
