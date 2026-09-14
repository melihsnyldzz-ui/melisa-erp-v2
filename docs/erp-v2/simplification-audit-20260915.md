# Melisa ERP — sadeleştirme incelemesi / 15 Eylül 2026

## Kapsam ve durum

Bu çalışma **kaynak kodu ve ekran yönlendirmesi incelemesidir**. Canlı satış kabulü değildir.
Temel alınan GitHub ana dalı: `577c0cb9d0953635b30088fa23e1e887c7b75775` (8 Eylül 2026).
54 kayıtlı ekranın menü/yönlendirme haritası incelendi. Her ekranın bütün kod satırları veya canlı işlevleri test edilmiş değildir.
Kullanıcının 13–14 Eylül yerel pilot/native raporlarındaki çalışma klasörleri bu GitHub ana dalıyla eşitlenmiş olarak doğrulanmadı.
Bu dal **main'e birleştirilmedi, canlıya yüklenmedi, veri silmedi ve SQL yazmadı**.

## İlk bulgular

1. 11 ana menü, tekrar eden kart girişleri ve tek hedefe farklı isimlerle giden kısayollar bulunuyor. Örneğin `Riskli Cariler`, herhangi bir risk filtresi taşımadan `customer-list` açıyor.
2. `SmartInsightsPanel.jsx` gerçek stok sorgusu yapmadan `Eksi stok yok` ve `Stok kontrolü temiz` yazıyordu. Bunlar analiz sonucu değildir; kaldırıldı ve alan dürüst biçimde **Kısayollar** olarak adlandırıldı.
3. Sidebar ve StatusBar, yalnız `isDemoMode` değerinden veritabanı/bağlantı için hazır/açık sonucu çıkarıyordu. Doğrulanmayan bağlantı iddiaları ve sabit 2026 dönem etiketi kaldırıldı. Yeni bağlantı ölçümü uydurulmadı.
4. `Workspace.jsx` satış ve alış listelerini hâlâ `VegaSalesInvoiceListScreen` ve `VegaPurchaseInvoiceListScreen` bileşenlerine bağlıyor. `movementApi.js` bu okumalarda `/api/vega/...` yollarını kullanıyor. Stok listesi `fetchVegaProducts` kullanıyor. Bu ekranları silmek veya yalnız ismini değiştirmek Melisa'ya geçiş değildir.
5. `mockNavigationData.js` adına rağmen çalışan navigasyonun gerçek kaynağı. `stockMockData` gibi isimler de varsayılan filtreleri içerebilir. Dosya adına bakarak toplu `mock/demo` silme yapılmadı.
6. Tahsilat ekranı müşteri tahsilatı **ve** tedarikçi ödemesi oluşturuyor. Finans defteri/kontrol ekranları yalnız dekor değildir. Bunlar korunuyor.
7. Merkezi kurallar ile son konuşma kararları farklı: negatif stok, seri katı kontrolü, indirim sınırı, offline kesinleştirme ve tahsilat zamanı örnekleri var. Bu temizlikte bu iş kuralları değiştirilmedi.

## Uygulanan düzenleme

Ana menü 11'den 8'e indirildi:

**Ana Sayfa · Stok · Cariler · Satış · Alış · Finans · Raporlar · Ayarlar**

- Müşteri ve tedarikçi girişleri **Cariler** altında toplandı.
- Tanımlar/personel ve teknik yönetim **Ayarlar** altında toplandı.
- Terminal yönetimi, hata/kuyruk takibi ve Excel/CSV aktarımı korunuyor.
- CRM, katalog ve WhatsApp bağlantıları **Ayarlar → Ek Uygulamalar** grubuna taşındı. API veya modül kodları başka repoya taşınmış değildir.
- FedEx demo günlük menü ve komut aramasından çıkarıldı. Eski kayıtlı route korunur; bu değişiklik yetki duvarı veya demo kodunun tamamen silinmesi değildir.
- Kart ekranları kayıt detayından ve komut aramasından erişilebilir; listelerle birlikte ikinci bir menü girişine gerek kalmadı.
- Tek hedefe giden komutlar `screenId` ile tekilleştirildi.
- Bilinen Vega listelerinin menü/arama etiketlerine **(Vega)** eklendi. Veri kaynağı değiştirilmedi.
- Tekrarlanan Sadeleştir/Detaylı ERP düğmeleri ve çalışma görünümü seçimi üst şeritten Görünüm menüsüne alındı. Seçenekler silinmedi.
- Menü etiketlerinin ikinci bir kopyası Sidebar'da tutulmuyor; navigasyon verisi tek kaynak oldu.
- Hazır olmayan öğelerde yanlış `Hazır` işareti yerine `Hazırlanıyor` ve devre dışı düğme kullanılıyor.
- Birleştirilen Cariler menüsü, sadece tedarikçi görünümü açık kullanıcıyı yanlışlıkla müşteri listesine yönlendirmiyor. Bu yalnız menü görünümü tercihidir; API/Workspace yetkileri değişmedi.

## Silinmeyenler ve nedeni

**Vega bağlantıları:** Ana dalda çalışan okumalar hâlâ kullanıyor. Önce yerel native/pilot sürümüyle karşılaştırılıp ekran–API–veritabanı kaynak haritası doğrulanmalı.

**Eski terminal uygulaması:** Kurulu APK ve rollback kullanımının repo düzeyinde tamamı kanıtlanmadı. Kod veya uygulama verisi silinmedi.

**CRM/WhatsApp servisi:** App.jsx oturum ve CRM token temizleme koduna bağlı. Dizin silmek kullanıcı oturum akışını da kırabilir. Şimdilik günlük menüden uzaklaştırıldı.

**Finans/audit/backup/import/iptal kodları:** Ekranda daha az görünmeleri gereksiz oldukları anlamına gelmez. İşlem izleri ve geri dönüş gereksinimleri korunuyor.

**Demo altyapısı:** Bazı servisler açık demo modunda sentetik veri üretmek için kullanıyor. Test bağımlılığı incelenmeden topluca silinemez.

## Önerilen ekranlar — görsel hedef, henüz tümü uygulanmış değil

| Sayfa | Ana içerik | Sadeleştirme yönü |
|---|---|---|
| Ana Sayfa | Dönem, para birimi bazlı satış ve tahsilat; son fişler; kanıtlı uyarılar | Kalıcı sağ analiz paneli, büyük karşılama ve dekoratif kutular yok. Satış ile tahsilat ayrı. |
| Stok / Ürün | Kod merkezli yoğun tablo, ad/marka, barkod, miktar, fiyat/PB, durum; kayıt detayında kart | Tek arama ve kısa filtre satırı. Fotoğraf isteğe bağlı. Veri kaynağı açıkça yazılı. |
| Cariler | Müşteriler / Tedarikçiler / Peşin; cari kodu, unvan, PB, bakiye; hareket ve ekstre | Kopya menüler yerine aynı çalışma alanında liste ve seçilen kayıt. |
| Satış | Cari, tarih, para birimi, kodla ürün ekleme, satırlar, iskonto, toplam | Satış taslağı/finalize ile ödeme durumu ayrı. Tahsilat otomatik olmuş gibi gösterilmez. |
| Alış | Tedarikçi, tarih, PB, ürün/miktar/fiyat/iskonto, toplam | Taslakta ticari etki yok; kesinleşme etkileri açık. Gereksiz kanal/AI öğeleri yok. |
| Finans | Tahsilat / Ödeme, Günlük Kasa, defter ve kontrol bağlantıları | İşlem formu ile hareket listesi birlikte. Para birimleri birbirine eklenmez. |
| Raporlar | Satış, stok değerleme, cari/finans raporları; ayrı Vega geçiş grubu | Kaynak, dönem ve eksik veri görünür. Kaynaksız sıfır veya hazır etiketi yok. |
| Ayarlar | Personel, yetki, döviz, tanımlar, teknik yönetim, ek uygulamalar | Günlük işlem ekranı değil; yetkili kullanıcı için düzenli gruplar. |

Tasarım örneklerindeki rakamlar **örnek veridir**, gerçek şirket raporu değildir.

## Test kanıtı ve sınırlar

Çalıştırıldı:
- `node --test scripts/web-admin-simplification-smoke.mjs`: **20/20 PASS**.
- Değişen 7 JS/JSX dosyası TypeScript parser ile sözdizimi kontrolü: **0 parse hatası**. Bu bir TypeScript typecheck değildir.
- Yeni menü hedefleri, 54 route kimliğinin korunması, tek bölüm eşlemesi, komut tekilleştirme, yardımcı uygulamalar, mali kontroller ve yanlış durum yazılarının kaldırılması kontrol edildi.

Tam checkout ortamında çalıştırılması gerekenler:
- `npm --prefix apps/web-admin run build`.
- `npm --prefix apps/web-admin run smoke:navigation`.
- `npm --prefix apps/web-admin run smoke:deep-link` ve ilgili mevcut UX regresyon paketi.
- Tarayıcıda ekranlar/klavye/sekme geçişleri ve yetkili test verisiyle satış, alış, tahsilat, iptal zinciri.

Bunlar bu oturumda çalıştırılmadı. Tam bağımlılık kurulumu, yerel ERP, SQL ve TC21 erişimi bulunmuyor. Bu dal **production-ready veya FINISH** olarak sunulmuyor.
Mevcut navigation smoke testi, yinelenen etiket haritalarını zorunlu tutmak yerine tek kaynaktaki gerçek etiket/ikon/route bütünlüğünü denetleyecek şekilde güncellendi; ticari test kapıları kaldırılmadı.

## Güvenli uygulama sırası

1. Yerel pilot/native checkout'un branch ve commit'ini bu dalın temeliyle karşılaştır.
2. Çalışan kullanıcı değişikliklerini koruyarak yalnız bu UI farklarını test dalına al.
3. Yukarıdaki build/regresyonları çalıştır ve 8 ana sayfayı test ortamında gez.
4. Kullanıcı görsel düzeni onayladıktan sonra ekran içi düzenlemeleri ayrı küçük değişikliklerle uygula.
5. Vega veri kaynağı geçişini ayrı iş olarak ele al; menü temizliğiyle karıştırma.

Rollback: Bu UI commit'ini geri almak yeterlidir. Veri migrasyonu, SQL değişikliği veya uygulama verisi temizliği yoktur.

## İncelenen başlıca kaynaklar

Temel repo `melihsnyldzz-ui/melisa-erp-v2`, referans `577c0cb9d0953635b30088fa23e1e887c7b75775`:
- `AGENTS.md`, `docs/ai/local-agent-rules.md`, `docs/ai/safe-change-protocol.md`.
- `docs/erp-v2/karar-defteri.md` ve önceki incelemede okunan `ui-blueprint.md`.
- `apps/web-admin/src/data/mockNavigationData.js`.
- `App.jsx`, `components/layout/AppShell.jsx`, `components/workspace/Workspace.jsx`.
- `components/navigation/TopMenu.jsx`, `components/navigation/Sidebar.jsx`.
- `components/layout/CommandPalette.jsx`, `SmartInsightsPanel.jsx`, `StatusBar.jsx`.
- `config/viewOptions.js`, `apps/web-admin/package.json`.
- `modules/sales/VegaSalesInvoiceListScreen.jsx` (1–210), `modules/stock/StockListScreen.jsx` (1–170).
- `modules/finance/CollectionsOverviewScreen.jsx` (1–170), `modules/dashboard/DashboardScreen.jsx` (1–240).
- `services/movementApi.js`, `scripts/web-admin-navigation-smoke.mjs`.
Merkezi repo `melisa-os`: README, şirket ilkeleri, iş kuralları, AI kuralları ve `docs/operations/ecosystem-decisions.md`.
