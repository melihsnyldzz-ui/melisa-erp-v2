const targetDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';
const statuses=new Set(['PASS','PARTIAL','FAIL','PENDING']);
const domains={stock:'Stok',customer:'Cari müşteri',supplier:'Cari tedarikçi',price:'Fiyat',cost:'Maliyet',opening:'Açılış'};
const blockerLabels={
 NEGATIVE_STOCK:'Kaynakta eksi stok incelemesi gerekiyor.',
 UNKNOWN_STOCK:'Miktarı belirsiz kayıtlar var.',
 UNKNOWN_COST:'Maliyeti doğrulanamayan kayıtlar var.',
 AMBIGUOUS_PRODUCT:'Ürün eşleşmesi belirsiz kayıtlar var.',
 AMBIGUOUS_PARTY:'Cari eşleşmesi belirsiz kayıtlar var.',
 BARCODE_CONFLICT:'Barkod çakışmaları incelenmeli.',
 CURRENCY_CONFLICT:'Para birimi uyuşmazlıkları incelenmeli.',
 TARGET_CONFLICT:'Mevcut TEST kayıtlarıyla çakışma var.',
 STAGING_ONLY:'Prova ayrık migration modelinde; native ERP açılışına uygulanmadı.',
 SOURCE_DRIFT:'Kaynak değişti; yeni snapshot ve delta mutabakatı gerekiyor.',
 SOURCE_NOT_CURRENT:'Prova 30 Eylül kaynak yakalamasıyla yapıldı; güncel Vega delta mutabakatı gerekiyor.',
 INDEPENDENT_REVIEW_PENDING:'Bağımsız mutabakat incelemesi bekleniyor.',
 CUTOVER_NOT_ACCEPTED:'Geçiş günü kabul kapıları henüz tamamlanmadı.'
};
function exactKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw Error('MIGRATION_PUBLIC_SUMMARY_FIELDS_REJECTED');}
function integer(value){if(!Number.isSafeInteger(value)||value<0)throw Error('MIGRATION_PUBLIC_SUMMARY_COUNT_REJECTED');return value;}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function renderMigrationProof(summary,commit){
 exactKeys(summary,['schemaVersion','runId','sourceSnapshotHash','sourceCapturedAt','sourceAsOf','freshLiveSource','targetDatabase','status','rehearsalMode','counts','checks','blockers']);
 if(summary.schemaVersion!==1||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(summary.runId)||!/^[a-f0-9]{64}$/.test(summary.sourceSnapshotHash)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(summary.sourceCapturedAt)||!Number.isFinite(Date.parse(summary.sourceCapturedAt))||summary.targetDatabase!==targetDatabase||!statuses.has(summary.status)||!['staging-only','native-opening'].includes(summary.rehearsalMode)||!/^[a-f0-9]{40}$/.test(commit))throw Error('MIGRATION_PUBLIC_SUMMARY_IDENTITY_REJECTED');
 if(summary.freshLiveSource!==false||(summary.sourceAsOf!==null&&(!/^\d{4}-\d\d-\d\d$/.test(summary.sourceAsOf)||!Number.isFinite(Date.parse(summary.sourceAsOf)))))throw Error('MIGRATION_PUBLIC_SUMMARY_SOURCE_DATE_REJECTED');
 exactKeys(summary.counts,['products','customerAccounts','supplierAccounts']);
 for(const key of ['products','customerAccounts','supplierAccounts'])integer(summary.counts[key]);
 if(!Array.isArray(summary.checks)||!Array.isArray(summary.blockers)||summary.checks.length!==6||new Set(summary.checks.map(row=>row.domain)).size!==6||summary.blockers.some(code=>!Object.hasOwn(blockerLabels,code)))throw Error('MIGRATION_PUBLIC_SUMMARY_CHECKS_REJECTED');
 for(const row of summary.checks){exactKeys(row,['domain','status','rows','differences']);if(!Object.hasOwn(domains,row.domain)||!statuses.has(row.status))throw Error('MIGRATION_PUBLIC_SUMMARY_CHECK_REJECTED');integer(row.rows);integer(row.differences);if(row.status==='PASS'&&row.differences!==0)throw Error('MIGRATION_PUBLIC_SUMMARY_PASS_CONTRADICTION');}
 if(summary.status==='PASS'&&(!summary.freshLiveSource||summary.rehearsalMode!=='native-opening'||summary.blockers.length||summary.checks.some(row=>row.status!=='PASS')))throw Error('MIGRATION_PUBLIC_SUMMARY_PASS_CONTRADICTION');
 const rows=summary.checks.map(row=>`<tr><th scope="row">${domains[row.domain]}</th><td>${row.status}</td><td>${row.rows.toLocaleString('tr-TR')}</td><td>${row.differences.toLocaleString('tr-TR')}</td></tr>`).join('');
 const blockers=summary.blockers.length?`<ul>${summary.blockers.map(code=>`<li>${blockerLabels[code]}</li>`).join('')}</ul>`:'<p>Bu snapshot için kayıtlı engel yok. Geçiş günü delta ve işletme kabulü ayrıca yapılır.</p>';
 return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TEST · Vega migration provası</title><style>body{margin:0;background:#f4f7f5;color:#172b22;font:16px system-ui,sans-serif}main{max-width:960px;margin:24px auto;padding:24px;background:white;border-radius:12px}h1{font-size:28px}.tag{display:inline-block;background:#e9f3ed;padding:8px 12px;border-radius:6px}.notice{border-left:4px solid #a66d00;padding:12px;background:#fff8e7}dl{display:grid;grid-template-columns:190px 1fr;gap:10px}dd{margin:0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px;border-bottom:1px solid #d9e4de;text-align:left}small{color:#496154}a{color:#14603f}@media(max-width:600px){main{margin:0;padding:16px}dl{grid-template-columns:1fr}dt{font-weight:600}th,td{padding:8px}}</style></head><body><main><p class="tag">TEST · Salt okunur prova özeti</p><h1>Vega → Melisa ERP migration</h1><p class="notice">Durum: <strong>${summary.status}</strong>. Bu ekran paket oluşturulduğunda kaydedilmiş mutabakat özetidir. Güncel SQL sorgusu çalıştırmaz; veri aktarmaz. Export zamanı, kaynak verisinin güncelliğini kanıtlamaz. Güncel Vega delta mutabakatı ayrı kabul kapısıdır.</p><dl><dt>Prova</dt><dd>${escape(summary.runId)}</dd><dt>Veri kesimi</dt><dd>${summary.sourceAsOf ? escape(summary.sourceAsOf) : 'Henüz doğrulanmadı'} · Güncel LIVE Vega kaynağı değil</dd><dt>Export zamanı</dt><dd>${escape(summary.sourceCapturedAt)}</dd><dt>Hedef</dt><dd>${targetDatabase}</dd><dt>Uygulama kapsamı</dt><dd>${summary.rehearsalMode==='native-opening'?'Native ERP açılış verileri':'Ayrık migration modeli'}</dd><dt>Ürün / müşteri / tedarikçi</dt><dd>${summary.counts.products.toLocaleString('tr-TR')} / ${summary.counts.customerAccounts.toLocaleString('tr-TR')} / ${summary.counts.supplierAccounts.toLocaleString('tr-TR')}</dd></dl><table><thead><tr><th>Kapsam</th><th>Sonuç</th><th>Kontrol edilen satır</th><th>Fark</th></tr></thead><tbody>${rows}</tbody></table><h2>Kabul ve açık noktalar</h2>${blockers}<p>Eski resmi geçmiş aktarılmaz. Geçiş günü kaynak değişimleri tekrar eşlenir; stok, cari, fiyat ve maliyet mutabakatı yeniden alınır. LIVE'a yazma yapılmaz.</p><p><a href="/is-akisi-taslagi.html">TEST iş akışına dön</a></p><small>Kaynak commit: ${commit}<br>Snapshot SHA-256: ${summary.sourceSnapshotHash}</small></main></body></html>`;
}
