import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const catalogService = read('apps/api/src/services/catalogService.js');
const envConfig = read('apps/api/src/config/env.js');
const catalogScreen = read('apps/web-admin/src/modules/catalog/CatalogListScreen.jsx');
const whatsappQueueScreen = read('apps/web-admin/src/modules/catalog/WhatsappWebQueueScreen.jsx');

assert(envConfig.includes('WHATSAPP_SEND_APPROVED'), 'WHATSAPP_SEND_APPROVED env gate is missing');
assert(catalogService.includes('assertWhatsappSendAllowed'), 'WhatsApp send approval guard is missing');
assert(catalogService.includes('WHATSAPP_SEND_APPROVAL_REQUIRED'), 'WhatsApp send approval error is missing');
assert(catalogService.includes('sendEnabled: configured && env.whatsapp.sendApproved'), 'WhatsApp status does not expose sendEnabled gate');

const publicDtoStart = catalogService.indexOf('function toPublicCatalogProductDto');
const publicDtoEnd = catalogService.indexOf('function sleep', publicDtoStart);
const publicDto = catalogService.slice(publicDtoStart, publicDtoEnd);
assert(publicDto.includes('inStock'), 'Public catalog DTO must expose an inStock signal');
assert(publicDto.includes('stockSignal'), 'Public catalog DTO must expose a public stock signal');
assert(!publicDto.includes('stockQuantity:'), 'Public catalog DTO must not expose exact stockQuantity');
assert(!publicDto.includes('price:'), 'Public catalog DTO must not expose price');
assert(!publicDto.includes('barcode:'), 'Public catalog DTO must not expose barcode');

assert(!catalogScreen.includes('sendWhatsappCatalog'), 'Catalog screen must not call automatic WhatsApp send');
assert(!catalogScreen.includes('Musteriye Gonder'), 'Catalog screen must not show direct customer send action');
assert(!catalogScreen.includes('Müşteriye Gönder'), 'Catalog screen must not show direct customer send action');
assert(catalogScreen.includes('Fiyat ve stok bilgisi'), 'Catalog share text must require sales confirmation for price/stock');

assert(!whatsappQueueScreen.includes('sendWhatsappCatalog'), 'WhatsApp queue screen must not call automatic WhatsApp send');
assert(!whatsappQueueScreen.includes('Otomatik Gönder'), 'WhatsApp queue screen must not show automatic send action');
assert(whatsappQueueScreen.includes('Otomatik gönderim kapalı'), 'WhatsApp queue screen must show no-send status');
assert(whatsappQueueScreen.includes('Fiyat ve stok bilgisi'), 'WhatsApp queue captions must require sales confirmation for price/stock');

console.log('Sprint 012 catalog/WhatsApp safety smoke PASS');
