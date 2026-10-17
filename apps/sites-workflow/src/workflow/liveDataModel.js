import { verifyScope, sourceId } from '../modules/vega/vegaReadModel.js';
export function istanbulDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function dayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day) throw new Error('Geçerli bir gün seçin.');
  return {dateFrom:day,dateTo:new Date(Date.parse(day)+86400000).toISOString().slice(0,10)};
}
export function operationPage(response, params = {}) {
  verifyScope(response.meta);
  const raw=response.data;
  if (response.meta?.readOnly!==true || raw?.source!=='vega' || raw.database!=='VEGA2026' || raw.company!=='F0102' || raw.period!=='D0007' || raw.readOnly!==true || !Number.isFinite(Date.parse(raw.readAt))) throw new Error('VEGA yanıtının kaynağı doğrulanamadı.');
  if (raw.dateRange?.dateFrom!==params.dateFrom || raw.dateRange?.dateTo!==params.dateTo) throw new Error('Gelen kayıtlar seçilen tarihle eşleşmiyor.');
  if (!Array.isArray(raw.items)) throw new Error('VEGA kayıt listesi eksik.');
  if (raw.hasMore && (typeof raw.nextCursor!=='string' || !raw.nextCursor || raw.nextCursor===params.cursor)) throw new Error('Sonraki sayfa bilgisi geçersiz.');
  return {rows:raw.items,meta:response.meta,nextCursor:raw.hasMore?raw.nextCursor:null,complete:!raw.hasMore};
}
export const readPaths={
  product:id=>`/api/vega-read/products/${sourceId(id)}`,
  ledger:id=>`/api/vega-read/accounts/${sourceId(id)}/ledger`,
};
// Keep source identity and cancellation semantics; an uncancelled header is not
// evidence of a completed sale, a payment, a shipment or a verified amount.
export function documentCard(row,kind,accountNames={}) {
  return {id:`${kind}:${sourceId(row.IND)}`,kind,number:row.BELGENO||'Numarasız belge',
    date:row.TARIH,accountId:String(row.FIRMANO??''),account:accountNames[String(row.FIRMANO)]||(row.FIRMANO==null?'Cari eşleşmesi bekliyor':`Cari #${row.FIRMANO}`),
    currency:row.PARABIRIMI,cancelled:row.IPTAL===true?true:row.IPTAL===false?false:null,
    returned:row.IADE===true?true:row.IADE===false?false:null,
    state:row.IPTAL===true?'İptal':row.IADE===true?'İade':row.IPTAL===false?'İptal edilmemiş':'Durum doğrulanmadı',
    payment:'Eşleştirme bekliyor',shipment:'Eşleştirme bekliyor',total:null};
}
export function documentSummary(cards) {
  return {active:cards.filter(r=>r.cancelled===false).length,cancelled:cards.filter(r=>r.cancelled===true).length};
}
export const completionSteps=[
  {order:1,name:'Ortak yeşil ekranlar',state:'Devam ediyor',acceptance:'Gerçek ürün, cari ve fişler aynı iş ekranlarında; örnek kayıtlar ayrı.'},
  {order:2,name:'Şirket bağlantısı',state:'Engel · sonraya bırakıldı',acceptance:'Panelde gerçek hesapla giriş ve güncel kayıtların otomatik yenilenmesi.'},
  {order:3,name:'Satış, tahsilat ve terminal',state:'Bekliyor',acceptance:'Fiş tamamlandığında stok ve cari birlikte kaydolur; tahsilatı İlker ayrıca kaydeder; tekrar gönderim çift kayıt oluşturmaz.'},
  {order:4,name:'Gelen mal ve alış',state:'Bekliyor',acceptance:'Personel sayımı → İlker kontrolü → tek stok artışı; alış faturası tedarikçi borcu ve maliyetle eşleşir.'},
  {order:5,name:'Sayım ve iade',state:'Bekliyor',acceptance:'Sayım farkı araştırılır; onaylı düzeltme ve kaynak fişe bağlı iade stok/cariye bir kez işlenir.'},
  {order:6,name:'Yetkiler, onaylar ve ayarlar',state:'Bekliyor',acceptance:'Gerçek kullanıcı yetkileri uygulanır; onay, değişiklik geçmişi ve ayarlar kalıcıdır.'},
  {order:7,name:'Maliyet ve muhasebe',state:'Bekliyor',acceptance:'Stok, cari, maliyet ve kasa/banka tutarları döviz bazında kaynakla karşılaştırılır.'},
  {order:8,name:'Kullanıma geçiş',state:'Bekliyor',acceptance:'Satıştan tahsilata tüm akış, çok kullanıcı, kesinti ve yedekten dönüş denemesi tamamlanır.'},
];
export const readiness = [
  ['stock','Ürün & stok','Kart, stok, barkod ve kayıtlı fiyat okuma ekranı hazır.','ERP oturumu ve çalışan bağlantı ile canlı doğrulama.'],
  ['customers','Müşteriler','Fişlerdeki 7 gerçek cari eşleşti; karttan ilgili fişler açılır.','Devir, ödeme mahsupları ve bakiye mutabakatı.'],
  ['receipts','Satış fişleri','33 tarihli fiş kopyası, arama, iptal filtresi ve cari kartına geçiş.','Ürün satırları, kalıcı fiş kaydı, tahsilat ve gönderim eşleştirmesi.'],
  ['goods','Gelen mal','VEGA stok girişleri için okuma ekranı hazır.','Sayım → İlker kontrolü → tek stok kaydı.'],
  ['purchases','Alış faturaları','VEGA alış faturaları için okuma ekranı hazır.','Mal kabulü, tedarikçi borcu ve maliyet bağlantısı.'],
  ['collections','Tahsilat','Cari hareketlerini dövizleriyle okuma ekranı hazır.','Kalıcı tahsilat, mahsup, kasa ve banka kayıtları.'],
  ['sales','Satış terminali','Örnek fiş akışı mevcut.','Gerçek satış kaydı, stok/cari bütünlüğü ve cihaz testi.'],
  ['count','Sayım & düzeltme','Görünüm ve fark araştırma akışı mevcut.','Ortak stok, tekrar sayım ve yetkili düzeltme kaydı.'],
  ['returns','İadeler','VEGA iade belgeleri için okuma ekranı hazır.','Kaynak fiş, miktar, stok/cari ve para iadesi bağlantısı.'],
  ['approvals','Onaylar','İş kuralları belirlendi.','Gerçek kullanıcı yetkileri ve değiştirilemez onay geçmişi.'],
  ['settings','Ayarlar','Bağlantı girişi ve tamamlanma takibi eklendi.','Yetki yönetimi, kalıcı veritabanı ve yedekten dönüş.'],
];
