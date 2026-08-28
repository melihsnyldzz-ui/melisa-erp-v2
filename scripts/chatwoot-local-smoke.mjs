import fs from 'node:fs';

const compose = fs.readFileSync('infra/chatwoot/docker-compose.yml', 'utf8');
const installer = fs.readFileSync('scripts/install-chatwoot-local.ps1', 'utf8');
const envExample = fs.readFileSync('infra/chatwoot/.env.example', 'utf8');

const checks = [
  ['Chatwoot CE image is version pinned', compose.includes('chatwoot/chatwoot:v4.14.2-ce')],
  ['web is exposed only on dedicated 3100 port', compose.includes('0.0.0.0:3100:3000')],
  ['Postgres and Redis have no host ports', !compose.includes('5432:5432') && !compose.includes('6379:6379')],
  ['persistent volumes cover database cache and attachments', ['chatwoot_storage', 'chatwoot_postgres', 'chatwoot_redis'].every((name) => compose.includes(name))],
  ['database preparation uses official task', installer.includes('db:chatwoot_prepare')],
  ['secrets are generated without printing values', installer.includes('RandomNumberGenerator') && !installer.includes('Write-Host $secretKey')],
  ['initial signup is explicitly enabled', compose.includes('env_file: .env') && envExample.includes('ENABLE_ACCOUNT_SIGNUP=true')],
  ['private LAN webhook access is enabled for local Evolution API', envExample.includes('SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`SUMMARY: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
