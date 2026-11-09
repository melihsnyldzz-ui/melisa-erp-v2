# K07 ve K08 kaynak ve kabul açıklıkları

9 Kasım 2026. Ajan 3 salt okunur incelemesi. Kanonik origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`; münhasır worktree `.worktrees/three-agent-goods-finance-20261109`, branch `codex/erp-3agent-goods-finance-20261109`, aday HEAD `00ef3887f4d82451f0d20de6928fb3c3fcae4aa6`. Başlangıç temizdi. Bu aday #119 başıyla aynıdır ve kurulu/kabul edilmiş sayılmaz.

K07 ve K08 bütünü açık kalır. Önceki yerel sentetik TEST'te TRY mal kabul/alış ile tahsilat/ödeme için dar olumlu kurulum kanıtları vardır. K07-01 çok satırlı sayım taslağı da ayrı kurulu kanıta sahiptir. Bunlar İlker'e gönderme/düzeltme, kısmi teslim, FX alış/finans, avans, banka/kart, günlük kasa ve iptal gibi özgün koşulları kapatmaz. İnsan ve fiziksel cihaz kabulü bu teknik kanıtlardan ayrı kalır.

## Özgün kapsam ve kanıt sınırı

Özgün ölçüt kaynağı: `C:\Users\Xaser\Documents\Codex\2026-10-21\b\outputs\01a15d42-a70f-7510-9fce-73ce1cb433e9\Melisa-ERP-Kapsam-ve-Yol-Haritasi-30-10-2026.xlsx`, `Alt Kontroller!A67:N86`. Tarihsel durum hücreleri güncel sonuç gibi kullanılmadı. openpyxl yerel Python'da bulunmadığı için dosya paket kurmadan standart ZIP/XML okuyucuyla salt okunur ayrıştırıldı. Excel değiştirilmedi.

GitHub PR açıklamaları 9 Kasımda doğrudan okundu. Aşağıdaki kurulum sonuçları PR sahibinin tarihli bildirimidir; yerel özel kanıt dosyaları bu ajan tarafından açılmadı ve bugünkü runtime yeniden gözlenmedi. Kaynak hakkında sonuçlar belirtilen adayın doğrudan dosyalarıyla kontrol edildi. Mevcut graph indeksi başka worktree'ye ve 8 Kasıma aittir; coverage metadata_changed döndü. Graph yalnız yön bulmaya yardım etti, mevcut adayın kanıtı olarak kullanılmadı.

| PR | Güncel durum ve tarihli teknik kanıt | Açık kabul |
| --- | --- | --- |
| [89](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/89) | Açık/taslak; head eb54f666. V6 normal ekranda aynı korunmuş UUID ile 12 ADET/144 TRY; stok45→57, maliyet8→8,8421; kesinleştirme tedarikçi/TRY0→144, ikinci stok artışı yok. Üç gerçek HTTP replay COMMITTED. Son bildirilen kurulu kaynak568f2e9e/paket24b4319f. | Başarı sonrası finalize ACK kaybı kanıtlanmadı. Alış PDF ve tedarikçi borç kartı açık bildirildi. O aşamadaki native actor NULL kaydı tarihsel bulgudur; sonraki audit değişiklikleri nedeniyle bugünkü davranış diye genellenmez. |
| [90](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/90) | Açık/taslak; head9417197b. V7 gerçek rollback/ayrı observer/apply/TLS ve normal +20 TRY tahsilat/-10 TRY ödeme; kasa0→20→10, müşteri104,32→84,32, tedarikçi144→134. Paketde8f1877, 43 tablo/19 ERP izni. | Başarı sonrası ACK kaybı ve COMMITTED isteğin harici replay'i kanıtlanmadı. Yalnız TRY baz kart/cash; FX ve geniş finans açık. |
| [95](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/95) | Açık/taslak; headcb1223e2. Mal kabul/finans ekran içi onay;33 kaynak testi bildiriliyor. | PR açıklaması normal kurulu ekranı doğrulamıyor. Sonraki bir sürümün bu onayı içerdiği ancak kendi paket/normal ekran kanıtıyla söylenebilir. |
| [111](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/111) | Açık/taslak; heade7711772. Kurulu paketeafe0041. TRY/USD vadesi bilinmiyor; eksik vade ile tahsilat preflight yazmasız durdu;47 snapshot alanı aynı. | Ayrı yetkili yönetici yok; pozitif vade tanımı/satış snapshot'ı/en erken vadeye gerçek tahsilat NOT_RUN. Saf örnek gerçek kabul değildir. |
| [112](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/112) | Açık/taslak; head81f74771. Kurulu paket1623edff. İki ürün/multiline not; server öncesi kesinti ve NOT_COMMITTED; create201 yanıtı düşürülüp aynı UUID tek taslak; update/reload kanıtı. | Sıfır miktar, gerçek bilinmeyen barkod, dar rol/yarış, submit/approve/finalize ve insan/cihaz NOT_RUN. |
| [119](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/119) | Açık, taslak değil; head00ef3887. Tedarikçi pasif/aktif durumu, rowversion/UUID/audit recovery kaynakta. | Kurulum bekliyor. Dört yeni dar supplier UPDATE sütunu hakkı ayrı değerlendirilmelidir. Önceki müşteri edit izinleri bunun onayı değildir. |

Repo `2026-11-07-desktop-goods-v6/README.md` ve `2026-11-07-desktop-finance-v7/README.md` dosyaları bu sonraki PR kurulum bildirimlerinden eski aşamaları anlatır. Oradaki source-only ifadeleri tek başına son tarihli dar kurulu kanıtı yok saymak için kullanılamaz. Tersi de geçerlidir: tarihsel kurulum bu adayın ve tüm özgün kapsamın kurulduğunu kanıtlamaz.

## K07 alt kontrolleri

| ID ve özgün koşul | Aday kaynak ve dar kanıt | Kalan kabul ve bağımlılık |
| --- | --- | --- |
| K07-01 Personel mal sayımı: çok satırlı ürün/adet ve notlar taslakta korunur | `docs/development/desktop-count-draft.md`, `desktopCountService.mjs`, `desktopCountRoutes.mjs`; yalnız kendi audit taslağı, fiyatsız ürün seçimi. #112 olumlu kurulu taslak/reload/update/kayıp-yanıt kanıtı. | Dar teknik olumlu koşul destekli; insan/cihaz ve belirtilen gerçek negatifler ayrı. Submit/alış kabulü değildir. |
| K07-02 İlker'e kontrole gönder: gönderen/ürün/miktar normal ekranına ulaşır | Mevcut desktop-count API yalnız product/list/read/create/update/resolve sunuyor. Kendi aktör taslağı başka aktörün onay kuyruğuna teslim edilmiyor. | Bu normal V7 yüzeyinde gönderim ve İlker'in doğrulanmış normal kimlik/rol/atama okuması eksik. Tarihsel başka pilotun15/16 kullanıcıları devralınmaz. |
| K07-03 Onay/düzeltmeye gönder: rol/gerekçe ve önceki sayım korunur | Goods ayrı draft→accepted onayı sunar, goods.approve denetler. Count audit taslağında submit/reject/correction geçişi yok. | K07-02 ile bağlı düzeltme turu/aynı sayım lineage'ı, gerekçe ve bağımsız yetkili gerçek kabulü eksik. Genel onay düğmesi bu koşul değildir. |
| K07-04 Tek stok girişi ve kısmi teslim: kalan açık kalır | #89 tek stok etkisi destekli. `desktopGoodsApprovalService.mjs` kaydedilmiş tüm preview satırını bir defa işler; body yalnız expectedVersion/requestId. Shared modelde kısmi miktar hesabı testi var. | K07-03 bağımlılığı açık. Shared kalan-miktar modeli normal owner'ın kısmi teslim API/ekranı değildir; beklenen/teslim/kalan ve birden fazla kabul gerçek kanıtı eksik. |
| K07-05 Kabulden alış belgesi: doğru kabul/tedarikçi, ikinci stok yok | #89 receipt2/native purchase1 ve tek stok etkisi. `desktopGoodsService.mjs` private scoped native draft/finalize; `desktopGoodsAssembly.mjs` dar bağ. | K07-04'ün geniş koşulu açık. Kısmi teslim ve düzeltme soyuyla bağlı belge; farklı tedarikçi/hesap gerçek negatifleri; güncel pakette normal kabul ayrı. |
| K07-06 Fiyat farkı/tedarikçi iskontosu: anlaşma/listeden fark ve yetkili gerekçe, ardışık indirimler | `desktopGoodsReceiptModel.mjs` sıralı line/document/supplier discount ve largest remainder modeli var. Normal V6 açık TRY birim alış fiyatı ister. | Saf hesap testi anlaşma/listeden fark gösterimi veya yetkili gerekçeli kabul değildir. Normal fiyat-farkı onayı ve gerçek net maliyet kabulü eksik. |
| K07-07 Dövizli alış/kur snapshot'ı: güncel kur eski belgeyi değiştirmez | Shared projection TRY/USD/EUR ve snapshot hesaplar. Normal goods owner/approval komutu TRY, rate1 sınırındadır. | FX normal seçimi/hesabı/native invoice/maliyet snapshot'ı/kur değişimi sonrası eski belge korunumu eksik. FX satış kanıtı alış yerine geçmez. |
| K07-08 Tedarikçi borcu ve alış çıktısı: doğru döviz hesabı, fiş/cari eş | #89 yalnız TRY0→144 tek borç etkisi. #90 aynı tedarikçiden ödeme geçmişi dar destek. | K07-05/06/07'ye bağlı; FX/iskonto/fiyat farkı, normal borç kartı ve alış çıktısı/PDF kapsamı açık. |
| K07-09 Alış iptali/yanıt kaybı/replay ikinci veya yanlış etki yaratmaz | UUID/body journal ve #89 gerçek HTTP COMMITTED replay var;80 test grubu UNKNOWN/reload/readback/replay'i sentetik sınar. | Goods normal router create/approve/finalize dışında alış cancel sunmuyor. Gerçek ters kayıt, maliyet/stok/cari eşleşmesi ve başarı sonrası finalize ACK kaybı eksik. |

## K08 alt kontrolleri

| ID ve özgün koşul | Aday kaynak ve dar kanıt | Kalan kabul ve bağımlılık |
| --- | --- | --- |
| K08-01 Müşteri tahsilatı: doğru müşteri/döviz hesabı, stok aynı | #90 tarihsel normal TRY tahsilat ve stok korunumu. `desktopFinanceService.mjs` native+cari+cash+journal aynı tx. | K05-08'e bağlı. #111 sonrası yeni tahsilat preflight tüm vade/audit/hesap mutabakatını ister; eksik vade yazmasız durur. Eski +20TRY kanıtı güncel pozitif dağıtım değildir. USD/EUR ve insan kabulü açık. |
| K08-02 Tedarikçi ödemesi: doğru borç/yöntem, stok yok | #90 normal TRY cash10 ödeme/tek native+cari+cash hareketi. | K07-08'e bağlı. Doğru FX hesabı, banka/kart yöntemi ve geniş tedarikçi belge borcu tamamlanmadı. |
| K08-03 Avans/fazla/kısmi ödeme: fazla avans/alacakta, kalan doğru | `desktopFinancePlan.mjs` borçtan fazla tutarı ve cash yetersizliğini reddeder. #90 kısmi20/10 dar borç azalması. | Avans/fazla ödemeyi tutacak normal işlem mevcut bu planda yok. Mevcut koruma sessizce gevşetilmez; ayrı avans kaydı/bağlantı ve sonraki mahsup gerekir. |
| K08-04 Opsiyonel belge dağılımı: genel cari/fişe bağlı ayrı, çift dağıtım yok | Plan invoiceId alanı ve invoice identity kontrolleri içerir. Güncel collection store invoiceId:null ister ve en erken vadeye tam dağıtır; finans ekranı null gönderir. | Özgün opsiyonel bağlama ile güncel zorunlu oldest-due kuralı aynı şey değildir. Güncel karar korunarak genel avans/cari ve opsiyonel belge davranışının ürün kapsamı netleştirilmeli. Pozitif gerçek tahsilat/dağıtım kabulü ayrıca açık. |
| K08-05 Nakit/banka/kart: yalnız nakit çekmece etkiler | Normal plan finance.type cash ve TRY ister; ekran Kasa seçtirir. | Banka/kart model, hesap, settlement ve nakitten ayrı normal akış/gerçek korunumu eksik; cash etiketini yönteme çevirmek yetmez. |
| K08-06 Tek kasa/ayrı döviz çekmeceleri: günlük TRY/USD/EUR açılış/sayım | #90 tek sıfır TRY cash hesabı ve hareketler. | Günlük kasa oturumu, opening/closing, üç ayrı çekmece ve fiziksel sayım kabulü mevcut desktop yüzeyinde sağlanmıyor. |
| K08-07 İç transfer/masraf: transfer gelir/gider değil, neden/tutar doğru | Desktop finance router yalnız collections/payments/options/list/preflight sunuyor. | Transfer/expense ayrı muhasebe yönü, yetki, gerekçe, karşı hesap ve journal/reversal gerekir. Önceki farklı pilot API genel kurulu kanıt sayılmaz. |
| K08-08 Gün sonu mutabakatı: fark gerekçe/yetki, fişler-kasa eş | #90 dar20/10 kasa-cari bağı bağımsız SQL ile bildiriliyor. | Günlük oturum/fiş toplamı, sayım farkı gerekçesi ve yetkili kapanış gerçek kabulü yok. K08-05/06/07 tamamlanmadan kapsam kapanmaz. |
| K08-09 Tahsilat/ödeme iptali: gerekçeli ters kayıt, geçmiş korunur | Desktop finance router collection/payment create ve liste sunar, cancel sunmaz. | Normal V7 cancel yetkisi/native+cari+cash/allocation inverse ve replay/role/negative kabulü eksik. Eski iptal servisini mount etmeden var sayma. |
| K08-10 Belirsiz işlem/tekrar: journal doğrulama öncesi kapanmaz, çift ödeme yok | Frontend durable pending, UUID/body ve tekrar onayı; pure/controller tests PASS. #90 iki precommit kesintide yazmasız snapshot ve özgün tekrar. | #90 başarı sonrası ACK kaybı/COMMITTED harici replay kanıtlamıyor. K07-01 count lost-ACK kanıtı finans yerine geçmez. Gerçek ayrı tx eşzamanlılık/oturum kaybı/replay kabulü açık. |
| K08-11 Hareket/makbuz/ekstre: filtre/sayfa/fiş ve ayrı döviz tam kayda dayanır | `desktopFinanceService.mjs:43` listesi page ile current_actor journal COMMITTED sonuçlarını native readback'e bağlar;#90 logout/login sonrası iki makbuz açılmış. | Bu tüm şirket ekstresi değildir. Tarih/cari/yöntem/döviz filtreleri, kapsam doğruluğu, makbuz çıktısı ve ayrı döviz toplamları gerçek normal kabulü açık. |

## Bağımlılıklar ve çakışma alanları

Özgün kritik sıra K07-03→04→05→08; K07-06/07 de08'e girer; K08-01 K05-08'e, K08-02 K07-08'e bağlıdır. Sayım taslağı olumlu kanıtı ile gönderim/onay lineage'ı arasındaki boşluk ilk anlamlı mal kabul dilimidir. Gönderen ve onaylayan gerçek normal kimliklerin yetki/atama kararını kaynak yetkisiyle uydurmak mümkün değildir.

Finansta önce kapsam kararı korunarak güncel vade setter/pozitif dağıtım engeli ele alınmalıdır. Bilinmeyen/eski bağsız finansı sıfır/vade30 ile doldurmak veya preflight'i kaldırmak çözüm değildir. Avans, FX, banka/kart ve günlük kasa ayrı kayıt türleri gerektirir; TRY cash borç kapatma yolunu genişletmek kapsamlı bir iş kuralı değişikliğidir.

Muhtemel ortak dosyalar: `apps/api/src/desktopWriteApplication.mjs` montajı, auth/core private scope ve V7 SQL politika/manifest pinleri, native invoice/movement motorları, frontend shell/finance/goods controller'ları ve shared decimal/FX kuralları. #119 supplier status değişikliği aktif tedarikçi seçiminde goods/finance ile kesişir; supplier/entity/account kökeni ve rowversion tekrar kontrolü korunmalıdır. #118 customer-edit ve #119 supplier-status sütun izinleri ayrı; bu ajan bunları uygulamadı. Ortak üretim dosyasına geçmeden koordinatör sahiplik tahsisi gerekir.

Kurulum sahibi için sonraki gerçek kabul paketinde exact kaynak/paket/native hedef, mevcut kullanıcı izinleri, başarı/ret/UNKNOWN özgün UUID'leri ve ayrı tamamlanan readback süreçleri bağlanmalıdır. Daha önce kabul edilmiş geçerli TRY alış/satış işlemleri yalnız kanıtı tazelemek için tekrar oluşturulmaz. Bu rapor yeni SQL/TEST veya credential yetkisi üretmez.

## Bu ajan tarafından çalıştırılan kaynak kontrolü

12 mevcut dosya üzerinde `node --test`: 80 PASS,0 FAIL,0 SKIP, çıkış0. Süre233 ms. Yeni test eklenmedi. Kapsam: shared goods receipt modeli; goods planning/mutation; finance plan/selection/receipt/readback; goods controller/view; finance controller/view/retry consent. SQL Server, gerçek HTTP/native driver, kurulu normal GUI ve insan/cihaz koşusu yapılmadı. CI kullanıcı tarafından bu görev için zorunlu olmaktan çıkarıldığı için yeni hosted koşu istenmedi.

Bu koşuda `offline-guard` veya ağ/SQL erişimini süreç düzeyinde engelleyen preload kullanılmadı. Dolayısıyla sonuç guard uygulanmış çevrimdışı koşu olarak sunulmaz. Seçilen dosyalar saf hesap/kontrolör ve bağımlılığı enjekte edilen fixture testleridir: SQL okuyucu/mutation testleri kendi sahte `Request/query` nesnelerini, ekran testleri sahte controller/transport ve DOM nesnelerini kullanır. Gerçek SQL connector/app assembly/native entegrasyon testleri bu komuta alınmadı. Bu sınır test seçimi ve fixture yapısına dayanır; ağ/SQL çıkışının teknik olarak kapatıldığına dair kanıt değildir.

Çalışma dizini yukarıdaki münhasır worktree'dir. Tam komut:

```powershell
node --test packages/shared/src/desktopGoodsReceiptModel.test.mjs apps/api/src/services/desktopGoodsReceiptPlanning.test.mjs apps/api/src/services/desktopGoodsMutationSql.test.mjs apps/api/src/services/desktopFinancePlan.test.mjs apps/api/src/services/desktopFinanceSelection.test.mjs apps/api/src/services/desktopFinanceReceiptRead.test.mjs apps/api/src/services/desktopFinanceReadback.test.mjs apps/sites-workflow/src/workflow/desktopGoodsPurchase.test.mjs apps/sites-workflow/src/workflow/desktopGoodsPurchaseView.test.mjs apps/sites-workflow/src/workflow/desktopFinanceController.test.mjs apps/sites-workflow/src/workflow/desktopFinanceView.test.mjs apps/sites-workflow/src/workflow/desktopFinanceRetryConsent.test.mjs
```

Koordinatör aynı 12 dosyayı ikinci kez mevcut `offline-guard.cjs` preload'u ve test isolation kapalı olarak çalıştırdığını bildirdi: 80 PASS,0 FAIL,0 SKIP, çıkış0. Bu ikinci sonuç koordinatörün korumalı kaynak koşusudur; ilk korumasız koşu yukarıda kendi koşullarıyla korunur. Korumalı kaynak testi de gerçek SQL Server/native sürücü, kurulu GUI veya insan kabulü oluşturmaz. Koordinatörün bildirdiği tam komut:

```powershell
node --require ./scripts/ci/offline-guard.cjs --test --test-isolation=none packages/shared/src/desktopGoodsReceiptModel.test.mjs apps/api/src/services/desktopGoodsReceiptPlanning.test.mjs apps/api/src/services/desktopGoodsMutationSql.test.mjs apps/api/src/services/desktopFinancePlan.test.mjs apps/api/src/services/desktopFinanceSelection.test.mjs apps/api/src/services/desktopFinanceReceiptRead.test.mjs apps/api/src/services/desktopFinanceReadback.test.mjs apps/sites-workflow/src/workflow/desktopGoodsPurchase.test.mjs apps/sites-workflow/src/workflow/desktopGoodsPurchaseView.test.mjs apps/sites-workflow/src/workflow/desktopFinanceController.test.mjs apps/sites-workflow/src/workflow/desktopFinanceView.test.mjs apps/sites-workflow/src/workflow/desktopFinanceRetryConsent.test.mjs
```

Dosyalar:

- `packages/shared/src/desktopGoodsReceiptModel.test.mjs`
- `apps/api/src/services/desktopGoodsReceiptPlanning.test.mjs`
- `apps/api/src/services/desktopGoodsMutationSql.test.mjs`
- `apps/api/src/services/desktopFinancePlan.test.mjs`
- `apps/api/src/services/desktopFinanceSelection.test.mjs`
- `apps/api/src/services/desktopFinanceReceiptRead.test.mjs`
- `apps/api/src/services/desktopFinanceReadback.test.mjs`
- `apps/sites-workflow/src/workflow/desktopGoodsPurchase.test.mjs`
- `apps/sites-workflow/src/workflow/desktopGoodsPurchaseView.test.mjs`
- `apps/sites-workflow/src/workflow/desktopFinanceController.test.mjs`
- `apps/sites-workflow/src/workflow/desktopFinanceView.test.mjs`
- `apps/sites-workflow/src/workflow/desktopFinanceRetryConsent.test.mjs`

Bu ajan incelemesinin tamamlandığı anda tek değişiklik bu analiz dosyasıydı; dosya untracked bırakıldı. Ajan incelemesi sırasında commit/push/PR/STATUS, başka worktree, SQL, TEST/LIVE/Vega/runtime/config/servis/credential ve ticari veri yazması yapılmadı. Koordinatör bu belgeyi daha sonraki kaynak teslimine dahil edebilir; bu paragraf o sonraki teslimin durumunu tarif etmez.
