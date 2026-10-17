# ERP06 / C06 — iletişim düzenleme sözleşmesi hazırlığı

## Korunan kaynak checkpoint'i — CRM06 önceliği

14 Ekim kullanıcının tek ana başlığı bitirme kararıyla ERP06 bağımsız geliştirmesi durdu; hazırlanmış API/frontend/native derleyici kaynakları kaybolmadan aynı feature dalında saklanıyor. **Bu kaynak kurulu pakete uygulanmadı.** ERP/native7a41f64–CRM5b6dfe5 aynı kaldı. Native kurulum, configure/startup bağlantısı, yeni grant/rol, iletişim yazması ve normal kaydet kabulü yoktur.

Kaynakta dar GET/POST controller/service/store, mevcut iki izin ve karantina bağlantısı; UUID/body/revision doğrulaması; normal müşteri kartı için telefon/şehir/ülke editörü hazırlandı. Editör maskelenmiş değeri kayıt başlangıcı yapmaz; yanıt kaybında aynı body/UUID ile bilinçli tekrar, stale409 ve forbidden403 korunur. Geç tamamlanan istek başka seçilmiş kartı değiştirmez. API guard/VM testleri **41/41**, frontend/session testleri **11/11**; bağımsız kaynak incelemeleri GO. Bunlar SQL/native veya gerçek ekran kanıtı değildir.

Altı native derleyici/bootstrap/model dosyası checkpoint olarak saklanır: yalnız SQL metni üretir, DB'ye bağlanmaz veya kurulumu çalıştırmaz. Başlangıç dosyalarında contact configure/compatibility çağrısı yoktur; kayıtlı native yetki olmadan API store transaction açmaz. Altı sözdizimi kontrolü ve dokuz model testi geçti; bağımsız inceleme yalnız **kaynak checkpoint'i GO**, native/kurulum GO değildir. Kalanlar: canonical descriptor güveni, tam 18 predecessor compatibility zinciri ve cold-start entegrasyonu, gerçek sınırlı native doğrulama/kurulum ve normal ekran kabulü. Bunları bu öncelikte genişletme veya aktive etme.

Salt okunur gerçek DB metadata capture'ı telefon50/şehir100/ülke100 sınırını doğruladı. Kaynak ve şema capture'ları private alanda; raw modül tanımları veya müşteri verisi GitHub'a alınmadı. Aşağıdaki saf model hazırlığı ilk tarihli alt kanıttır; yeni checkpoint onu çalışan uygulamaya dönüştürmez. CRM06 kapanmadan yeni bağımsız başlık yok; C06/C07 ve insan kabulü açık kalır.

14 Ekim 2026. ERP-COMPLETE01 / ERP-DEC-053–055 kapsamında kaynak hazırlığıdır. Çalışan müşteri düzenleme teslimi, yeni paket veya insan kabulü değildir.

## Doğrulanan mevcut sınır

- `customerRoutes.js` genel PUT yolu `customer.edit` ve karantina kapısını kullanır; `customerService.js:updateCustomer` kod/ad/döviz/tür alanlarını da yazar ve kendi transaction'ını açar. Bu yol DB02 için doğrulanmış dar iletişim yazıcısı sağlamaz.
- `stage4-copy-sql.mjs:stage4NativeGuardSQL` müşteri ve tedarikçi tablolarında yalnız bakiye ve güncelleme metadata alanlarını değişebilir kabul eder. Telefon/şehir/ülke bu korumada değişmezdir. Satış kapsamını kullanmak veya global write guard'ı gevşetmek uygun çözüm değildir.
- Normal müşteri kartında telefon maskelidir. Maskelenmiş telefon, ileride düzenleme formunun başlangıç değeri veya kayıt payload'ı olamaz; yetkili gerçek iletişim okuyucusu gereklidir.
- Kaynak DDL telefon50/şehir100/ülke100 karakterdir. Dar iletişim sözleşmesi telefon40/şehir100/ülke100 sınırını kullanır. Bu okuma çalışan DB metadata doğrulaması değildir.

## Hazırlanan dar kapsam

Yalnız `phone`, `city`, `country`; mevcut kullanıcı DTO'sunun pozitif güvenli sayısal kimliği ile `customer.view` ve `customer.edit` izinleri birlikte gerekir. Yalnız izin listesi veya rol adı kimlik yerine geçmez; bu saf kontrol oturum doğrulamasının yerine geçmez. İstek aynı müşteri kimliğine, UUID'ye ve önceki revision'a bağlanır. Kod/ad/tür/döviz, kaynak bağlantıları, hesaplar, bakiyeler, hold ve diğer alanlar istek kapsamına alınmaz. Baştaki sıfırlar ve Türkçe karakterler korunur; bilinmeyen ülke/döviz/kimlik türetilmez.

Saf model gerçek bir yetki veya native capability üretmez. Yeni endpoint, SQL yazıcısı, giriş yolu, frontend kontrolü veya devre dışı adaptör eklenmez. Var olan normal okuma ve işlem korumaları korunur.

## Çalışan bağlantı için kalan somut bağımlılıklar

1. Exact müşteri/kaynak/hesap kimliği ve güncel hold kontrolünü aynı transaction'da yapan dar native iletişim okuyucu/yazıcı.
2. Yalnız iletişim alanları için incelenmiş native guard/owner kapsamı; stok ve finans etkisi sıfır.
3. Mevcut journal düzenine bağlı UUID/body tekrar güvenliği, compare-and-swap, audit ve eşzamanlı değişiklik reddi.
4. Mevcut rollerle normal ekran kaydı, yenileme ve bağımsız SQL/API sonucu. İzin verilmeden rol genişletilmez.

ERP07 / C07 genel tedarikçi güncellemesi aynı bağımlılığa sahiptir. Mevcut `test-supplier-cards/:id/contact` yalnız eski ayrılmış sentetik tedarikçi ve aktör kapsamıdır; DB02 kaynak tedarikçi kartlarını düzenleyebildiğine kanıt değildir. Kabul edilmiş bu sentetik teslim tekrar edilmedi.

## Doğrulama ve teslim ayrımı

Hedefli model testleri offline guard altında 11/11 geçti; bağımsız kaynak/test incelemesi GO ve ayrı 11/11 sonuç verdi. Komut: `node --require ./scripts/ci/offline-guard.cjs --test apps/api/src/services/customerContactModel.test.mjs`. API CI test keşfi `apps/api/src/**/*.test.mjs` dosyalarını otomatik alır. Modelin olumlu/olumsuz sonuçları gerçek SQL değişikliği veya çalışan native tekrar güvenliği olarak sunulmaz.

Bu çalışma runtime, SQL, config, port, store, yedek veya servis değiştirmez. Önceki ERP/native7a41f64–CRM5b6dfe5 paket ve 14 Ekim korumalı DB02 yedeği korunur; yeniden paket/restore/prova yapılmaz. CRM MANUAL normal GUI erişim adımı ayrı açık kalır. ERP06/C06 ve ERP07/C07 kısmi, insan kabulü bekliyor; ana toplamlar ve `completeDelivery=false` değişmez.

## 17 Ekim 2026 — çevrimdışı cold-start bağlantısı

Güncel `93a072f137728435f21037e70e9cf074fa6a3fb3` tabanında controller/service/store/editör ve 22 modüllü native successor hazırdı; eksik kaynak bağlantısı, serialized descriptor'ın ortak bootstrap tarafından hiç doğrulanmaması ve `start-shared-test-copy.mjs` çağrı zincirinde predecessor compatibility ile contact registration'ın bulunmamasıydı. Önce bu eksikliği gösteren sentetik cold-start regresyonu eklendi, ardından yalnız aşağıdaki kaynak bağlantısı tamamlandı:

- config descriptor; exact copy/seal/profile/revision hashini, sıralı 18 predecessor ile dört yeni modülü ve mevcut selected-sale/product-price bağımlılıklarını doğrular;
- desteklenen sıra contact native proof → predecessor hash projection → mevcut selected-sale/product-price configure → tekrar contact proof → exact descriptor registration şeklindedir;
- config tek başına capability üretmez; kayıt ancak aynı transaction/native proof başarılı olduktan sonra oluşur;
- descriptor yoksa eski bootstrap yolu değişmeden çalışır, bozuk veya bağımlılığı eksik descriptor SQL/callback öncesinde kapalı kalır.

Bu patch SQL metni üretmez/değiştirmez ve SQL/DB02/Vega bağlantısı, sorgusu, migration, `EXEC`, grant, configure çalıştırması, paket veya Windows kurulumu yapmaz. Gerçek native nesnelerin kurulmuş descriptor ile aynı olduğu ve normal müşteri kartında kaydet→yenile akışı ayrıca izole native/GUI entegrasyonudur; bu çevrimdışı teslim bunları PASS saymaz.

### ERP-TEKNIK-23EKIM / P07.1.a — R1 düzeltmesi ve gerçek kaynak teslimi

17 Ekim tarihli Goal, mevcut ana oturumda `get_goal` ile **active** doğrulandı; yeni Goal, ortam veya takip ağacı oluşturulmadı. [Tarihli kapsam6232818354](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6232818354) ve [aynı rapor P07.1.a](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6222599673) esas alındı. Önceki tur normal Windows ekran aracının URL güvenlik reddiyle sona ermişti; bu tur ekran işlemi tekrarlanmadı.

[6232135117 önerisi](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6232135117), exact `93a072f` tabanına hunk kontrolünden sonra alındı. R1 regresyonu gerçek callback projector'ıyla önce **FAIL** verdi: adsız reader/proof metadata hash'i dönüşmüyor, bazı ilgisiz adlı satırlar yanlış dönüşüyordu. Açık if/else blokları iki durumu düzeltti; farklı hash, yeni contact modülü ve kaynak yanıt korunur. Projector callback sonrasında kullanılamaz; önce/sonra aynı session/transaction/lock doğrulanır.

Ek failing-before kontrolünde son proof reddedildiğinde kayıtlı capability kalıyordu. Registration bütün compatibility kontrollerinden sonraya taşındı. On sorgunun her birinde enjekte edilen hata ve callback sırasında bütün frame'in tutarlı biçimde değiştirilmesi, writer capability oluşturmadan reddedilir. Bu, mevcut yetkiyi genişletmez.

Saf startup pin'i runtime wrapper'ından ayrıldı. Terminal paketinin kapalı import listesine yalnız saf pin/contract/compiler eklendi; dinamik import koruması aynı. Gerçek transitive starter ve her pin için eksik/değiştirilmiş dosya reddi test edildi. API test keşfi yeni startup suite'ini alır; canonical CI artık contact compiler/bootstrap regresyonlarını da açıkça çalıştırır.

Yerel çevrimdışı sonuçlar:

- Startup/paket/route/shared-bootstrap/contact compiler ve projector: **46/46 PASS**, 0 skip.
- Değişen bağlantının mevcut model/service/store/controller yetki, CAS, replay, karantina ve rollback regresyonları: **27/27 PASS**, 0 skip. İlk çağrıda gerekli VM modül bayrağı eksik olduğu için iki dosya yüklenemedi; CI ile aynı `--experimental-vm-modules` bayrağıyla yukarıdaki son sonuç alındı.
- Başlatıcı JavaScript syntax ve `git diff --check` temiz; bağımsız kaynak/paket incelemesi GO. Hosted CI ve uzak HEAD sonucu teslimden sonra aynı rapora yazılır; yerel PASS bunların yerine geçmez.

Komutlar `node --require ./scripts/ci/offline-guard.cjs --test` altında ilk gruptaki altı dosyayı; ikinci grup için ayrıca `--experimental-vm-modules --experimental-test-module-mocks` ile dört contact model/service/store/controller dosyasını çalıştırdı. SQL/provider/HTTP/servis erişimi yok.

**Kurulum açık:** Contact successor 18 eski native modülü değiştirir. Mevcut salt okunur native başlangıç bu successor için desteklenen compatibility/proof yoluna sahip değildir; eski V11 hash doğrulaması kapanır. ERP RW kimliğini native'e vermek veya grant/rol korumasını gevşetmek çözüm olarak uygulanmadı. Mevcut TEST paketi f5/CRM439b/denetleyici2bf0 korunur; yeni paket, SQL nesnesi, config, rol, servis veya ticari kayıt yazılmadı. Bu teslim yalnız incelenmiş kaynak ve sentetik kanıttır; C06, normal kaydet→yenile, ERP-UA32 ve özgün insan kabulleri **BEKLİYOR**. 19/23/26–27/28/30 Ekim hedefleri ve 49/9/39/1 sayımı değişmez.
