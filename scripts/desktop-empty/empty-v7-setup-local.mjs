// Native human first setup only. No HTTP endpoint, password arguments or login.
// This executable is never imported by the server. Root must separately admit
// the schema7 target and this exact source/package before the human dialog.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {emptyV7HeldFileLimit,assertEmptyV7SetupDecision,assertEmptyV7SchemaAcceptance,assertEmptyV7SchemaReview,validateEmptyV7HumanPassword,emptyV7BeforeSetupSql,compileEmptyV7FirstSetup} from './empty-v7-setup-core.mjs';
import {EMPTY_V7_PROFILE_ID,EMPTY_V7_TARGET,EMPTY_V7_PUBLIC_PATH,EMPTY_V7_PUBLIC_BINDING_TEXT,EMPTY_V7_SQL_LOGIN} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
import {getDesktopFinanceV7GuardSql} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {inspectDesktopRuntimeTree} from './sql-login-runtime-integrity.mjs';
const root='C:/Users/Xaser/Desktop/ERP',runtime=root+'/runtime-clean-v7',evidence=root+'/kurulum/empty-profile-db9-v1';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const require=createRequire(runtime+'/apps/api/package.json');
const check=(ok,code)=>{if(!ok)throw Error('EMPTY_V7_SETUP_'+code);};
const held=[];let submitted=false,committed=false,phase='host',pool,tls,privateInput;
function noReparse(file){let p=path.resolve(file);for(;;){check(!fs.lstatSync(p).isSymbolicLink(),'REPARSE');const up=path.dirname(p);if(up===p)break;p=up;}}
function hold(file,sha){noReparse(file);const fd=fs.openSync(file,'r');held.push(fd);const s=fs.fstatSync(fd);check(s.isFile()&&s.nlink===1&&s.size<emptyV7HeldFileLimit(file,sha),'FILE');const b=fs.readFileSync(fd);if(sha)check(/^[a-f0-9]{64}$/.test(sha)&&hash(b)===sha,'PIN');return b;}
function writeNew(name,value){check(/^[a-z0-9-]+\.json$/.test(name),'OUTPUT');noReparse(evidence);const fd=fs.openSync(evidence+'/'+name,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function one(result,keys){check(result?.recordsets?.length===1&&result.recordset?.length===1&&Object.keys(result.recordset[0]).sort().join(',')===keys.slice().sort().join(','),'RESULT_SHAPE');return result.recordset[0];}
function host(decision){
 check(process.platform==='win32'&&!['NODE_OPTIONS','NODE_PATH','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','OPENSSL_CONF','SSL_CERT_FILE'].some(k=>process.env[k]),'HOST');
 check(fileURLToPath(import.meta.url).replaceAll('\\','/').toLowerCase()===(runtime+'/scripts/desktop-empty/empty-v7-setup-local.mjs').toLowerCase(),'SOURCE_LOCATION');
 const script="$ErrorActionPreference='Stop';$i=[Security.Principal.WindowsIdentity]::GetCurrent();$p=[Security.Principal.WindowsPrincipal]::new($i);if($i.Name -cne 'SEMIH\\Xaser' -or -not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'OWNER'};$sid=$i.User;$b=[byte[]]::new($sid.BinaryLength);$sid.GetBinaryForm($b,0);$proof=Get-Content -Raw -LiteralPath '"+evidence+"/root-first-owner-decision.v1.json'|ConvertFrom-Json -DateKind String;foreach($e in $proof.processes){$a=Get-CimInstance Win32_Process -Filter ('ProcessId='+$e.pid);if($null -eq $a -or $a.CreationDate.ToUniversalTime().ToString('O') -cne $e.birth -or $a.ExecutablePath -cne $e.executable -or $a.CommandLine -cne $e.commandLine -or $a.ParentProcessId -ne $e.parentPid){throw 'LIFETIME'}};[ordered]@{sid=$sid.Value;sqlSid=('0x'+[Convert]::ToHexString($b))}|ConvertTo-Json -Compress";
 const pwsh='C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';hold(pwsh,decision.publicProbePwshSha256);
 const out=execFileSync(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,maxBuffer:4096,stdio:['pipe','pipe','pipe']});
 const owner=JSON.parse(out);check(owner.sid===decision.ownerSid,'OWNER_SID');return owner;
}
async function input(){let size=0;const chunks=[];try{for await(const c of process.stdin){size+=c.length;check(size<=4096,'INPUT');chunks.push(c);}const b=Buffer.concat(chunks);try{return JSON.parse(b.toString('utf8'));}finally{b.fill(0);}}finally{for(const b of chunks)b.fill(0);}}
try{
 const [mode,decisionSha]=process.argv.slice(2);check(process.argv.length===4&&['--prepare','--apply'].includes(mode)&&/^[a-f0-9]{64}$/.test(decisionSha),'ARGUMENTS');
 const decision=JSON.parse(hold(evidence+'/root-first-owner-decision.v1.json',decisionSha));
 check(process.execPath.replaceAll('\\','/').toLowerCase()==='c:/program files/nodejs/node.exe','NODE_LOCATION');hold(process.execPath,'3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5');
 check(Array.isArray(decision.processes)&&decision.processes.length===4&&new Set(decision.processes.map(p=>p.pid)).size===4&&decision.processes.map(p=>p.pid).sort((a,b)=>a-b).join(',')===decision.expectedProcessIds?.slice().sort((a,b)=>a-b).join(',')&&decision.processes.every(p=>Number.isSafeInteger(p.pid)&&p.pid>0&&typeof p.birth==='string'&&typeof p.commandLine==='string'&&typeof p.executable==='string'&&Number.isSafeInteger(p.parentPid)),'PROCESS_BINDING');
 // Fixed SQL instances, plus the two separately bound current application
 // processes. Dynamic lifetimes never change the DB9/schema7 target.
 check(decision.expectedProcessIds.includes(8440)&&decision.expectedProcessIds.includes(4872),'SQL_LIFETIMES');
 check(decision.processes.find(p=>p.pid===8440).birth==='2026-11-10T00:32:27.3873190Z'&&decision.processes.find(p=>p.pid===4872).birth==='2026-11-10T00:32:20.4253490Z','SQL_BIRTHS');
 const pkgBytes=hold(evidence+'/runtime-package.json',decision.packageHash),pkg=JSON.parse(pkgBytes);
 check(pkg.profile==='desktop-master-v7'&&pkg.targetProfile===EMPTY_V7_PROFILE_ID&&pkg.sourceRoot===runtime&&pkg.publicFiles?.[EMPTY_V7_PUBLIC_PATH]===hash(Buffer.from(EMPTY_V7_PUBLIC_BINDING_TEXT)),'PACKAGE_TARGET');
 const own=fileURLToPath(import.meta.url),core=fileURLToPath(new URL('./empty-v7-setup-core.mjs',import.meta.url)),window=fileURLToPath(new URL('./empty-v7-setup-window.ps1',import.meta.url));
 for(const [rel,sha]of Object.entries({...pkg.sources,...pkg.helpers})){check((/^(apps\/api\/|packages\/shared\/|scripts\/|infra\/sql\/migrations\/)[A-Za-z0-9_./-]+\.(mjs|js|sql|ps1)$/.test(rel)||rel==='scripts/canonical/fixtures/night-20261006-before.json')&&!rel.split('/').includes('..'),'SOURCE_KEY');hold(runtime+'/'+rel,sha);}
 const owner=host(decision);
 assertEmptyV7SetupDecision(decision,{packageHash:hash(pkgBytes),sourceHead:decision.sourceHead,selfSha256:hash(hold(own)),coreSha256:hash(hold(core)),windowSha256:hash(hold(window)),ownerSid:owner.sid,recordedSchema7AcceptanceSha256:decision.recordedSchema7AcceptanceSha256,actualIndependentReviewSha256:decision.actualIndependentReviewSha256});
 check(pkg.sourceHead===decision.sourceHead,'HEAD');
 const tree=inspectDesktopRuntimeTree();check(pkg.dependencySha256==='8acf2de20977d03c01b5e9ec467274b411a9029851ec34989f6040a8c4b4e346'&&tree.sha256===pkg.dependencySha256&&tree.entryCount===11623,'DEPENDENCIES');
 check(fs.realpathSync(runtime+'/apps/api/node_modules').replaceAll('\\','/').toLowerCase()==='c:/users/xaser/desktop/erp/kaynak/apps/api/node_modules','DEPENDENCY_LOCATION');
 check(decision.recordedSchema7AcceptancePath===root+'/kurulum/k02-10-readonly-preflight-v1/empty-profile-schema7-actual-acceptance.v1.json','SCHEMA_ACCEPTANCE_PATH');
 for(const [file,sha]of [[decision.recordedSchema7AcceptancePath,decision.recordedSchema7AcceptanceSha256],[decision.actualIndependentReviewPath,decision.actualIndependentReviewSha256]]){check(typeof file==='string'&&path.dirname(file.replaceAll('\\','/'))===root+'/kurulum/k02-10-readonly-preflight-v1','ACCEPTANCE_PATH');hold(file,sha);}
 const acceptance=JSON.parse(hold(decision.recordedSchema7AcceptancePath,decision.recordedSchema7AcceptanceSha256)),schemaReview=JSON.parse(hold(decision.actualIndependentReviewPath,decision.actualIndependentReviewSha256));
 assertEmptyV7SchemaAcceptance(acceptance,decision.actualIndependentReviewSha256,{adminSidHex:owner.sqlSid,sqlProcessBirth:decision.processes.find(p=>p.pid===8440).birth});
 assertEmptyV7SchemaReview(schemaReview,acceptance);
 check(!fs.existsSync(evidence+'/apply-attempt.json')&&!fs.existsSync(evidence+'/first-owner-setup-receipt.v1.json'),'PRIOR_ATTEMPT');
 const sql=require('mssql/msnodesqlv8.js'),bcrypt=require('bcrypt');
 pool=await new sql.ConnectionPool({connectionString:'Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\\MELISAERP;Database='+EMPTY_V7_TARGET.database+';Trusted_Connection=Yes;Encrypt=No;ConnectRetryCount=0;',connectionTimeout:10000,requestTimeout:30000,pool:{min:0,max:1}}).connect();
 const identity={adminPid:process.pid,adminSidHex:owner.sqlSid};phase='readonly-preflight';
 check(one(await pool.request().query('SET NOCOUNT ON;'+emptyV7BeforeSetupSql(identity)+' SELECT 1 ok;'),['ok']).ok===1,'PREFLIGHT');
 if(mode==='--prepare'){
  writeNew('preparation.json',{state:'EMPTY_V7_FIRST_SETUP_PREPARED',operationId:decision.operationId,decisionSha256:decisionSha,packageHash:decision.packageHash,target:EMPTY_V7_TARGET,nonce:crypto.randomUUID(),expiresAt:Date.now()+1800000,sqlWrites:0});
  process.stdout.write('EMPTY_V7_HUMAN_FORM_READY');
 }else{
  const preparation=JSON.parse(hold(evidence+'/preparation.json'));check(preparation.state==='EMPTY_V7_FIRST_SETUP_PREPARED'&&preparation.operationId===decision.operationId&&preparation.decisionSha256===decisionSha&&preparation.packageHash===decision.packageHash&&preparation.expiresAt>Date.now()&&preparation.expiresAt<=Date.now()+1800000,'PREPARATION');
  privateInput=await input();check(privateInput&&Object.keys(privateInput).sort().join(',')==='confirmation,nonce,password,passwordConfirmation,technicalPassword'&&privateInput.nonce===preparation.nonce&&/^A9![A-Za-z0-9_-]{43}$/.test(privateInput.technicalPassword),'PRIVATE_INPUT');
  validateEmptyV7HumanPassword({confirmation:privateInput.confirmation,password:privateInput.password,passwordConfirmation:privateInput.passwordConfirmation});
  let humanHash=await bcrypt.hash(privateInput.password,12);privateInput.password=null;privateInput.passwordConfirmation=null;
  const preview=compileEmptyV7FirstSetup(identity);writeNew('apply-attempt.json',{state:'EMPTY_V7_FIRST_SETUP_ATTEMPT',operationId:decision.operationId,decisionSha256:decisionSha,packageHash:decision.packageHash,sqlSha256:preview.sha256,processId:process.pid,submittedAt:new Date().toISOString(),noAutomaticRetry:true});
  phase='setup-submit';submitted=true;
  const request=pool.request().input('technicalPassword',sql.NVarChar(46),privateInput.technicalPassword).input('humanHash',sql.NVarChar(60),humanHash);humanHash=null;
  const row=one(await request.query(preview.sql),['state','userId','roleId','userVersion']);committed=true;
  check(row.state==='EMPTY_V7_FIRST_OWNER_CREATED'&&/^[1-9][0-9]{0,18}$/.test(row.userId)&&/^[1-9][0-9]{0,18}$/.test(row.roleId)&&/^[a-f0-9]{16}$/.test(row.userVersion),'COMMITTED_READBACK');
  phase='fresh-tls-readback';const mssql=require('mssql');const {createDesktopWriteTlsConfig}=await import('../../apps/api/src/config/desktopWriteTlsConnector.mjs');
  const config=createDesktopWriteTlsConfig({password:privateInput.technicalPassword,publicCertificatePem:hold(root+'/kurulum/MELISAERP-sql-public.pem','10529de42f6bbc07e67f0bd950df63d88229acedb2ec6df793cd634fa00c1433').toString('utf8')},EMPTY_V7_PROFILE_ID);
  tls=await new mssql.ConnectionPool(config).connect();
  const rights=one(await tls.request().query('SET NOCOUNT ON;'+getDesktopFinanceV7GuardSql(EMPTY_V7_PROFILE_ID)+" SELECT LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state,permission_name FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state,permission_name FOR JSON PATH,INCLUDE_NULL_VALUES)),2)) permissionReadbackSha256;"),['permissionReadbackSha256']);
  check(/^[a-f0-9]{64}$/.test(rights.permissionReadbackSha256),'RIGHTS_READBACK');
  const result={state:'EMPTY_V7_FIRST_OWNER_SQL_COMMITTED_STORAGE_PENDING',operationId:decision.operationId,decisionSha256:decisionSha,packageHash:decision.packageHash,target:EMPTY_V7_TARGET,username:'kurulum',roleCode:'admin',writerLogin:EMPTY_V7_SQL_LOGIN,...row,userId:row.userId,roleId:row.roleId,userVersion:row.userVersion,sqlGrantManifestSha256:preview.sqlGrantManifestSha256,permissionReadbackSha256:rights.permissionReadbackSha256,strictTlsVerified:true,rawRightsVerified:true,effectiveRightsVerified:true,otherDatabaseAccessDenied:true,businessWrites:false,plaintextPasswordStored:false};
  result.state='EMPTY_V7_FIRST_OWNER_SQL_COMMITTED_STORAGE_PENDING';writeNew('sql-result.json',result);process.stdout.write('EMPTY_V7_FIRST_OWNER_SQL_COMMITTED_STORAGE_PENDING');
 }
}catch{try{if(submitted)writeNew('setup-failure.json',{state:committed?'EMPTY_V7_COMMITTED_FOLLOWUP_REQUIRED':'EMPTY_V7_OUTCOME_UNKNOWN',phase,creationMayHaveOccurred:true,noAutomaticRetry:true});}catch{}process.stderr.write('EMPTY_V7_FIRST_SETUP_STOPPED\n');process.exitCode=1;}
finally{if(privateInput){privateInput.password=null;privateInput.passwordConfirmation=null;privateInput.technicalPassword=null;}try{await tls?.close();await pool?.close();}catch{process.exitCode=1;}for(const fd of held)fs.closeSync(fd);}
