import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const pipelineListPath = resolve(repoRoot, 'apps/web-admin/src/modules/sales/SalesPipelineListScreen.jsx');
const source = readFileSync(pipelineListPath, 'utf8');
const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

addCheck('pipeline list uses readable Turkish status labels', ['Gönderildi', 'Onaylı', 'Tamamlandı', 'İptal'].every((text) => source.includes(text)));
addCheck('pipeline list explains API errors without fallback', source.includes('Demo fallback kullanılmadı.'));
addCheck('pipeline list has actionable empty state', source.includes('Kayıt bulunamadı; filtreleri temizleyip tekrar deneyin.'));
addCheck('pipeline list detects partial API results', source.includes('const hasPartialList = Number(meta?.total || 0) > rows.length;'));
addCheck('pipeline list explains partial result scope', source.includes("Liste API'den gelen ilk") && source.includes('aramayı daraltın'));
addCheck('pipeline list keeps live API limit visible', source.includes('limit: 100'));
addCheck('pipeline list has no mojibake placeholders', !/[?]nderildi|Onayl[?]|Kay[?]t|Yazd[?]r|Sipari[?]ler/.test(source));

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
