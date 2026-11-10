// Public metadata subprocess; must run before the starter reads any cipher.
import {readMasterV7Profile} from './master-v7-profile-binding.mjs';
try{
 if(process.argv.length<3||process.argv.length>5)throw Error();
 const b=readMasterV7Profile(process.argv[2],process.argv[3],process.argv[4]??null);
 process.stdout.write(JSON.stringify({targetProfile:b.targetProfile,publicPath:b.publicPath,secretPath:b.secretPath,exportDirectory:b.exportDirectory,sqlCredentialCipherSha256:b.sqlCredentialCipherSha256??null}));
}catch{process.stderr.write('MASTER_V7_PUBLIC_PROFILE_REJECTED\n');process.exitCode=1;}
