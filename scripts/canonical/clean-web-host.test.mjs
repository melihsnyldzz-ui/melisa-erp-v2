import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const windows=process.platform==='win32';
const source=path.join(import.meta.dirname,'clean-web-host.ps1');
const powershell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=value=>value.replaceAll("'","''");
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(body){
  const text=execFileSync(powershell,['-NoProfile','-NonInteractive','-Command',
    `$ErrorActionPreference='Stop';. '${quote(source)}' -Library;${body}`],
  {encoding:'utf8',windowsHide:true,timeout:45000,stdio:['ignore','pipe','pipe']});
  assert.equal(text.trim(),'PASS',text);
}
// Local fixture bytes, not a release manifest or production authority. No ports,
// network, provider, SQL, private settings or installed processes are accessed.
const worker=String.raw`if(process.env.SQL_PASSWORD||process.env.OPENAI_API_KEY)process.exit(88);const fs=require('node:fs'),path=require('node:path');fs.appendFileSync(path.resolve(process.cwd(),'..','births.log'),process.pid+'\n');process.stdout.write(process.pid+'|'+process.cwd()+'|'+process.argv[1]+'\n');process.stdin.on('data',()=>process.exit(0));setInterval(()=>{},1000);`;
function fixture(body){
  const created=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-web-owner-host-'));
  const root=fs.realpathSync.native(created),node=fs.realpathSync.native(process.execPath);
  const files={
    'rollback.manifest':'FIXTURE ONLY: b89 baseline',
    'candidate.manifest':'FIXTURE ONLY: b89 plus CSSb6',
    'rollback/worker.cjs':worker,'candidate/worker.cjs':worker,
    'protected.bin':'fixed full synthetic boundary',
  };
  for(const [name,bytes] of Object.entries(files)){
    const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
  }
  fs.writeFileSync(path.join(root,'live-protection.bin'),files['protected.bin']);
  const pins=Object.entries(files).map(([name,bytes])=>`$pins.Add('${name}','${sha(bytes)}');`).join('');
  try{
    run(`Initialize-CleanWebHostSource;
      $root='${quote(root)}';$exe='${quote(node)}';
      $pins=New-Object 'Collections.Generic.Dictionary[string,string]';${pins}
      function Expect([scriptblock]$body,[string]$code){$hit=$false;try{& $body|Out-Null}catch{$hit=$_.Exception.Message.Contains($code)};if(!$hit){throw ('EXPECTED_'+$code)}}
      function StartFixture{[Melisa.CleanWeb1056.VerifiedCleanWebHost]::StartOwnedFixture($root,$exe,$pins)}
      $env:SQL_PASSWORD='SYNTHETIC_FIXTURE_SENTINEL';$env:OPENAI_API_KEY='SYNTHETIC_FIXTURE_SENTINEL';
      $h=$null;try{${body}}finally{if($h){$h.Dispose()}};'PASS'`);
  }finally{
    assert.equal(path.dirname(path.resolve(created)),path.resolve(os.tmpdir()));
    assert.match(path.basename(created),/^melisa-web-owner-host-/);
    fs.rmSync(created,{recursive:true,force:true});
  }
}

test('installed web host closes before compilation or any target action',{skip:!windows},()=>run(`
  function Initialize-CleanWebHostSource{throw 'NO_COMPILE'}
  $closed=$false;try{Start-InstalledCleanWebHost}catch{$closed=$_.Exception.Message -ceq 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'}
  if(!$closed){throw 'INSTALLED_HOST_OPEN'}
  $closed=$false;try{& '${quote(source)}' -Apply}catch{$closed=$_.Exception.Message -ceq 'B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING'}
  if(!$closed -or ('Melisa.CleanWeb1056.Owner' -as [type])){throw 'APPLY_ENTRY_DID_NOT_CLOSE_BEFORE_COMPILE'};'PASS'`));

test('adapter retains real own child pins and writer through publication final ACK and child lifetime',{skip:!windows},()=>fixture(`
  $h=StartFixture;$old=$h.CurrentClaim();
  if($old.Pid -le 0 -or $old.Birth -le 0 -or !$old.Cwd.EndsWith('rollback') -or $h.WaitForOwnedWebExit(25)){throw 'HOST_BIRTH'}
  $h.Begin(15000);Expect {$h.WaitForOwnedWebExit(0)} 'WEB_FINAL_ACK_REQUIRED';
  if($h.TryFixtureWriter()){throw 'OTHER_GATE'}
  $p=$h.StageCandidate();
  if($p.Pid -eq $old.Pid -or !$p.OldRetired -or $p.FinalAcknowledged -or $h.TryFixtureWriter()){throw 'PUBLICATION'}
  $blocked=$false;try{[IO.File]::WriteAllText([IO.Path]::Combine($root,'candidate.manifest'),'changed')}catch{$blocked=$true}
  if(!$blocked){throw 'PIN_NOT_RETAINED'}
  Expect {$h.StageCandidate()} 'WEB_HOST_STAGE_ALREADY_STARTED';
  $same=$h.ReadOutcome();if($same.Pid -ne $p.Pid -or $same.PublishedSha256 -cne $p.PublishedSha256){throw 'REPLACED_AFTER_LOST_RESPONSE'}
  $null=$h.Acknowledge();$ack=$h.Acknowledge();
  if(!$ack.FinalAcknowledged -or $ack.State -cne 'CandidateCommittedOldRetired' -or $ack.Pid -ne $p.Pid -or $h.WaitForOwnedWebExit(25)){throw 'ACK_OR_LIFETIME'}
  Expect {$h.Begin(15000)} 'WEB_HOST_TRANSITION_ALREADY_STARTED';
  if([IO.File]::ReadAllLines([IO.Path]::Combine($root,'births.log')).Length -ne 2){throw 'SECOND_CANDIDATE'}
  $h.RequestFixtureCandidateExit();if(!$h.WaitForOwnedWebExit(0)){throw 'HOST_DID_NOT_WAIT_OWN_CHILD'}
`));

test('adapter rejects mismatched fixture package pins and exposes no public production binding factory',{skip:!windows},()=>fixture(`
  $type=[Melisa.CleanWeb1056.VerifiedCleanWebHost];
  if($type.GetMethod('Start') -or !$type.Assembly.GetType('Melisa.CleanWeb1056.CooperativeBirthBinding').IsNotPublic){throw 'PUBLIC_PRODUCTION_AUTHORITY'}
  Expect {[Melisa.CleanWeb1056.VerifiedCleanWebHost]::StartOwnedFixture([IO.Directory]::GetParent($root).FullName,$exe,$pins)} 'WEB_FIXTURE_SCOPE';
  foreach($name in @('rollback.manifest','candidate.manifest','candidate/worker.cjs')){
    $expected=$pins[$name];$pins[$name]='0'*64;
    Expect {StartFixture} 'WEB_HOST_FIXTURE_PIN';$pins[$name]=$expected;
    if([IO.File]::Exists([IO.Path]::Combine($root,'owner.claim')) -or [IO.File]::Exists([IO.Path]::Combine($root,'births.log'))){throw 'BORN_BEFORE_PIN_VALIDATION'}
  }
`));

test('adapter recovers a real exited candidate through rollback and final ACK without replay birth',{skip:!windows},()=>fixture(`
  $h=StartFixture;$old=$h.CurrentClaim();$h.Begin(15000);$p=$h.StageCandidate();$h.RequestFixtureCandidateExit();
  if($h.TryFixtureWriter()){throw 'EXIT_RELEASED_GATE'}
  $r=$h.Recover();
  if(!$r.FinalAcknowledged -or $r.State -cne 'RollbackRestored' -or $r.Artifact -cne 'rollback' -or $r.Pid -in @($old.Pid,$p.Pid)){throw 'HOST_ROLLBACK'}
  Expect {$h.Recover()} 'WEB_HOST_FINALIZED';$same=$h.Acknowledge();
  if($same.Pid -ne $r.Pid -or [IO.File]::ReadAllLines([IO.Path]::Combine($root,'births.log')).Length -ne 3){throw 'ROLLBACK_REPLAY_BIRTH'}
`));

test('adapter preserves the full fixture witness guard instead of substituting process identity',{skip:!windows},()=>fixture(`
  $h=StartFixture;$old=$h.CurrentClaim();$h.Begin(15000);
  [IO.File]::WriteAllText([IO.Path]::Combine($root,'live-protection.bin'),'changed synthetic data boundary');
  Expect {$h.StageCandidate()} 'WEB_PRESERVED_BOUNDARY_CHANGED';
  if($h.State -cne 'Prepared' -or $h.CurrentClaim().Pid -ne $old.Pid -or $h.TryFixtureWriter()){throw 'DRIFT_IGNORED'}
  [IO.File]::WriteAllBytes([IO.Path]::Combine($root,'live-protection.bin'),[IO.File]::ReadAllBytes([IO.Path]::Combine($root,'protected.bin')));
  $null=$h.StageCandidate();$r=$h.Acknowledge();if(!$r.FinalAcknowledged){throw 'FRESH_GUARD_NOT_USED'}
`));
