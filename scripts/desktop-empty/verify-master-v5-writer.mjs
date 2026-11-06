// Real TLS admission probe. Secret is inherited stdin only; outputs no driver
// errors, connection strings, credentials or user data.
import {readFile} from 'node:fs/promises';
import {openDesktopMasterV5TlsConnector,closeDesktopWriteTlsConnector} from '../../apps/api/src/config/desktopWriteTlsConnector.mjs';
const chunks=[];let size=0,secret,connector;for(const n of ['log','error','warn','debug','info'])console[n]=()=>{};
try{for await(const chunk of process.stdin){size+=chunk.length;if(size>46)throw Error();chunks.push(chunk);}secret=Buffer.concat(chunks);if(!/^A9![A-Za-z0-9_-]{43}$/.test(secret.toString('ascii')))throw Error();const pem=await readFile('C:/Users/Xaser/Desktop/ERP/kurulum/MELISAERP-sql-public.pem','utf8');connector=await openDesktopMasterV5TlsConnector({password:secret.toString('ascii'),publicCertificatePem:pem});process.stdout.write('MASTER_V5_WRITER_TLS_VERIFIED');}
catch{process.stderr.write('MASTER_V5_WRITER_TLS_FAILED');process.exitCode=1;}
finally{secret?.fill(0);for(const c of chunks)c.fill(0);if(connector)try{await closeDesktopWriteTlsConnector(connector);}catch{process.stderr.write('MASTER_V5_WRITER_CLOSE_FAILED');process.exitCode=1;}}
