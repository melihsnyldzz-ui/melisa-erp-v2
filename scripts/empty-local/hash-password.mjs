// Deliberately uses the API's own installed bcrypt implementation. stdin/stdout
// are redirected private pipes owned by bootstrap; never run interactively.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const chunks=[];let size=0;
try{
  if(process.argv.length!==2||process.stdin.isTTY||process.stdout.isTTY)throw Error();
  for await(const value of process.stdin){const bytes=Buffer.from(value);size+=bytes.length;if(size>2048)throw Error();chunks.push(bytes);}
  const bytes=Buffer.concat(chunks);let payload;
  try{payload=JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}
  if(!payload||Object.keys(payload).join(',')!=='password'||typeof payload.password!=='string'||payload.password.length<24||payload.password.length>72)throw Error();
  const bcrypt=require('bcrypt');const hash=await bcrypt.hash(payload.password,12);payload.password='';
  if(!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash))throw Error();
  process.stdout.write(hash);
}catch{process.stderr.write('EMPTY_LOCAL_PASSWORD_HASH_REJECTED\n');process.exitCode=1;}
finally{for(const bytes of chunks)bytes.fill(0);}
