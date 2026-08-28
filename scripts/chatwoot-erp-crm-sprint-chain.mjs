import { spawnSync } from 'node:child_process';

const stages = [
  {
    id: 'S01',
    name: 'Chatwoot tek mesaj kaynagi adaptoru',
    commands: [
      ['npm.cmd', ['--prefix', 'apps/whatsapp-crm-api', 'test']],
    ],
  },
  {
    id: 'S02',
    name: 'Ulke ve guvenli kimlik siniri',
    commands: [
      ['node', ['scripts/web-admin-crm-whatsapp-boundary-smoke.mjs']],
    ],
  },
  {
    id: 'S03',
    name: 'Personel atama ve CRM is akisi',
    commands: [
      ['node', ['scripts/web-admin-crm-workflow-smoke.mjs']],
      ['node', ['scripts/personnel-terminal-sales-smoke.mjs']],
    ],
  },
  {
    id: 'S04',
    name: 'ERP Musteri 360 baglami',
    commands: [
      ['node', ['scripts/web-admin-crm-customer-360-smoke.mjs']],
    ],
  },
  {
    id: 'S05',
    name: 'Urun ve katalog secimi',
    commands: [
      ['node', ['scripts/web-admin-crm-product-catalog-smoke.mjs']],
    ],
  },
  {
    id: 'S06',
    name: 'Tek tik katalog ve teklif guvenlik kapisi',
    commands: [
      ['node', ['scripts/web-admin-crm-quote-order-smoke.mjs']],
    ],
  },
  {
    id: 'S07',
    name: 'El terminali CRM erisimi',
    commands: [
      ['node', ['scripts/terminal-user-login-smoke.mjs']],
      ['node', ['scripts/terminal-whatsapp-crm-smoke.mjs']],
    ],
  },
  {
    id: 'S08',
    name: 'Uretim oncesi regresyon ve emniyet',
    commands: [
      ['node', ['scripts/whatsapp-crm-production-preflight-smoke.mjs']],
      ['npm.cmd', ['--prefix', 'apps/web-admin', 'run', 'build']],
    ],
  },
];

let completed = 0;

for (const stage of stages) {
  console.log(`\n[${stage.id}] ${stage.name}`);

  for (const [command, args] of stage.commands) {
    console.log(`> ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      console.error(`\nCHAIN BLOCKED: ${stage.id} basarisiz. Sonraki sprint tetiklenmedi.`);
      process.exit(result.status || 1);
    }
  }

  completed += 1;
  console.log(`[${stage.id}] PASS -> sonraki sprint tetiklendi.`);
}

console.log(`\nCHAIN PASS: ${completed}/${stages.length} sprint kapisi basarili.`);
console.log('Not: Bu zincir gercek WhatsApp mesaji, SQL migration veya ERP siparisi calistirmaz.');
console.log('Android native/Expo Doctor kontrolu ayri cihaz-yayin kapisidir.');
