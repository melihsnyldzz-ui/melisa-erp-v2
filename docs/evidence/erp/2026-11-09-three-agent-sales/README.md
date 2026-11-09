# K06-03 / K05-07 / K05-08 — depo ve satış kabul hazırlığı

9 Kasım 2026, Ajan 2. Bu belge mevcut özgün kabul maddelerine bağlı kaynak incelemesi ve çevrimdışı sentetik test sonucudur. Yeni kabul listesi veya işletme PASS kaydı değildir. TEST/LIVE/Vega, SQL, runtime, kurulum, config, servis, kullanıcı, rol ve ticari veri işlemi yapılmadı. Ortak STATUS, merkez Excel ve üretim kaynakları değiştirilmedi.

## Aday ve özgün dayanak

- Kanonik origin: `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git` (fetch/push eş).
- Münhasır çalışma kökü: `C:\Sirket\ERP\melisa-erp-v2\.worktrees\three-agent-sales-20261109`.
- Dal: `codex/erp-3agent-sales-20261109`; başlangıç ve test edilen HEAD: `00ef3887f4d82451f0d20de6928fb3c3fcae4aa6`; başlangıç çalışma ağacı temizdi.
- Koordinatör bu adayı PR119 bağımlılık zincirinin ucu olarak verdi. Uzak PR'nin güncel açıklığı/review/base/head durumu bu alt görevde bağımsız sorgulanmadı. Adayın kurulduğu veya kabul edildiği sonucu çıkarılmaz; CI zorunluluğunun kullanıcı tarafından kaldırıldığı görev talimatı uygulanır, CI başarısı iddia edilmez.
- Özgün kaynak: `C:\Users\Xaser\Documents\Codex\2026-10-21\b\outputs\01a15d42-a70f-7510-9fce-73ce1cb433e9\Melisa-ERP-Kapsam-ve-Yol-Haritasi-30-10-2026.xlsx`, **Alt Kontroller** satır **53, 54, 61**. Aşağıdaki anlam ve bağımlılıklar koordinatörün bu dosyadan salt okunur aktarımıdır; bu alt görev Excel'i açmadı veya değiştirmedi.

| Özgün madde | Kabul sonucu | Özgün bağımlılık |
| --- | --- | --- |
| K05-07 | Depo ve satışçı geçişleri doğru rol/sırayla; eksik hazırlık çıkış yapmaz. | K05-06, K06-03 |
| K05-08 | Fiş, tek stok düşüşü ve doğru cari borç aynı işlemde. | K05-07, K06-02, K06-05, K06-06, K02-06, K04-04 |
| K06-03 | Gönderen/hazırlayan ve durum geçişi doğru personele bağlı. | K10-02 |

Bağımlılık ID'lerinin hepsinin kapanmış olduğu varsayılmaz. Özellikle aynı ID'nin iskonto gibi dar tarihli eklerde geçmesi bütün özgün maddeyi kapatmaz. Ana kaynaklar: [ERP_FINISH_PLAN](../../../../ERP_FINISH_PLAN.md), [USER_ACCEPTANCE](../../../../USER_ACCEPTANCE.md), [STATUS](../../../../STATUS.md), [depo sözleşmesi](../2026-11-07-desktop-warehouse/README.md).

## Kaynakta bulunan akış ve sınırlar

`apps/api/src/services/desktopSaleWorkflowTransactions.mjs` mevcut iki ürünlü akışta şu geçişleri aynı SERIALIZABLE transaction içinde güncel normal oturum/izin, fiş durumu, opak sürüm ve journal bağıyla yürütür:

| İşlem | Başlangıç → sonuç | Kaynakta gereken hak / aktör kaydı | İş etkisi |
| --- | --- | --- | --- |
| PREPARE | DRAFT → PREPARING | Satış yolu `sales.create`; depo yolu `warehouse.view` + `warehouse.prepare`; `sent_by` gerçek çağıran aktör olur. | Her fiş satırına ACTIVE rezerv; fiziksel stok/cari kesin çıkışı yok. |
| SAVE_CARTONS | PREPARING → PREPARING | Satış yolu `sales.edit`; depo yolu `warehouse.view` + `warehouse.pack`. | Fiş kalemi/ürünü/miktarı bağlı koli; eksik toplam kaydedilebilir, fazla toplam reddedilir. |
| READY | PREPARING → READY | Aynı edit/pack hakları; `prepared_by` gerçek çağıran aktör olur. | Her kalemin koli toplamı fiş miktarına tam eşit olmalıdır. |
| CHECK | READY → CHECKED | Yalnız satış yolu `sales.finalize`; `checked_by` gerçek çağıran aktör olur. | Eksiksiz rezerv ve koli yeniden okunur; çıkış henüz yok. |
| DISPATCH | CHECKED → COMPLETED | Ayrı `desktopWorkflowDraftPrivate.mjs` / normal private dispatch scope'u. | Native kesinleştirme, stok/cari posting, outcome, rezerv DISPATCHED ve journal aynı transaction içinde. |

Depo sözleşmesi CHECK, DISPATCH, taslak/fiş iptali ve finans işlemi kabul etmez; maliyet/fiyat/cari alanları depo DTO'suna eklenemez. Yalnız rol adı kabul kanıtı değildir; güncel hesabın gerçek hakları ve yapılan işlem aktörü esas alınır.

Aktör alanlarının kaynağı açıktır; aynı kişinin birden fazla yetkili adımı yapması kaynak tarafından bütünüyle yasaklanmış değildir. K06-03 için alanların dolu olması, beş gerçek rolün doğru dağıtıldığı anlamına gelmez. `created_by`, `sent_by`, `prepared_by`, `checked_by` ve DISPATCH journal aktörü ayrı okunmalı; özgün kişinin fişi açması ile PREPARE çağıran kişinin `sent_by` olması birbirine karıştırılmamalıdır.

`desktopDispatchSnapshot.mjs` ve `desktopDispatchReadiness.mjs` CHECKED taslak, iki doğru ürün/kalem, tam ACTIVE rezerv, tam koli ve başka taslak rezervlerinden sonraki yeterli stok şartlarını denetler. Sadece pure readiness fonksiyonu gerçek SQL kilidi veya yetki kanıtı değildir. `desktopWorkflowDraftPrivate.mjs` kesinleştirme, doğru döviz/hesap posting'i, outcome okuması ve journal readback'i tamamlanmadan commit etmez; kaynak yolu gerçek SQL atomicity/concurrency kabulünü kendi başına ispatlamaz.

## Yeniden kullanılacak tarihli kanıt

Bu kayıtlar mevcut repo belgelerinden okunmuştur. K06-02 için koordinatörün gösterdiği dış tarihli kanıt dosyaları ayrıca salt okunur incelendi; ayrıntı aşağıdadır. Çalışan runtime bu turda doğrulanmadı.

| Mevcut kayıt | Kanıtladığı dar sonuç | Kanıtlamadığı / açık kalan |
| --- | --- | --- |
| [6 Kasım barkod taslağı](../2026-11-06-desktop-barcode-draft/README.md) | Aynı 92→93→92 sepeti tek fiş15/iki kalem, 2 ADET + 1 ADET, 2,25 USD; normal yenilemede kalıcılık; DRAFT aşamasında stok/cari etkisi yok. | DRAFT kaydı sevk veya tüm üç maddenin kabulü değildir. |
| STATUS, **8 Kasım ürün-stok-fiș izlenebilirliği** | Ayrı kurulu `49792f22` / paket `400bdca5472f` üzerinde aynı fiş15 depo hazırlama/koli/READY, CHECK ve tek native DISPATCH sonrası COMPLETED; stok hareket38/39, ürün10 8→6 ve ürün11 8→7; müşteri hareket16 +2,2500 USD / 90 TRY; USD hesap7 1,455→3,705; açan30002/hazırlayan30007/kontrol30002. | `00ef3887` kurulumu, saf müdür rolü, gerçek çalışan/fiziksel cihaz ve insan kabulü değildir. Dış SQL/screenshot ham kanıtı bu turda yeniden açılmadı. Fiş15 yeniden sevk edilmez. |
| [6 Kasım stok uygunluğu](../2026-11-06-desktop-stock-availability/README.md) | Fiş9 PREPARE ile yalnız rezerv, yenilemede 48/6/42; taslak iptaliyle rezerv serbest, fiziksel stok/cari değişmez. | Kesinleşmiş satış iptali veya satış iadesi değildir. |
| [6 Kasım kayıp satış yanıtı](../2026-11-06-desktop-sale-ack/README.md) | Fiş11 gerçek dispatch commit sonrası yanıt kesilmesi; GUI UNKNOWN, aynı UUID/gövdeyle retry ve bağımsız SQL'de tek stok/cari etki; çift tıklamada tek taslak. | Pending reload/relogin bu tarihli denemede yapılmadı; gerçek kişi kabulü değildir. Yeni adaydaki bütün yolların testi sayılmaz. |
| [6 Kasım dövizli satış](../2026-11-06-desktop-fx-sale/README.md), USER_ACCEPTANCE R1 üç para birimi kaydı | Tarihli USD/USD, EUR/USD, TRY/EUR teknik GUI/SQL ve kayıtlı hesap/kur doğrulaması. | Güncel hedef/persona/fişin doğru hesaba yazıldığının yerine konulmaz. |
| [7 Kasım fazla koli kaynak aşaması](../2026-11-07-desktop-overpack/README.md) ve dış `k06-overpack-install-v1/k06-complete-proof-v1.json` | İlk gerçek 503/UNKNOWN başarısızlığı korunur. Daha sonraki **7 Kasım 04:26 UTC** kurulu teknik kanıt, fiş16'da 1,000 ADET yerine 2,000 ADET koli içeriğine açık normal GUI reddi / sıfır POST, 37 tablo ve 40 identity eşliği; düzeltmeden sonra aynı form SAVE_CARTONS201 ve taslak CANCEL201 / iki rezerv RELEASED / sıfır stok-cari posting gösterir. | Kaynak README'sindeki “kurulu tekrar BEKLİYOR” ara kaydı sonraki tarihli kanıtla aşılmıştır. Özgün Excel satır60 **Tamam** kaydı bu dar teknik kapsamda desteklenir; K06-02 için yeni tekrar gerekmez. Yeni aday kurulumu veya insan kabulü değildir. |
| [7 Kasım depo](../2026-11-07-desktop-warehouse/README.md), [9 Kasım mali sınır](../../../development/desktop-cost-profit-visibility.md) | Kaynakta dar depo hakları/DTO/recovery; sonraki mali sınır belgesi tarihli sekiz depo HTTP yanıtını yeniden kullanır. | Yeni kaynak kurulumu veya geniş persona/gerçek işletme matrisi değildir. |

K05-08'e bağlı K06-05, K06-06, K02-06 ve K04-04'ün özgün tam kabul sonuçları bu alt görevde kapatılmadı. Sadece benzer isimli satış/FX/recovery kanıtıyla bu bağımlılıklara PASS verilmez. K05-06 ve K10-02 için de koordinatörün özgün madde bazında kararı gerekir; mevcut belge bir karar talebi veya yeni kurulum izni değildir.

### K06-02 tarihli kanıtın salt okunur düzeltmesi

Koordinatör özgün Excel **Alt Kontroller satır60** için **Tamam** durumunu ve şu kanıtı bildirdi: `C:\Users\Xaser\Desktop\ERP\kurulum\k06-overpack-install-v1\k06-complete-proof-v1.json`. Bu alt görev dosyayı ve bağlı kayıtları okudu; hiçbir TEST isteği veya SQL bağlantısı açmadı. Kanıt zamanı `2026-11-07T04:26:13.769Z`, kaynak `b994039da3c456821a237496c17d430213f1c54c`, paket `ae023451143b94b8449e731cf72304ad517f70126f5ae6c98b5a6a053ce73032`.

- Özet dosyasına bağlı sekiz kanıt dosyasının SHA256 değerleri mevcut dosyalarla **8/8 eşleşti**; yeniden çalıştırılmadan kullanılan eski eksik-koli kanıtının SHA256 değeri de eşleşti.
- `overpack-no-post.json` sıfır olay / `postCount:0`, kesilmemiş kayıt ve düzenlenebilir aynı form bildiriyor. Saklı normal DOM, fişte 1,000 ADET olan ürüne 2,000 ADET girildiğini ve ürün koduyla açık fazla-miktar mesajını gösteriyor. Bu özel örnek **tek kolideki ürün adedinin aşılmasıdır**; birden fazla kolinin toplamına yönelik sentetik test ayrı tutulur.
- `before-overpack-outcome.json` ile `after-overpack-outcome.json` içindeki 37 tablonun sayım/satır hash'leri ve 40 identity kaydı birebir eşleşti. İş verisi SHA, metadata SHA/JSON, güvenlik SHA/JSON, izin/ayar identity alanları da birebir aynı.
- Düzeltme ve taslak iptalinin saklı ağ kayıtlarında aynı fiş16 için SAVE_CARTONS201 ve CANCEL201 bulunuyor. `sale-cleanup-business.json` CANCELLED fiş, iki RELEASED rezerv, fiziksel stok8/8 ve sıfır stok/cari posting gösteriyor. Bu temizlik önceki reddin yazmasız karşılaştırmasından sonraki ayrı izinli tarihli işlemdir.
- İlk 503/UNKNOWN denemesi başarı diye yeniden etiketlenmedi; sonraki kurulu açık ret kanıtı kaynak README'sinin bekleme aşamasını tamamlamıştır. İnsan kabulü özette `false`; bu sonuç yalnız K06-02'nin tarihli ajan teknik kapsamını destekler. Yeni adayın kurulmuş olduğu sonucunu doğurmaz; fiş16 veya önceki eksik-koli senaryosu yeniden denenmez.

## Bu turdaki çevrimdışı doğrulama

Test edilen HEAD yukarıdaki `00ef3887…`; Node **v24.15.0**. Üretim dosyası değişikliği yok. Mevcut `scripts/ci/offline-guard.cjs` tüm test yüklenmelerinden önce korundu; ortamdan SQL/provider ayarlarını ayıklar, dış ağ/SQL/TLS erişimini ve alt süreç yolunu reddeder. VM servis testleri sahte sürücüyle bellek işlemi kullanır; gerçek SQL Server değildir. Hosted CI, derleme veya kurulu GUI testi çalıştırılmadı.

Komut, repo kökünden:

```powershell
$testFiles = @(
  'packages/shared/src/desktopWarehouse.test.mjs',
  'apps/api/src/services/desktopWarehouseWorkflowTransactions.test.mjs',
  'apps/api/src/services/desktopSaleWorkflowTransactions.test.mjs',
  'apps/api/src/services/desktopWarehouseService.test.mjs',
  'apps/api/src/services/desktopDispatchReadiness.test.mjs',
  'apps/api/src/services/desktopDispatchSnapshot.test.mjs',
  'apps/sites-workflow/src/workflow/desktopWarehouseView.test.mjs',
  'apps/sites-workflow/src/workflow/desktopPackingRecovery.test.mjs',
  'apps/sites-workflow/src/workflow/desktopWorkflowScreen.test.mjs',
  'apps/sites-workflow/src/workflow/desktopWorkflowClient.test.mjs'
)
node --experimental-vm-modules --require ./scripts/ci/offline-guard.cjs --test --test-isolation=none @testFiles
```

**Sonuç: 10 dosya, 74 PASS / 0 FAIL / 0 SKIP; exit 0.** Tek koşudur; önceki tarihli sayımlarla toplanmaz. Tam yerel başarı günlüğü ignored `.codex_tmp/three-agent-sales-offline-tests.txt` altında bırakıldı; kaynak teslimine dahil değildir. Yeni test yazılmadı: mevcut testler aşağıdaki hazırlık risklerini doğrudan kapsıyor.

| Kapsanan risk | Bu turdaki kaynak testi | Gerçek kabul için kalan |
| --- | --- | --- |
| Hazırlanmamış/eksik kolili/yanlış durumlu fiş çıkışı | `desktopDispatchReadiness`, `desktopDispatchSnapshot`, `desktopSaleWorkflowTransactions`: READY yerine CHECKED, eksik/fazla koli, RELEASED rezerv ve ürün ikamesi reddi. | Normal persona ekranı ve bağımsız readonly native etki okuması; mevcut başarının gereksiz tekrarı yok. |
| Yanlış aktör, geri alınmış izin, stale sürüm veya UUID gövde değişimi | Sale/warehouse transaction ve warehouse service testleri committed bellek durumunun korunduğunu doğrular. | Güncel kurulu auth/rol matrisi, iki normal oturum ve gerçek SQL concurrency ayrı. |
| Depo aktörünün CHECK/dispatch/iptale taşması; mali veri sızması | `desktopWarehouse.test` operasyon allowlist'i ve fazla mali/cari alan reddi; servis DTO/replay ve güncel warehouse hakları. | Normal gerçek hesap/HTTP retleri tarihli kanıtla eşleştirilir; ek hak verilmez. |
| Fazla koli / toplamın iki kolide aşılması | Shared sözleşme ve normal workflow ekran testi; UUID/journal/POST öncesi durur; aynı form düzeltilebilir. | K06-02'nin kurulu açık ret/sıfır POST/37 tablo/40 identity teknik kanıtı yukarıda doğrulandı ve yeniden kullanılır. Çoklu koli toplamı sentetik kapsamı gerçek tek-koli denemesiyle karıştırılmaz; insan kabulü ayrı. |
| Kayıp yanıtın ikinci rezerv/etki yaratması | PREPARE lost-ACK replay, actor/body bağı; client remount/retry aynı istek; durable no-commit çiti. | Bu koşu native satış posting'ini yürütmedi. Tek stok/cari dispatch etkisi için tarihli fiş11/15 kanıtı ve gerekiyorsa güncel yetkili eksik vaka ayrı. |
| COMMITTED veya NOT_COMMITTED sonrası güncel fiş okunamaması | Depo view: kirli koli ve yeniden okuma hedefi korunur; stale sürümle yeni yazma/otomatik POST yok. | Kurulu normal GUI'deki gerçek okuma kesintisi ve oturum yenileme ayrıca. |
| Taslak iptalinde fiziksel etki veya tekrarlı audit | Sale transactions: rezerv RELEASED, tek audit, lost-ACK replay; posted/finalized taslak iptali reddi ve audit hatasında rollback. | Kesin satış iptali/iadeler bu dar hazırlık kontrolüyle kapanmaz. |

## Eksik gerçek kabulü somutlaştıran kayıt sırası

Bu bölüm gelecekte yetkili sahibin uygulayacağı eksik denemenin kanıt biçimidir; bu alt görev hiçbirini çalıştırmadı. Tamamlanmış fiş15 ve tarihli başarılı satışlar yeniden oluşturulmaz veya yeniden sevk edilmez.

1. Önce mevcut aday/paket/hedef kimliği ile normal oturumun güncel kişi ve uygulama hakları ayrı doğrulanır. Açık UNKNOWN veya önceki ödeme/alış isteği mevcut normal kurtarma yoluyla uzlaştırılmadan yeni yazan senaryo başlamaz. Başka aktörün pending'i taşınmaz veya silinmez.
2. Mevcut tarihli fiş15 kanıtı K06-03 aktör alanları ve K05-07 durum sırası için yeniden kullanılır. Eğer eksik persona senaryosu gerekiyorsa yalnız ayrıca yetkilendirilmiş sentetik fiş ve güncel hakları belirli satışçı/depo/kontrol kişisi kullanılır; salt rol etiketi veya kişinin %5 fiyat hakkı son kontrol yetkisi sayılmaz.
3. Eksik hazırlık/eksik koli/yanlış sıra/depodan CHECK-DISPATCH negatifleri, açık beklenen ret ve native fiş/stok/cari/journal değişmezliğiyle bağlanır. HTTP503 tek başına no-commit sayılmaz; UNKNOWN aynı UUID/gövdeyi korur ve normal resolver/retry sonucu beklenir.
4. Pozitif geçişlerde kayıt kimliği/sürümü, `created_by/sent_by/prepared_by/checked_by`, ilgili journal aktörü ve işlemler arası stok/rezerv/cari durumu tutulur. PREPARE/READY/CHECK aşamasında fiziksel stok/cari posting'i olmamalı; yalnız doğru DISPATCH bir kez fiziksel düşüş ve seçili müşteri/döviz hesabına kayıtlı tutarı doğurmalıdır.
5. K05-08 için fiş durumu, her kalemin adet/ana birimi, kaynak fiş kimliğiyle bağlı tek hareket kümesi, doğru hesap/döviz/kur snapshot'ı ve tek DISPATCH journal aynı sonuçta eşleştirilir. Tam yenileme/tekrar açma ve aynı isteğin retry/resolve sonucunda ikinci stok/cari etki olmamalı. Kısmi failure/commit sonrası ACK kaybı ayrı sonuç olarak tutulur; `UNKNOWN` başarısızlık veya başarı diye uydurulmaz.
6. İnsan kabulünde kişinin adı/tarihi/normal cihazı/işletme sonucu, ajan kaynak testi ve tarihli teknik GUI/SQL sonucundan ayrı kaydedilir. Fiziksel terminal/okuyucu, saf müdür rolü veya LIVE bu belgeyle kabul edilmiş sayılmaz. Özgün kapanış sayaçları değişmez.

**Teslim kararı:** K06-03/K05-07/K05-08 için kanıt ve negatif senaryo hazırlığı hazır; bu turdaki kaynak kontrolleri 74/74. Kurulu yeni aday, bütün bağımlılıkların kapanışı, gerçek kişi/cihaz ve insan kabulü **BEKLİYOR**. Üretim düzeltmesi gerektiren doğrulanmış bir bulgu bu dar incelemede raporlanmadı; gerçek SQL atomikliği ve persona matrisi çevrimdışı sonuçtan çıkarılamaz.
