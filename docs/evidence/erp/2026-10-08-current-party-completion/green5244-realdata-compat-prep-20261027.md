# 5244 yeşil ekran + gerçek veri — dar uyumluluk adayı

27 Ekim 2026; mevcut ERP03/A01–B02 kapsamıdır. **Kaynak adayı hazır, birleşik çalışan paket hazır değildir.** Yeni Goal/ajan/takip sistemi yoktur. 5244/4194/5194/4144, native, profil/config, hesap/rol/grant, gerçek kart/bakiye, CRM veya Vega değiştirilmedi. Restore/deploy/restart yapılmadı.

## Korunan iki kurulum

| Katman | Günlük 5244 | Gerçek-verili TEST125 |
|---|---|---|
| Web/API/native | 5244 / 4194 / 4196 | 5194 / 4144 / 4146 |
| DB | MELISA_ERP_CLEAN_TEST_20261022, sentetik | MELISA_ERP_SIRKET_TEST_20260929_01 |
| API | 349fae354e2a, manifest3aa51a25 | edb3c8915ef0 + katalog0a221778, manifest0927de3c |
| Web | 349 + kabul edilmiş CSSb6de5305 + finans okuma10b6535a, manifestebb1ce99 | TEST125 katalog uyum paketi |
| Kullanıcı | Mevcut normal hesabı ve rolü CLEAN'e ait | Aynı kullanıcı adına/role eşdeğer mevcut hesap dar sorguda bulunmadı |
| İşlemler | Clean wrapper, sabit sentetik gün/hesap ve yetki sınırları | Mevcut native/Goal8 kapsamı ve farklı kimlikler |

Bu tablo önceki gerçek süreç/health/manifest incelemesini kullanır; aynı geniş envanter veya eski testler tekrar başlatılmadı. Normal hesap için yalnız iki DB'deki mevcut kullanıcı/rol kimliği dar SELECT ile karşılaştırıldı; parola/hash/token/korumalı oturum okunmadı. Aynı sayısal kullanıcı ID'si farklı kişilere/rollere ait olabilir; eşleştirme veya mevcut kullanıcı yerine yönetici/İlker ödünç alma yapılmadı.

## Gerçek kod farkı

- 5244 `testAdminSession.resolveTestApiBase`, 5244→CLEAN4194 eşliğini zorunlu tutar. 5244→4144 reddedilir; otomatik admin açılmaz. Bu kapı değiştirilmedi.
- 5244 katalog modeli son PRODUCT-b40b0745 zincirini reddediyor. TEST125'in kabul edilmiş modeli ve backend doğrulayıcısı aynı zinciri kabul ediyor. Eski kart/187/sonraki stok halkaları silinerek uyum üretilmedi.
- Günlük finansın `cleanSyntheticServer` ve `cleanStoreDayStore` adapterleri sonlu sentetik ortam/hesap/gün kapsamları içerir. Yalnız CORS, port, synthetic bayrağı veya DB adı değiştirilemez. CLEAN auth + TEST125 ticari okuma şeklinde iki-DB akışı oluşturulmadı.
- Normal kart sunumundaki `currencyAccountPresentation`, UNKNOWN döviz hesabını “Bilinmiyor” gösterir ve legacy scalar0/ham BAKIYE'yi ikame etmez. TRY/USD/EUR ve rol bazlı B/A korunur. Ancak normal generic müşteri/tedarikçi DTO'ları ve create yolu zero/default davranışı içerir; bu nedenle 5536'nın native UNKNOWN/NOT NULL problemi kapanmış değildir.

## Dosya adayı

`scripts/canonical/prepare-green5244-realdata-compat.mjs` yalnız pinli üç manifesti ve seçili kaynak dosyaları okur; mevcut release'lere yazmaz, bağımlılık kurmaz, API/SQL/servis veya credential kullanmaz. Çıktı `UNBUILT_SOURCE_OVERLAY_NOT_INSTALLABLE`, `installed=false`, `executionAllowed=false` olarak mühürlenir. Hedef DB teknik varsayım olarak TEST125'tir; 5244'e kurulmuş veya nihai hedef seçilmiş değildir.

Private aday:
`C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/source-candidate-v2/`

Üç dosya, mevcut kabul edilmiş TEST125 paketinden hash-eş yeniden kullanıldı:

1. `apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs` — eski 5244 katalog doğrulayıcısının dar değişimi.
2. `apps/api/src/services/currentProductCatalogContext.mjs`
3. `apps/api/src/services/finalCatalogContext.mjs`

Son iki dosya frontend'in import ettiği **saf ortak doğrulayıcılardır**; API server veya CLEAN backend'i gerçek veri backend'i ilan etmez. İlk tek-dosyalı probe bu bağımlılıklar eksik olduğu için geçmedi; v1 korunur, v2 doğru import kapanışını içerir. Mevcut motor/validator tekrar geliştirilmedi.

`candidate.json` üç manifest, önce/sonra dosya hash'leri, bağlam kanıtı, 10 korunan dosya hash'i, kurulum engelleri ve geçiş/geri dönüş sırasını taşır. Kabul edilmiş erp-modern.css/b6, workCollections/workingCatalogSession10b, normal müşteri/tedarikçi/finans kaynakları byte-eş korunur. Yeni frontend dist derlenmedi; eski dist yeni kod diye sunulmaz. Aday hash'i `79aef113d71313f44693673a0091d9ce1c16e9f6d94f722311c239f8779efb3a`.

## Gerçekten denenenler

`node --test scripts/canonical/green5244-realdata-compat-local.test.mjs`: **8/8 yerel izole kontrat testi geçti**. Kurulu kanıtlar olmayan CI/host'ta SKIP edilir; SKIP tamamlanma kanıtı değildir.

- Pinli overlay ve finans/CSS dosyalarının korunması.
- Eski 5244 bağlam reddi, donor overlay ve gerçek-veri backend modelinin bağlamda uyuşması.
- Gerçek 5244 katalog consumer'ının overlay ile sentetik fixture'da tam kod, sıfırlı barkod, negatif stok ve USD fiyat tuple'ını koruması.
- Yetkisiz fiyat okuması, hold, yanlış sayım/ancestry/actualT1 ve sentetik kapsam karışımının reddi.
- Gerçek 5244 müşteri/tedarikçi HTML helper'larında UNKNOWN'ın scalar0 yerine Bilinmiyor kalması; ayrı döviz/B-A sunumu.
- Mevcut oturum/yanlış API eşliği reddinin korunması ve kalan kurulum engelleri.

Bunlar fixture/model/üretilen HTML kanıtıdır; gerçek GUI, normal yeni kullanıcı oturumu, SQL/native işlem veya insan kabulü değildir. Canlı endpoint testi, yeni satış/ödeme/tahsilat veya bakiye yazması yoktur. Eski kabul/stock/283+16 testleri, build ve geniş CI döngüsü tekrarlanmadı.

## Tam somut engeller ve sonraki kontrollü işlem

1. **Tek DB ve backend:** TEST125 gerçek veri korunarak yeni günlük ekranların çalışacağı desteklenen native adapter kapsamı seçilip kanıtlanmalı. CLEAN wrapper'ın gerçek DB'ye erişimi genişletilmez; iki-DB auth/business proxy yapılmaz.
2. **Normal mevcut kullanıcı:** CLEAN'deki kullanıcı TEST125'te eşdeğer mevcut hesapla doğrulanmadı. Mevcut girişin aynen kullanılması şu an desteklenmiyor. Bu tur hesap/rol/grant oluşturma veya token taşıma yetkisi yok; böyle bir değişiklik ayrı, exact kimlik/izin etkisiyle ele alınmalı.
3. **UNKNOWN:** customers/suppliers.balance NOT NULL/default0 iken 5536 insert edilmez. Depolama + kullanılan native reader/DTO + yazma önkoşulları NULL/UNKNOWN'ı uçtan uca korumalı; şema/guard kendiliğinden gevşetilmez.
4. **Gerçek paket/admission:** Yukarıdakiler kapandıktan sonra bu üç kaynak dosyası korunmuş web üzerine tek derlemeyle uygulanmalı; seçilmiş aynı DB'ye bağlı API/native, desteklenen normal entry ve paket manifesti birlikte mühürlenmeli. Şu an böyle bir runnable artifact yoktur.

Gelecekteki geçiş: taze tek-ERP-owner ve port/PID/doğum/paket/DB/T1false pinleri → geçerli current backup ve config/start/profile before-image → yalnız desteklenen dar API+web bakım çifti → gerçek normal giriş ile aynı DB'den ürün, müşteri, tedarikçi ve ayrı döviz hesapları; UNKNOWN/ret kontrolleri → ticari yazma olmadan sonuç. 5194, CRM ve eski veri korunur; önceki bakım makbuzu/PID'leri tekrar kullanılmaz.

Geri dönüş yalnız bu bakımın before-image'ındaki exact başlangıç/route/profil/paket bağlarına CAS ile yapılır; başarısız endpoint'i başka DB'ye düşüren fallback yoktur. Normal oturumlar veya sonraki yerel hareketler silinmez; ticari DB restore/reset edilmez. Mevcut owner yolları (`clean-b5-pair-transition` / bağlı TEST125 maintenance) tek başına bu yeni birleşik topolojiyi desteklemiyor; yeni hedef için exact admission olmadan çağrılmaz. Bu aşamada geri alma gerektiren runtime yazması oluşmadı.
