// Internal local-reader worker: receives only the SQL machine credential on a
// private inherited stdin. No arguments or environment variables hold secrets.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const fail=()=>{throw Error('DESKTOP_READER_START_FAILED');};

// The parent retains stdin open while it owns the exclusive lock. EOF or extra
// bytes force shutdown, including if the owner process unexpectedly exits.
export function receiveReaderSecret(stream){
 let closed=false,received=false,resolveClosed,resolveInput,rejectInput;const chunks=[];
 const done=new Promise(resolve=>{resolveClosed=resolve;});
 const input=new Promise((resolve,reject)=>{resolveInput=resolve;rejectInput=reject;});
 const stop=()=>{if(closed)return;closed=true;for(const b of chunks)b.fill(0);chunks.length=0;resolveClosed();if(!received)rejectInput(Error('INPUT_REJECTED'));};
 stream.on('end',stop);stream.on('error',stop);
 stream.on('data',chunk=>{
  if(closed)return;if(received){stop();return;}
  const b=Buffer.from(chunk);if(Buffer.isBuffer(chunk))chunk.fill(0);chunks.push(b);const size=chunks.reduce((n,x)=>n+x.length,0);
  if(size>46){stop();return;}if(size<46)return;
  const value=Buffer.concat(chunks);for(const x of chunks)x.fill(0);chunks.length=0;
  if(value.some(x=>x>127)||!/^A9![A-Za-z0-9_-]{43}$/.test(value.toString('ascii'))){value.fill(0);stop();return;}
  received=true;resolveInput(value);
 });
 return Object.freeze({input,done,isClosed:()=>closed});
}
async function main(){
 // Never forward dependency diagnostics: driver errors may contain secrets.
 for(const name of ['log','info','debug','warn','error'])console[name]=()=>{};
 let secret,running,web;const reader=receiveReaderSecret(process.stdin);
 const fatal=()=>{secret?.fill(0);process.stderr.write('DESKTOP_INITIAL_READER_START_FAILED\n');process.exit(1);};
 process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
 try{
  secret=await reader.input;if(reader.isClosed())fail();
  const pem=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/MELISAERP-sql-public.pem','utf8');
  const {startDesktopInitialReadServer}=await import('../../apps/api/src/desktopInitialReadServer.mjs');
  running=await startDesktopInitialReadServer({publicCertificatePem:pem,credentialProvider:async()=>secret.toString('ascii')});
  secret.fill(0);secret=null;
  if(reader.isClosed()){await running.close();running=null;fail();}
  const {startInitialReadWeb}=await import('./initial-green-web.mjs');web=await startInitialReadWeb();
  if(reader.isClosed()){await web.close();web=null;await running.close();running=null;fail();}
  process.stdout.write('DESKTOP_INITIAL_READER_READY\n');
  await reader.done;await web.close();web=null;await running.close();running=null;
 }catch{process.stderr.write('DESKTOP_INITIAL_READER_START_FAILED\n');process.exitCode=1;}
 finally{secret?.fill(0);if(web)try{await web.close();}catch{}if(running)try{await running.close();}catch{}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){main().catch(()=>{process.stderr.write('DESKTOP_INITIAL_READER_START_FAILED\n');process.exitCode=1;});}
