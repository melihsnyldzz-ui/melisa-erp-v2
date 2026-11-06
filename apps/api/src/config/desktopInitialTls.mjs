// Dedicated first-read TLS config. The pinned value is the independently
// observed public certificate DER SHA-256, not a credential or private key.
import {createHash,X509Certificate} from 'node:crypto';
import {inspect} from 'node:util';
import sql from 'mssql';
const PIN='dfb05698389659352709765a2109ed82bde543ca552a403e06df652b2cb004d5';
const fail=()=>{throw Object.assign(new Error('DESKTOP_INITIAL_TLS_REJECTED'),{code:'DESKTOP_INITIAL_TLS_REJECTED'});};
export const DESKTOP_INITIAL_TLS_LIMITS=Object.freeze({server:'127.0.0.1',port:51433,certificateName:'SEMIH',
 database:'MELISA_ERP_DESKTOP_TEST_20261105',login:'melisa_desktop_test_app_20261105',certificateDerSha256:PIN,
 requiresPrivatePasswordProvider:true,realConnectionProven:false});
export function createDesktopInitialTlsConfig(input){
 if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(input);
 if(keys.length!==2||!['password','publicCertificatePem'].every(k=>d[k]&&d[k].enumerable&&Object.hasOwn(d[k],'value'))
  ||keys.some(k=>typeof k!=='string'||!['password','publicCertificatePem'].includes(k)))fail();
 const password=d.password.value,pem=d.publicCertificatePem.value;
 if(typeof password!=='string'||password.length<1||password.length>128||/[\0\r\n]/.test(password)
  ||typeof pem!=='string'||pem.length>16384||!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/.test(pem))fail();
 let cert;try{cert=new X509Certificate(pem);}catch{fail();}
 const now=Date.now();
 if(createHash('sha256').update(cert.raw).digest('hex')!==PIN||!cert.checkHost('SEMIH',{subject:'never',wildcards:false,partialWildcards:false})
  ||!Number.isFinite(Date.parse(cert.validFrom))||!Number.isFinite(Date.parse(cert.validTo))
  ||now<Date.parse(cert.validFrom)||now>Date.parse(cert.validTo))fail();
 const config={server:'127.0.0.1',port:51433,database:'MELISA_ERP_DESKTOP_TEST_20261105',user:'melisa_desktop_test_app_20261105',
  options:{encrypt:true,trustServerCertificate:false,serverName:'SEMIH',cryptoCredentialsDetails:{ca:[pem],minVersion:'TLSv1.2',maxVersion:'TLSv1.2'}},
  pool:{min:0,max:4,idleTimeoutMillis:30000},connectionTimeout:10000,requestTimeout:10000};
 Object.defineProperties(config,{password:{get:()=>password,enumerable:false},
  toJSON:{value:()=>({profile:'desktop-initial-read',password:'[REDACTED]'}),enumerable:false},
  [inspect.custom]:{value:()=>({profile:'desktop-initial-read',password:'[REDACTED]'}),enumerable:false}});
 return config;
}

// Only this factory registers a connector, after a pinned Tedious pool has
// connected. The pool and config are held privately; no caller-supplied flag
// can claim that a random connection completed TLS verification.
const registered=new WeakMap();
export async function openDesktopInitialTlsConnector(input){
 let pool;
 try{
  const config=createDesktopInitialTlsConfig(input);
  pool=new sql.ConnectionPool(config);
  Object.freeze(config.options.cryptoCredentialsDetails.ca);
  Object.freeze(config.options.cryptoCredentialsDetails);
  Object.freeze(config.options);Object.freeze(config.pool);Object.freeze(config);
  await pool.connect();
  const connector=Object.freeze({profile:'desktop-initial-read',transport:'pinned-tedious'});
  registered.set(connector,{pool,config});return connector;
 }catch{if(pool)try{await pool.close();}catch{}fail();}
}
export function getDesktopInitialTlsPool(connector){
 const entry=registered.get(connector);
 if(!entry||entry.pool.config!==entry.config||entry.pool.connected!==true)fail();
 return entry.pool;
}
export async function closeDesktopInitialTlsConnector(connector){
 const entry=registered.get(connector);if(!entry)fail();
 registered.delete(connector);await entry.pool.close();
}
