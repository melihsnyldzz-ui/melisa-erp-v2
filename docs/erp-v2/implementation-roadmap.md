# Melisa ERP v2 Implementation Roadmap

## Amaç

Bu doküman Melisa ERP v2 için kodlamaya geçmeden önce uygulanabilir geliştirme yol haritasını tanımlar. Roadmap; karar defteri, UI blueprint, veri mimarisi, frontend/backend mimarisi, terminal sync protokolü ve auth/yetki dokümanlarıyla uyumlu ilerlemelidir.

Kodlamaya başlanmadan önce ana prensipler:

- Önce doküman, sonra kod.
- Küçük ve doğrulanabilir görevler.
- Desktop-first, Vega/Wolvox yoğun ERP hissi.
- SQL Server uyumlu backend tasarımı.
- React web-admin, ileride Electron uyumu.
- Terminal offline/sync kararları bozulmadan ilerleme.

## Faz 0: Proje Hazırlık / Repo Düzeni

### Hedef

ERP v2 geliştirmesi için temiz repo yapısı, dokümantasyon bağlantıları, temel araçlar ve çalışma kurallarını hazırlamak.

### Yapılacak işler

- Repo kök yapısını belirlemek.
- `docs/erp-v2` dokümanlarını proje kaynağı olarak kabul etmek.
- Frontend, backend, terminal ve shared klasör sınırlarını planlamak.
- Package manager, lint, format, env örnekleri ve build komutlarını netleştirmek.
- README veya docs index üzerinden ERP v2 dokümanlarına link vermek.
- İlk `.env.example` taslağını hazırlamak; gerçek secret yazmamak.

### Çıktı dosyalar/modüller

- Repo README güncellemesi.
- Docs index veya ERP v2 doküman linkleri.
- İlk frontend/backend klasör iskeleti planı.
- Geliştirme komutları notu.

### Riskler

- Eski proje kalıntılarıyla yeni ERP v2 kararlarının karışması.
- Dokümantasyon dışı varsayımla kod yazılması.
- Secret veya bağlantı bilgisi yanlışlıkla repoya girmesi.

### Kabul kriterleri

- ERP v2 doküman seti repo içinde erişilebilir.
- Kodlamaya başlamadan önce hangi klasöre ne yazılacağı net.
- Build/test komutları veya planı belirlenmiş.
- Gerçek credential repoya eklenmemiş.

## Faz 1: Temel Web-admin İskeleti

### Hedef

React tabanlı desktop-first web-admin shell oluşturmak: üst menü, sidebar, sekme barı, çalışma alanı, alt durum çubuğu ve dashboard placeholder.

### Yapılacak işler

- React proje iskeletini kurmak.
- App shell oluşturmak.
- Üst menü/ribbon mock.
- Sol sidebar/modül ağacı mock.
- Tab system mock.
- Window/work area container.
- Modal host altyapısı.
- Dashboard placeholder ve widget grid.
- UI referanslarına uygun yoğun ERP temel tema.
- Docs bağlantı ekranı veya geliştirici linkleri.

### Çıktı dosyalar/modüller

- `src/app`
- `src/layout`
- `src/window-manager`
- `src/modal-manager`
- `src/modules/dashboard`
- `src/shared/components`
- İlk route yapısı.

### Riskler

- Modern boş SaaS panel görünümüne kaymak.
- Aşırı soyut component altyapısı kurup gerçek ekranları geciktirmek.
- Mobile-first responsive yapıya fazla zaman harcamak.

### Kabul kriterleri

- Uygulama desktop-first açılır.
- Üst menü, sidebar, tab bar, çalışma alanı ve status bar görünür.
- En az 3 mock sekme açılıp kapatılabilir.
- Dashboard placeholder yoğun ERP yerleşimine uygundur.
- Build başarılıdır.

## Faz 2: Stok ve Cari Modülleri

### Hedef

ERP v2’nin temel kart ve liste altyapısını stok ve cari modülleri üzerinden çalışır hale getirmek.

### Yapılacak işler

- Product API ve product list UI.
- Product card UI.
- Product barcode yönetimi.
- Customer/supplier list UI.
- Customer/supplier card UI.
- Pasif kayıt filtresi.
- Temel DataTable standardı.
- Backend product/customer/supplier servisleri.
- SQL Server uyumlu ilk entity tasarımı.

### Çıktı dosyalar/modüller

- `modules/stock/product-list`
- `modules/stock/product-card`
- `modules/cari/customer-list`
- `modules/cari/customer-card`
- `modules/cari/supplier-card`
- Product/customer/supplier backend servisleri.
- DataTable shared component.

### Riskler

- Ürün/cari kartlarını fazla sade form gibi yapmak.
- Hareket görmüş kayıt silmeme kuralını unutarak delete akışı yazmak.
- Barkodları string yerine sayısal ele almak.

### Kabul kriterleri

- Stok listesi yoğun tablo olarak açılır.
- Ürün kartı temel alanları ve barkodları gösterir.
- Cari listesi ve kart ekranı açılır.
- Pasif kayıt mantığı UI ve API seviyesinde görünür.
- Build/test raporu alınır.

## Faz 3: Satış / Alış Fişleri

### Hedef

Satış ve alış fişlerinin draft, satır girişi, kesinleştirme ve stok hareketi etkisini kurmak.

### Yapılacak işler

- Sales invoice list.
- Sales invoice form.
- Draft sales invoice.
- Purchase invoice list.
- Purchase invoice form.
- Draft purchase invoice.
- Fiş satır tablosu.
- Genel iskonto alanı.
- Çoklu döviz snapshot alanları.
- Satış kesinleşince stok düşme.
- Alış kesinleşince stok artma.
- Average cost hesaplama.
- Fiş iptal onay popup.
- Audit log yazımı.

### Çıktı dosyalar/modüller

- `modules/sales/invoice-list`
- `modules/sales/invoice-form`
- `modules/purchase/invoice-list`
- `modules/purchase/invoice-form`
- Sales/purchase backend servisleri.
- Stock movement service.
- Currency service.
- Audit service başlangıcı.

### Riskler

- Draft fişe ticari etki vermek.
- Kesinleşmiş fişi fiziksel silmek.
- Fiş kesinleştirmede transaction sınırını gevşek bırakmak.
- Kur snapshot’ını saklamamak.

### Kabul kriterleri

- Draft fiş stok/cari etki oluşturmaz.
- Satış finalize stok düşürür.
- Alış finalize stok artırır ve average cost günceller.
- Fiş iptal audit’e düşer.
- Build/test raporu alınır.

## Faz 4: Terminal Sync Altyapısı

### Hedef

Android terminal için offline-first sync altyapısının backend protokolünü ve ilk terminal entegrasyon yüzeylerini kurmak.

### Yapılacak işler

- Terminal device registration.
- Device token mantığı.
- Terminal login.
- Product/customer bootstrap cache endpointleri.
- Pending sync queue backend modeli.
- `invoice_created` event işleme.
- Idempotency kontrolü.
- Retry/failure status alanları.
- Hatalı sync dashboard uyarısı.
- Eksi stok uyarısı.

### Çıktı dosyalar/modüller

- Terminal sync service.
- Terminal device service.
- Terminal sync queue entity/API.
- Sync error list UI.
- Dashboard warning integration.

### Riskler

- Aynı terminal event’inden iki satış fişi oluşturmak.
- Stok çakışmasını reddederek offline satış kararını bozmak.
- Queue hatalarını görünmez bırakmak.
- Terminali karmaşık ERP paneline çevirmek.

### Kabul kriterleri

- Terminal sync event’i idempotent çalışır.
- Offline satış sync edilince satış fişi oluşur.
- Stok eksiye düşebilir ve dashboard uyarısı oluşur.
- Failed sync listelenir.
- Build/test raporu alınır.

## Faz 5: Katalog Modülü

### Hedef

Genel ve müşteriye özel katalog oluşturma, ürün seçimi, görsel eşleştirme ve katalog performans temelini kurmak.

### Yapılacak işler

- Katalog listesi.
- Katalog oluşturma ekranı.
- Genel katalog / müşteriye özel katalog ayrımı.
- Katalog ürün seçimi modalı.
- Ürün görsel eşleştirme.
- Stok gösterim modu.
- Fiyat göster/gizle.
- Public catalog token yapısı.
- Katalog performansı ilk kayıtları.

### Çıktı dosyalar/modüller

- `modules/catalog`
- Catalog backend service.
- Catalog item API.
- Public catalog view.
- Catalog performance temel kayıtları.

### Riskler

- Katalog ekranını ERP modülünden kopuk pazarlama sayfası gibi yapmak.
- Pasif ürünleri yeni kataloglara eklemek.
- Snapshot alanlarını tutmamak.

### Kabul kriterleri

- Katalog oluşturulabilir.
- Ürünler katalog item olarak eklenebilir.
- Genel ve müşteriye özel katalog ayrılır.
- Public token ile katalog görüntülenebilir.
- Build/test raporu alınır.

## Faz 6: Raporlar / Dashboard

### Hedef

Patron ve muhasebe dashboard’ları ile temel ticari raporları çalışır hale getirmek.

### Yapılacak işler

- Genel dashboard veri endpointi.
- Patron dashboard kutuları.
- Muhasebe dashboard kutuları.
- Günlük satış raporu.
- Stok değeri raporu.
- Cari borç/alacak raporu.
- Alış/satış hareket raporları.
- Eksi stok ve hatalı terminal sync uyarıları.
- Excel/PDF export altyapısı.

### Çıktı dosyalar/modüller

- `modules/dashboard`
- `modules/reports`
- Report service.
- Dashboard widget standardı.
- Export service/adapters.

### Riskler

- Dashboard’u dekoratif grafik ekranına çevirmek.
- Tablo ve filtre bağlamını gizlemek.
- Büyük rapor sorgularında performans sorunu.

### Kabul kriterleri

- Dashboard 30 saniye auto-refresh mantığına uygun çalışır.
- Kritik uyarılar görünür.
- Temel raporlar filtrelenebilir ve tablo olarak açılır.
- Export akışı en az planlı veya mock seviyede belirgindir.
- Build/test raporu alınır.

## Faz 7: Electron Hazırlığı

### Hedef

Web-admin arayüzünü ileride Electron kabuğuna taşınabilecek hale getirmek ve platform bağımlılıklarını ayırmak.

### Yapılacak işler

- Platform service abstraction.
- Print/export adapter sınırları.
- API adresi ayarı.
- App window size defaults.
- Local config yaklaşımı.
- Electron build planı.
- Web ve Electron ortak React ekran kontrolü.

### Çıktı dosyalar/modüller

- `platform/web`
- `platform/electron`
- Print/export adapter taslakları.
- API config screen.
- Electron hazırlık dokümanı veya build script planı.

### Riskler

- Electron özel kodunu React component içine gömmek.
- Web build’i bozmak.
- Yerel dosya/device erişimini güvenliksiz yapmak.

### Kabul kriterleri

- Platform bağımlılıkları servis/adaptör katmanına ayrılmıştır.
- Web build çalışmaya devam eder.
- Electron’a geçiş için eksik işler listelenmiştir.
- Build/test raporu alınır.

## Faz 8: Test, Stabilizasyon, Geçiş

### Hedef

ERP v2’nin gerçek kullanıma yaklaşması için test, performans, veri geçişi, hata düzeltme ve stabilizasyon yapmak.

### Yapılacak işler

- Uçtan uca temel akış testleri.
- Büyük tablo performans testleri.
- Fiş finalize transaction testleri.
- Terminal sync retry/idempotency testleri.
- Audit zorunluluğu testleri.
- Pasif kayıt ve hareket görmüş kayıt testleri.
- Vega/veri aktarım planı.
- Kullanıcı kabul testleri.
- Backup/rollback planı.

### Çıktı dosyalar/modüller

- Test senaryoları.
- Stabilizasyon issue listesi.
- Veri geçiş planı.
- Kullanıcı kabul kontrol listesi.
- Release notu.

### Riskler

- Gerçek veriyle performans sorunlarının geç fark edilmesi.
- Terminal offline edge-case’lerinin kaçması.
- Audit veya transaction boşlukları.
- Veri geçişinde eski kararlarla yeni modelin karışması.

### Kabul kriterleri

- Kritik satış/alış/stok/cari akışları test edilmiştir.
- Terminal sync idempotency doğrulanmıştır.
- Audit kritik işlemlerde zorunlu çalışır.
- Performans kabul edilebilir seviyededir.
- Geçiş için açık risk listesi vardır.

## İlk Kod Sprinti

### Hedef

Kodlamanın ilk sprintinde gerçek ticari iş kuralına girmeden önce ERP v2 web-admin iskeletini ve geliştirici çalışma düzenini kurmak.

### Kapsam

1. Proje klasör yapısı.
2. React layout shell.
3. Sidebar/top menu.
4. Tab system mock.
5. Dashboard placeholder.
6. Docs bağlantıları.

### Proje klasör yapısı

Önerilen ilk yapı:

```text
src/
  app/
  layout/
  window-manager/
  modal-manager/
  modules/
    dashboard/
    stock/
    sales/
    purchase/
    cari/
    catalog/
    reports/
    terminal-management/
    settings/
    audit/
  shared/
  platform/
docs/
  erp-v2/
```

### React layout shell

İlk shell şu bölgeleri göstermelidir:

- Üst menü/ribbon.
- Sol sidebar.
- Sekme barı.
- Orta çalışma alanı.
- Alt durum çubuğu.

### Sidebar / top menu

Sidebar ve top menu `menu-navigation-map.md` ile uyumlu olmalıdır. İlk sprintte gerçek yetki kontrolü yerine mock rol kullanılabilir, ancak rol/yetki mimarisine ters bir yapı kurulmamalıdır.

### Tab system mock

Mock sekmeler:

- Dashboard.
- Stok Listesi.
- Satış Fişi.

Kullanıcı sekme açma/kapatma ve aktif sekme değiştirme davranışını görebilmelidir.

### Dashboard placeholder

Dashboard placeholder yoğun ERP düzenine uygun olmalıdır:

- KPI kutuları.
- Kritik uyarı alanı.
- Kısa liste/table widget.
- Hatalı terminal sync placeholder.
- Eksi stok placeholder.

### Docs bağlantıları

Geliştirici için ERP v2 dokümanlarına hızlı link eklenmelidir:

- `karar-defteri.md`
- `ui-blueprint.md`
- `menu-navigation-map.md`
- `frontend-architecture.md`
- `backend-api-architecture.md`

### İlk sprint kabul kriterleri

- App shell çalışır.
- En az 3 mock sekme çalışır.
- Dashboard placeholder görünür.
- Sidebar/top menu ERP modüllerini gösterir.
- Build başarılıdır.
- Yapılan iş sonunda kısa build/test raporu verilir.

## Codex Görev Kuralları

Her Codex görevi şu kurallarla yürütülmelidir:

- Her görev küçük ve net kapsamlı olmalıdır.
- Göreve başlamadan önce ilgili `docs/erp-v2` dokümanına bakılmalıdır.
- Büyük değişikliklerde önce kısa plan verilmelidir.
- Kod dışı dosyalara izinsiz dokunulmamalıdır.
- İlgisiz refactor yapılmamalıdır.
- Mevcut uygulama dosyaları gereksiz bozulmamalıdır.
- Build/test sonucu raporlanmalıdır.
- Çalıştırılamayan test varsa neden açık yazılmalıdır.
- Gerçek secret, token veya credential repoya yazılmamalıdır.
- SQL Server/Vega gibi gerçek veri kaynaklarında kullanıcı onayı olmadan yazma işlemi yapılmamalıdır.
- Doküman kararlarıyla çelişen bir ihtiyaç görülürse önce raporlanmalı, sonra karar netleştirilmelidir.

## Kodlamaya Başlamadan Önce Son Kontrol Listesi

- [ ] `karar-defteri.md` okundu.
- [ ] `ui-blueprint.md` okundu.
- [ ] `menu-navigation-map.md` okundu.
- [ ] `data-schema-blueprint.md` okundu.
- [ ] `frontend-architecture.md` okundu.
- [ ] `backend-api-architecture.md` okundu.
- [ ] `terminal-sync-protocol.md` okundu.
- [ ] `auth-permission-architecture.md` okundu.
- [ ] İlk kod sprintinin kapsamı net.
- [ ] Proje klasör yapısı net.
- [ ] Build/test komutları net.
- [ ] Gerçek credential kullanılmayacak.
- [ ] Kod değişikliği doküman kararlarıyla uyumlu.
- [ ] Büyük değişiklik için plan hazır.
- [ ] Kullanıcıdan ek onay gerektiren risk yok.
