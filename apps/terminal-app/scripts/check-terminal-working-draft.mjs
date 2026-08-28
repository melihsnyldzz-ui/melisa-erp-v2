import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const screen = read('src/screens/NewSaleScreen.js');
const service = read('src/services/workingSaleDraftService.js');

const checks = [
  [
    'working draft uses a versioned AsyncStorage key',
    service.includes("const workingSaleDraftKey = 'terminalWorkingSaleDraftV1'")
      && service.includes('workingSaleDraftVersion = 1'),
  ],
  [
    'draft writes are serialized to prevent stale overwrites',
    service.includes('let writeChain = Promise.resolve()')
      && service.includes('serializeWrite')
      && service.includes('AsyncStorage.setItem'),
  ],
  [
    'only a customer with sale lines is recoverable',
    service.includes('draft.customer?.id')
      && service.includes('Array.isArray(draft.lines)')
      && service.includes('draft.lines.length > 0'),
  ],
  [
    'sale changes trigger automatic local draft writes',
    screen.includes('saveWorkingSaleDraft({')
      && screen.includes('customer: selectedCustomer')
      && screen.includes('editingEventId, lines, selectedCustomer'),
  ],
  [
    'restart recovery offers continue or explicit discard',
    screen.includes('Yarim kalan fis bulundu')
      && screen.includes('Fise Devam Et')
      && screen.includes('Taslagi Sil ve Yeni Basla'),
  ],
  [
    'automatic draft never submits to the ERP API',
    !service.includes('submitTerminalSale')
      && !service.includes('apiClient'),
  ],
  [
    'working draft is cleared after queue persistence',
    screen.includes('await clearWorkingSaleDraft().catch(() => {});')
      && screen.includes('await enqueueTerminalSale(basePayload)'),
  ],
  [
    'operator sees automatic save status',
    screen.includes('Otomatik taslak:')
      && screen.includes("autoSaveStatus === 'saving'")
      && screen.includes("autoSaveStatus === 'error'"),
  ],
  [
    'unsaved exit requires a second red-green confirmation',
    screen.includes('discardConfirmationOpen')
      && screen.includes('Kaydetmeden çıkmak istediğinize emin misiniz?')
      && screen.includes('label="Hayır, Fişe Dön"')
      && screen.includes('label="Evet, Kaydetmeden Çık"')
      && screen.includes('variant="success"')
      && screen.includes('variant="danger"'),
  ],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Terminal Working Draft / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
