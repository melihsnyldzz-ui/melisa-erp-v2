import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const TERMINAL_APK_PATH='C:\\Sirket\\ERP\\deliveries\\ERP-TERMINAL-20261011\\Melisa-Calisma-TEST-WiFi-v22.apk';
export const TERMINAL_APK_SHA256='4CBBDE0A389924CF25D4EEBB9FDB3692ACE15EDAE4219B348C8DF78027803BCF';
export const TERMINAL_APK_NAME='Melisa-Calisma-TEST-WiFi-v22.apk';
export function parseTerminalArtifactArgs(args=[]){
 const remaining=[],values={};
 for(let i=0;i<args.length;i++){
  const flag=args[i];
  if(!flag.startsWith('--terminal-apk')){remaining.push(flag);continue;}
  if(!['--terminal-apk-path','--terminal-apk-sha256'].includes(flag)||Object.hasOwn(values,flag)||!args[i+1]||args[i+1].startsWith('--'))throw Error('TERMINAL_ARTIFACT_ARGUMENTS_REJECTED');
  values[flag]=args[++i];
 }
 if(Object.keys(values).length===0)return {remaining,artifact:null};
 if(Object.keys(values).length!==2)throw Error('TERMINAL_ARTIFACT_ARGUMENTS_REJECTED');
 const file=values['--terminal-apk-path'],sha256=values['--terminal-apk-sha256'];
 if(!path.win32.isAbsolute(file)||path.win32.normalize(file).toLowerCase()!==TERMINAL_APK_PATH.toLowerCase()||sha256.toUpperCase()!==TERMINAL_APK_SHA256)throw Error('APPROVED_TERMINAL_ARTIFACT_REQUIRED');
 return {remaining,artifact:{file,sha256:TERMINAL_APK_SHA256}};
}
function assertNoLinks(file){
 let current=path.resolve(file);
 for(;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('TERMINAL_ARTIFACT_LINK_REJECTED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
}
export function verifiedTerminalBytes(file,sha256){
 assertNoLinks(file);if(!fs.lstatSync(file).isFile())throw Error('TERMINAL_ARTIFACT_FILE_REQUIRED');
 const bytes=fs.readFileSync(file);if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b||createHash('sha256').update(bytes).digest('hex').toUpperCase()!==sha256)throw Error('TERMINAL_ARTIFACT_HASH_REJECTED');return bytes;
}
export function terminalInstallHtml(){return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Melisa Çalışma kurulumu</title><style>body{margin:0;background:#edf7ef;color:#173e27;font:17px system-ui}main{max-width:620px;margin:5vh auto;padding:28px}a{display:inline-block;padding:16px 24px;border-radius:12px;background:#218548;color:white;text-decoration:none;font-weight:700}code{overflow-wrap:anywhere;font-size:12px}li{margin:12px 0}</style><main><h1>Melisa Çalışma</h1><p>Android · Wi-Fi TEST · Sürüm 22</p><a href="./downloads/${TERMINAL_APK_NAME}" download>Uygulamayı indir</a><ol><li>Telefonu veya terminali mağazanın Wi-Fi ağına bağlayın. ERP bilgisayarı açık ve Windows oturumu açılmış olmalıdır.</li><li>İndirilen APK dosyasını açın. Android isterse yalnız kullandığınız tarayıcı için uygulama yükleme iznini açın.</li><li>Melisa Çalışma uygulamasını açın. İlk kullanımda personel hesabınızla giriş yapın; sonraki kullanımda hatırlanan oturumla devam edin.</li></ol><p>Günlük kullanım Wi-Fi üzerindendir; USB bağlantısı gerekmez. Bu sürüm yalnız izole TEST sistemini kullanır.</p><p>İndirme doğrulaması · SHA-256</p><code>${TERMINAL_APK_SHA256}</code></main></html>`;}
export function attachTerminalArtifact({releaseRoot,target,artifact}){
 if(!artifact)return null;
 if(target?.kind!=='business'||target.dist!=='dist-business'||target.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02')throw Error('TERMINAL_ARTIFACT_BUSINESS_TEST_ONLY');
 const checked=parseTerminalArtifactArgs(['--terminal-apk-path',artifact.file,'--terminal-apk-sha256',artifact.sha256]).artifact;
 const bytes=verifiedTerminalBytes(checked.file,checked.sha256),dist=path.join(releaseRoot,'apps','sites-workflow','dist-business');assertNoLinks(dist);
 const downloads=path.join(dist,'downloads'),apk=path.join(downloads,TERMINAL_APK_NAME),html=path.join(dist,'install.html');
 if(fs.existsSync(downloads))assertNoLinks(downloads);if(fs.existsSync(apk)||fs.existsSync(html))throw Error('NEW_TERMINAL_ARTIFACT_DESTINATION_REQUIRED');
 fs.mkdirSync(downloads,{recursive:true});fs.writeFileSync(apk,bytes,{flag:'wx'});fs.writeFileSync(html,terminalInstallHtml(),{flag:'wx'});
 return {path:'apps/sites-workflow/dist-business/downloads/'+TERMINAL_APK_NAME,sha256:checked.sha256,version:22,installPath:'apps/sites-workflow/dist-business/install.html'};
}
