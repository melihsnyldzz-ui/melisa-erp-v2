import bcrypt from '../../apps/api/node_modules/bcrypt/bcrypt.js';
const chunks=[];let size=0;
try{for await(const chunk of process.stdin){chunks.push(chunk);size+=chunk.length;if(size>46)throw Error();}const b=Buffer.concat(chunks);if(!/^A9![A-Za-z0-9_-]{43}$/.test(b.toString('ascii')))throw Error();const hash=await bcrypt.hash(b.toString('ascii'),12);b.fill(0);for(const c of chunks)c.fill(0);process.stdout.write(hash);}catch{process.stderr.write('HASH_FAILED');process.exitCode=1;}
