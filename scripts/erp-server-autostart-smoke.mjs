import fs from 'node:fs';

const watchdog = fs.readFileSync('scripts/erp-server-watchdog.ps1', 'utf8');
const installer = fs.readFileSync('scripts/install-erp-server-autostart.ps1', 'utf8');
const supervisor = fs.readFileSync('scripts/erp-server-supervisor.ps1', 'utf8');

const checks = [
  ['watchdog prevents overlapping runs', watchdog.includes('MelisaErpServerWatchdog') && watchdog.includes('WaitOne(0)')],
  ['Docker Desktop is recovered automatically', watchdog.includes('Ensure-DockerReady') && watchdog.includes('Docker Desktop.exe')],
  ['existing Evolution port prevents a duplicate stack', watchdog.includes("Test-PortListening -Port 8080") && watchdog.includes('Evolution API 8080 portunda zaten hazir')],
  ['ERP API is monitored', watchdog.includes("'http://127.0.0.1:4100/api/health'") && watchdog.includes('-Port 4100')],
  ['CRM API is monitored', watchdog.includes("'http://127.0.0.1:4200/health'") && watchdog.includes('-Port 4200')],
  ['web panel is exposed to LAN', watchdog.includes("'--host', '0.0.0.0'") && watchdog.includes('-Port 5173')],
  ['duplicate process is blocked when port is occupied', watchdog.includes('ikinci surec baslatilmadi')],
  ['startup and periodic tasks are installed', installer.includes('/SC ONLOGON') && installer.includes('/SC MINUTE /MO 2')],
  ['non-admin fallback uses HKCU startup', installer.includes('MelisaERPServerSupervisor') && installer.includes('Set-ItemProperty -Path $RunKey')],
  ['supervisor repeats checks every two minutes', supervisor.includes('MelisaErpServerSupervisor') && supervisor.includes('Start-Sleep -Seconds 120')],
  ['supervisor times out a hung watchdog', supervisor.includes('WaitForExit(90000)') && supervisor.includes('Watchdog 90 saniyede tamamlanmadi')],
  ['secondary supervisor cannot delete the active PID file', supervisor.includes('if ($hasLock)') && supervisor.includes('$pidOwner')],
  ['Chatwoot compose joins automatic recovery', watchdog.includes('infra\\chatwoot\\docker-compose.yml') && watchdog.includes("'http://127.0.0.1:3100/api'")],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
