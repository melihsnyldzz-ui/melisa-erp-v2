export const CATALOG_LAYOUTS = [
  { id: 'showcase', name: 'Vitrin', description: 'Tek ürün · büyük görsel', count: 1, columns: 1 },
  { id: 'duo', name: 'İkili', description: 'Sayfada 2 ürün', count: 2, columns: 1 },
  { id: 'grid', name: 'Klasik', description: 'Sayfada 4 ürün', count: 4, columns: 2 },
  { id: 'compact', name: 'Kompakt', description: 'Sayfada 9 ürün', count: 9, columns: 3 },
];

const text = value => String(value ?? '').trim();
const escape = value => text(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const number = value => value === null || value === undefined || text(value) === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export function catalogImageUrl(value, apiBase) {
  try {
    const url = new URL(text(value), apiBase);
    const path = decodeURIComponent(url.pathname);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
      || !/^\/uploads\/(vega-products|products|verified-products)\/[^/\\]+$/u.test(path) || path.includes('..')) return '';
    return new URL(url.pathname, apiBase).href;
  } catch { return ''; }
}

// Deliberately project the catalog fields; never carry costs or customer details into output.
export function toCatalogProduct(row, apiBase) {
  const sourceId = Number(row.sourceId);
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0 || !text(row.stockCode) || !text(row.productName)) {
    throw new Error('Ürün kimliği veya ürün adı eksik. Listeyi yenileyin.');
  }
  const currency = text(row.currency).toUpperCase();
  const price = number(row.salePrice ?? row.salesPrice);
  const verifiedImage = row.imageIdentityStatus === 'VERIFIED' && /^[a-f0-9]{64}$/.test(text(row.imageIdentityHash));
  const imageUrl = catalogImageUrl(row.imageUrl, apiBase);
  const boundImage = verifiedImage && imageUrl && new URL(imageUrl).pathname.startsWith(`/uploads/verified-products/${row.imageIdentityHash}--`);
  return {
    id: String(sourceId), code: text(row.stockCode), name: text(row.productName),
    brand: text(row.brand), category: text(row.specialCodes?.KOD4 || row.category),
    image: boundImage ? imageUrl : '',
    imageRevision: text(row.imageIdentityHash),
    imageNotice: row.imageIdentityStatus === 'NO_IMAGE' ? 'Görsel bulunmuyor'
      : boundImage ? 'Görsel yüklenemedi' : 'Fotoğraf doğrulanmadı',
    price: price !== null && price > 0 && /^[A-Z]{3}$/.test(currency) && row.currencyTrustState === 'TRUSTED' && row.currencySource === 'ERP_SALE_UNIT' ? price : null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : '',
    stock: number(row.stockQuantity),
  };
}

// Re-read exact identities before preview/print, without losing selection order.
export async function refreshCatalogSelection(selected, read, apiBase, isCurrent = () => true) {
  if (!selected.length || new Set(selected.map(row => row.id)).size !== selected.length) throw new Error('Katalog seçimi geçersiz.');
  const refreshed = new Array(selected.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
    while (cursor < selected.length) {
      if (!isCurrent()) throw new Error('Katalog seçimi değişti. Önizlemeyi yeniden açın.');
      const index = cursor++, id = selected[index].id;
      const response = await read({ sourceId: id, page: 1, limit: 2, activeOnly: true, imageStatus: 'all', imageUsage: 'catalog' });
      if (!isCurrent()) throw new Error('Katalog seçimi değişti. Önizlemeyi yeniden açın.');
      if (response.meta?.source !== 'vega-live-read-only' || !Array.isArray(response.data) || response.data.length !== 1
        || String(response.data[0].sourceId) !== id || response.data[0].isPassive === true) {
        throw new Error(`${selected[index].code}: ürün güncel kaynaktan doğrulanamadı. Seçimi kontrol edin.`);
      }
      refreshed[index] = toCatalogProduct(response.data[0], apiBase);
    }
  }));
  return refreshed;
}

export function catalogPrice(product) {
  return product.price === null || !product.currency ? 'Fiyat teyit edilecek'
    : `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(product.price)} ${product.currency}`;
}

export function catalogPages(products, layoutId, order = 'selection') {
  const layout = CATALOG_LAYOUTS.find(item => item.id === layoutId);
  if (!layout) throw new Error('Katalog düzeni geçersiz.');
  if (new Set(products.map(product => product.id)).size !== products.length) throw new Error('Aynı ürün katalogda birden fazla kez bulunuyor.');
  const rows = [...products];
  if (order === 'code') rows.sort((a, b) => a.code.localeCompare(b.code, 'tr', { numeric: true }));
  if (order === 'brand') rows.sort((a, b) => a.brand.localeCompare(b.brand, 'tr') || a.code.localeCompare(b.code, 'tr', { numeric: true }));
  return Array.from({ length: Math.ceil(rows.length / layout.count) }, (_, index) => rows.slice(index * layout.count, (index + 1) * layout.count));
}

export function buildCatalogHtml({ products, layoutId = 'grid', order = 'selection', title = 'Melisa Bebe Katalog', subtitle = '', showPrices = false, showStock = false, cover = false }) {
  const pages = catalogPages(products, layoutId, order);
  if (!pages.length) throw new Error('PDF için en az bir ürün seçin.');
  const layout = CATALOG_LAYOUTS.find(item => item.id === layoutId);
  const total = pages.length + (cover ? 1 : 0);
  const heading = text(title) || 'Melisa Bebe Katalog';
  const footer = index => `<footer><span>MELİSA BEBE · ${products.length} ürün</span><span>${index} / ${total}</span></footer>`;
  const coverHtml = cover ? `<section class="page cover"><div class="wordmark">MELİSA BEBE</div><div><p>ÜRÜN KOLEKSİYONU</p><h1>${escape(heading)}</h1><p>${escape(subtitle)}</p><b>${products.length} ürün</b></div>${footer(1)}</section>` : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escape(heading)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e9e6e2;color:#262a2e;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 portrait;margin:0}.page{width:210mm;height:297mm;padding:12mm 13mm;background:white;margin:8mm auto;display:flex;flex-direction:column;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}
  header{height:22mm;flex:none;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;gap:8mm;align-items:start}header h1{font-size:17pt;margin:0;overflow-wrap:anywhere;line-height:1.15;max-height:15mm;overflow:hidden}header small{display:block;font-size:8pt;margin-top:2mm;max-height:4mm;overflow:hidden}header b{font-size:8pt;white-space:nowrap;color:#796352}
  .grid{display:grid;grid-template-columns:repeat(${layout.columns},minmax(0,1fr));grid-template-rows:repeat(${layout.count / layout.columns},minmax(0,1fr));gap:5mm;flex:1;min-height:0;padding:6mm 0}
  article{min-height:0;min-width:0;border:1px solid #e0dcd5;border-radius:2mm;padding:3mm;display:flex;flex-direction:column;overflow:hidden;break-inside:avoid}.photo{flex:1;min-height:0;background:#f6f5f3;display:flex;align-items:center;justify-content:center;position:relative}.photo img{width:100%;height:100%;object-fit:contain;position:absolute;inset:0}.photo span{font-size:8pt;color:#777}.details{flex:none;padding-top:2mm}.code{font-weight:bold;font-size:${layout.count === 9 ? 9 : 12}pt;overflow-wrap:anywhere;line-height:1.1}.name{font-size:${layout.count === 9 ? 8 : 10}pt;margin:1mm 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.2;overflow-wrap:anywhere}.brand{font-size:8pt;color:#796352;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.price{font-size:10pt;font-weight:bold;margin-top:2mm}.stock{font-size:8pt;margin-top:1mm}
  footer{height:8mm;flex:none;border-top:1px solid #ccc;display:flex;justify-content:space-between;align-items:end;font-size:8pt;color:#666}.cover{background:#eee9e2;justify-content:space-between}.wordmark{font-size:16pt;letter-spacing:4px}.cover h1{font-size:36pt;overflow-wrap:anywhere}.cover p{font-size:12pt;white-space:pre-wrap;overflow-wrap:anywhere}.cover footer{width:100%}
  @media screen{body{zoom:var(--preview-scale,1)}}@media print{body{background:white}.page{margin:0}}
  </style></head><body>${coverHtml}${pages.map((page, index) => `<section class="page"><header><div><h1>${escape(heading)}</h1><small>${escape(subtitle)}</small></div><b>MELİSA BEBE</b></header><div class="grid">${page.map(product => `<article data-product-id="${escape(product.id)}"><div class="photo"><span>${escape(product.imageNotice || 'Görsel bulunmuyor')}</span>${product.image ? `<img src="${escape(product.image)}" alt="${escape(product.code)}">` : ''}</div><div class="details"><div class="brand">${escape(product.brand)}</div><div class="code">${escape(product.code)}</div><div class="name">${escape(product.name)}</div>${showPrices ? `<div class="price">${escape(catalogPrice(product))}</div>` : ''}${showStock ? `<div class="stock">Stok: ${product.stock === null ? 'Teyit edilecek' : escape(product.stock)}</div>` : ''}</div></article>`).join('')}</div>${footer(index + 1 + (cover ? 1 : 0))}</section>`).join('')}</body></html>`;
}

// Use the very same document for preview and printing, after every image settles.
export async function prepareCatalogFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc) throw new Error('Önizleme açılamadı.');
  await doc.fonts.ready;
  const results = await Promise.all(Array.from(doc.images).map(async image => {
    let timeout;
    try {
      await Promise.race([image.decode(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Görsel zaman aşımı')), 15000); })]);
      image.previousElementSibling?.setAttribute('hidden', '');
      return true;
    } catch {
      image.style.display = 'none';
      return false;
    } finally { clearTimeout(timeout); }
  }));
  return results.filter(result => !result).length;
}
