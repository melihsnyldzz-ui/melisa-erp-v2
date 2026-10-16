# P02/P03 — Hazır ERP ve CRM kaynaklarının ortak TEST teslimi

Mevcut [ortak bitiş raporu](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6222599673) için teknik kanıt; yeni plan veya kabul kaydı değildir. ERP ortak runtime/SQL/kurulumun tek yazarıdır. CRM ana konuşması kurulum öncesinde `idle` görüldü; görünmeyen kuyruğa `boş` denmedi. Mevcut alt ajanlar kaynak ve bağımsız inceleme yaptı, ortak runtime'a yazmadı.

## Kaynak, paket ve doğrulama ayrımı

| Parça | Kaynak | Doğrulanan teslim |
|---|---|---|
| ERP PR32–35 | `36956fa`, `6dea090`, `5523b1a`, `078bb2d` | Var olan dört düzeltme alındı; yeniden geliştirilmedi. CSV formül koruması, bilinmeyen toplam, geçersiz belge bağlantısı ve hareket adedi/tutar ayrımı; 23 hedef test. Bunlar web-admin düzeltmeleridir; normal yeşil ekranın yeniden tasarımı değildir. |
| Sahiplik kurtarması | `d71540c2ac9eb98f67063a366da341b1e34a56fc` | Sekiz hedefin kalıcı intent/result sıralaması ve tekrar güvenliği; 8 çevrimdışı test. [Aynı kaynak CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38956660917) başarılı. |
| CRM birleşik uygulama | `439b63db8376a6b9d3ac8baa625ed98367022623` / [PR18](https://github.com/melihsnyldzz-ui/melisa-crm/pull/18) | Önceden tamamlanan uygulama yeniden geliştirilmedi. Gerçek izole paket oluşturuldu; manifest `342eb291f570dd4294d50206327d67d895bf2e90944026b56392e498a38aebba`. [Mevcut aynı kaynak CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/38908109619) başarılı. |
| ERP uygulama paketi | `f5f672c439972b287f77ddd2c7750fa0c6369e87` | Gerçek derleme: `CANONICAL-COMPLETE-TEST-20261011-f5f672c`, manifest `0e119c7256f8e34290973cd0e4c627e992906eb2641cf06fd830f853525af653`. Tarihsel baseline `7a41f64` ile güncel derleme ayrı; eski paket değiştirilmedi. Baseline için 12 hedef test ve [aynı kaynak CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38958873752) başarılı. |
| Birleşik kurulum profili | `7d1518665c6cd990c1e2824ad3803c931ec55c47` | Yalnız exact ERPf5 + CRM439b; 20 hedef test, bağımsız inceleme GO. Gerçek fiziksel kontrol 22 referans. [Aynı kaynak CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38960874309) başarılı. |

## Tarihli kurtarma ve yeni kararlılık bulgusu

- Eski `STOP_CAPTURED` durumundan desteklenen exact-handle stopper ve mevcut iki görevle kurtarma yapıldı. İlk sınırlı bekleme süresi doldu; bu başarısız kayıt korunarak ikinci start yapılmadan bağımsız geri okuma 16 Ekim **19:48:42Z**'de gerçek sağlıklı sahipliği doğruladı.
- CRM18 ilk kurulum geri okuması **20:03:10Z**'de geçti. Ancak **20:04:10Z**'de supervisor Node `-1073740791` ile çıktı; altı CORE dinleyicisi kayboldu. İlk başarılı geri okuma güncel sağlıklı durum yerine kullanılmadı. Kesin yerel çıkış nedeni bilinmiyor; CRM frontend değişikliğine atfedilmedi.
- Bu farklı durum için altı eski CORE ve parent yokluğu, tarihsel Hub doğumu, gerçek Hub sahipliği, görev metadata'sı ve korunan dosyalar yeniden doğrulandı. Eski altı CORE veya parent yeni stop hedefi yapılmadı. Yeni geçiş yalnız halen gerçek sahipliği kanıtlanan Hub'ı hedefler.
- Ayrı `tools/node-v24.19.0` binary'si exact SHA256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237` ile sabitlendi; global Node değiştirilmedi. Eski ve yeni sürüm x64/ABI137. Alternatif sürüm, yerel çöküşün kök nedeninin kanıtı değildir.
- Birleşik adayın tam paket/fiziksel/salt okunur SQL Probe sonucu **20:22:59Z**'de geçti. 79 koruma dosyası önce/sonra aynı; orijinal aktör atası ile gerçek önceki operasyonel ayarlar ayrı tutuldu. Bu Probe kurulum, normal ekran veya insan kabulü değildir.

## Çalışan sonuç

Birleşik f5/CRM18 adayı 20:27:48Z'de başlatıldı; ilk ERP native alt süreci `../build/Release/sqlserver.node` eksikliğiyle çıktı. Gözetim `OBSERVATION_QUARANTINED` durumunda kaldı; aynı aday otomatik tekrar başlatılmadı. Paket hazırlığındaki `npm ignore_scripts` native addon kurulumunu atlamıştı; salt okunur SQL Probe farklı sürücü yoluyla geçtiğinden bu eksikliği yakalamadı. Bu gerçek paket eksikliği ayrıca düzeltilecek; frontend kodu yeniden geliştirilmiyor.

Kontrollü kurulum ve bağımsız geri okuma henüz tamamlanmadı. Eski başarılı geri okuma bu yeni başarısız adayın PASS'i değildir.

### Native bağımlılık onarımı

`CANONICAL-COMPLETE-TEST-20261011-f5f672c-native-ready`, aynı uygulama kaynağı `f5f672c` için yeni immutable türevdir; manifest `d9e8488888aa89380a690fd6a6a491e7bec14be35c3104e8b742263577c26e97`. 1.980 eski manifest kaydı ve 25.452 payload dosyası hashleri korunur. Yalnız `msnodesqlv8@5.2.0` için eski doğrulanmış paketten alınan exact `sqlserver.node` eklendi ve 1.981. manifest girdisiyle ayrıca sabitlendi. Her iki tarafta module/package-lock aynı; eski paketlere yazılmadı. Onarım helper'ının9 sentetik sınır testi geçti. Gelecek normal package build'ine de manifest yayımlanmadan gerçek require-only kontrolü eklendi.

16 Ekim **20:56:08Z**'de exact Node24.19/ABI137 ile hem `msnodesqlv8` hem `mssql/msnodesqlv8` gerçekten yüklendi; SQL bağlantı/sorgusu0. Bu modül yükleme kanıtıdır; native DB02 endpoint'i veya kurulum PASS'i değildir. Yeni 23ref profilin8 testi ve eski birleşik/CRM profillerinin20 testi geçti; eski fingerprintler aynı. Bağımsız kaynak review GO. Sonraki gerçek kurulum sonucu ayrı yazılacaktır.

## Koruma ve sınırlar

### 17 Ekim — Gerçek toolchain engeli ve aynı kaynaklı paket

Native-ready aday **16 Ekim21:08:17Z**'de mevcut iki görevle başlatıldı. ERP native/API ve CRM native/catalog/orders olmak üzere beş CORE açıldı; CRM web **21:12:18Z**'de `PACKAGE_TOOLCHAIN_MISMATCH` ile çıktı, gözetim **21:12:22Z**'de quarantine durumuna geçti. İlk readback beklemesi doldu; otomatik ikinci başlangıç yapılmadı. CRM paketinin Node24.15 metadata'sı ile çalışan Node24.19 farklıydı. Bu kısmi çalışma tam kurulum veya normal ekran PASS'i değildir.

CRM sahibi [cb7060a](https://github.com/melihsnyldzz-ui/melisa-crm/commit/cb7060a524a26d2c5bbd05b85aada896fef7d5fc) ile yalnız exact source/tree/iki lock/Node SHA/izole kökü kabul eden constructor ekledi;23 yeni ve17 doğrudan etkilenen test geçti. [PR CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/38970314160), [push CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/38970309602) ve [AI offline CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/38970314336) başarılı; ücretli AI çağrısı yok.

ERP owner aynı `439b63db8376a6b9d3ac8baa625ed98367022623` kaynağını gerçek Node24.19 ile `C:/Sirket/CRM/releases/node-v24.19.0/crm-shared-test-439b63db8376a6b9d3ac8baa625ed98367022623` altında üretti. Manifest `e85ce261ece92201e24c86ea52e4df7e95b022b0ae6835e80c9b99e5abaec938`; index öncekiyle aynı. Paket içindeki özgün439b doğrulayıcısı ayrıca çalıştı. Karşılaştırmada186 Git kaynak blobu, iki lock ve2.292 payload manifest satırı birebir aynı; yalnız gerçek build toolchain sürümü24.15→24.19. Eski pakete veya manifestine yazılmadı.

ERP Probe/verify artık CRM build Node/platform/arch tuple'ını SQL readiness ve ilk child öncesinde doğrular;6 yeni hedef test geçti. Yeni ayrı `erp-crm-node24-ready` profili yalnız bu paketi, önceki ERP native-ready paketini ve exact Node24'ü kabul eder;8 yeni hedef test, eski28 ilgili profil testi ve eski fingerprint koruması geçti. CI runner yeni testi içerir.93 eski dosya ve beş canlı CORE kimliği salt okunur kayıt altına alındı. **Son kontrollü kurulum, bağımsız readback, normal GUI ve kararlılık henüz tamamlanmadı.** Yeni başarılı sonuç ayrı tarih/sürümle eklenecek.

DB02/copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, `actualT1=false`; TEST125, mevcut ticari veriler, roller, karantina, LL dışlamaları, eski journal ve yedekler korunur. Bu teslimde yeni finans/stok/cari işlemi, migration, veri silme veya restore yapılmadı. Görevlerin Trigger/Principal/Settings alanları değiştirilmiyor; yalnız iki mevcut action mühürlü adaya bağlanıyor. Yeni runtime başladıktan sonra otomatik toplu geri alma veya tekrar başlatma yok.

Ham private ayarlar, ticari veri, giriş sırrı, fotoğraf ve günlükler GitHub'a konulmadı. Ayrıntılı yerel kanıtlar `C:/Sirket/ERP/reports/ERP-COMMON-TEST-20261016` altında. Normal GUI, fiziksel Zebra/telefon, gerçek Windows reboot/logon ve özgün insan kabulü ayrı; USER_ACCEPTANCE PASS ve bitiş sayaçları artırılmadı. LIVE/Vega/gerçek T1/mesaj/ücretli API/main merge yok.
