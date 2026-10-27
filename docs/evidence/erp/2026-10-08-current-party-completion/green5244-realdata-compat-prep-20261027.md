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

## 27 Ekim19:49TR — frontend derlemesi gerçekten tamamlandı

Kaynak adayı sonrasında bağımsız frontend kısmı derlendi: 53 çıktı ve 11 CSS dosyası. CSS içerikleri, hash kümesiyle kabul edilmiş mevcut web sürümüyle aynıdır. Finans10b ve CSSb6 kaynakları değişmedi. İlk build, web-only release içindeki workTradeModel'ın saf ortak goal8DaySqlProof import kaynağı bulunmadığı için durdu; aynı deneme tekrar edilmedi. v2, aynı pinli CLEAN349 API kaynak manifestinden yalnız bu bir saf ortak dosyayı source closure'a ekledi. Bu, API/native process veya DB kurulumu değildir.

Derleme 16:49:33.692–16:49:44.070UTC (19:49TR), nodev24.19.0, Vite7.3.3; configFilefalse ile mevcut staged config objesi aynen kullanıldı, envDirfalse, temiz env ve mevcut dependency klasörleri saltokunur alias olarak kullanıldı. Config preview hook'u başlatılmadı. Npm install, ağ/SQL/credential veya çalışan runtime çağrısı yok. Yeni target frontendBuildApiBase4194'tür; buna uygun gerçek-veri backend ve normal kullanıcı sözleşmesi hâlâ engeldir.

Private çıktı: frontend-build-v2/dist; makbuz frontend-build-v2-receipt.json, log frontend-build-v2.log, ek kaynak bağı frontend-build-v2-shared-closure.json. Makbuz SHA25636997cd0cc8e99317dfc9d38f053ff429d22e9c7708f5cc0b5db8b4f8f64c81d. Script build-frontend-candidate-v2.mjs SHA25652557bd4758ca745e5692ffe659711b39b6cd52bf3494a2760d20b2c8d91199f. Makbuz FRONTEND_ONLY_BUILT_NOT_INSTALLED, executionAllowedfalse, databaseCalls0, normalLoginVerifiedfalse, sameDbBackendReadyfalse. Eski kaynakoverlay makbuzu ayrı tarihsel artefakttır; derlenmiş yeni çıktı onun yerine sessizce sunulmaz.

Normal kullanıcı için kaynakta aynı36izin satırı ve hedefte kullanıcıyokluğu dar SELECT ile hazırlandı; hedef mevcut başka role eşitlenmedi. Yeni hesap/rol henüz yaratılmadı. Bu özel kimlik işlemi için kullanıcı sorusu açık; genel5244onayı ile Windows/SQL/LIVE yetkisi açılmadı. Yeni5244çalışır doğrulanmadan eski5194durmaz.

## Semih TEST kimliği — gerçek hazırlık

27 Ekim2026 20:17–20:18TR; ERP-DEC-083. Özel onay koordinatörün doğrudan insan yanıtından doğrulandı. Eski CLEAN hesabı ve parolası değişmedi. Yeni kimlik ayrı native ID ile aynı36 izin satırını kullanır; varsayılan admin rolü veya SQL/Windows grant verilmedi.

| Kontrol | Gerçek sonuç |
| --- | --- |
| Hedef | Semih\\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01 |
| Yeni normal hesap / rol | unified-semih-test / unified_test_semih; native17 /17 |
| İzinler |36 satır; kaynak ve hedef hash-eş; etkin izin kümesi de aynı |
| Eski hesaplar ve roller | Transaction öncesi/sonrası kullanıcı, rol ve izin özetleri aynı |
| Korunan ticari etkiler | Stok/müşteri/tedarikçi/finans/audit hareket sayıları aynı; bu kurulum yalnız auth tablolarına yazar |
| Korumalı giriş | Yeni rastgele parola yalnız CurrentUser DPAPI; owner+SYSTEM dosya erişimi. Parola/hash/token çıktı veya GitHub'da yok |
| Tekrar | Ayrı süreçte ALREADY_PREPARED_VERIFIED; yeni kullanıcı0/rol0/izin0 |
| Bağımsız SQL | Native kimlik, aktif rol,36izin ve exact hash doğrulandı |
| Normal API | Mevcut4144 normal login200; aynıhesap/rol; katalog50satır,16992toplam |
| Kalıcı giriş | Mevcut4144 refresh vermiyor.5244tekDB/persistent normal session henüz kurulmadı |
| GUI / insan kabulü | Yeni birleşik5244 GUI denenmedi; insan kabulü verilmedi |
| Runtime | Servis/port/profile/kurulum0; eski ERP girişleri aynı, CRM/Vega/LIVE değişmedi |

Yerel kurulum normal yönetimin kullandığı createManagedAuthUserCore'u yeniden kullanır; hedef transaction, owner ve izin pinleri yerel kurulum sahibindedir. Normal API write guard'ı, trigger, SQL grant veya parolalı giriş kontrolü gevşetilmedi. Eski kurulum yolundaki gibi bu özel hazırlığın audit kanıtı private yerel installer günlüğüdür; SQL ticari audit kaydı eklenmedi. Before-image mevcut auth satırlarının server-side hashleri ve yeni username/rol yokluğudur. Commit öncesi hata rollback; commit sonrası otomatik silme/restore yok, yalnız bu yeni kimliğin kullanım bağları incelenerek dar devre dışı bırakma değerlendirilebilir.

İlk Windows ACL kontrolü SQL yazmadan durdu: PS7'den miras PSModulePath, PS5.1 Security modülünü yükletmiyordu. Aynı hatalı komut körlemesine tekrarlanmadı; çocuk Windows PowerShell kendi varsayılan modül yolu ile çalıştırıldı. Güvenlik ayarı/Defender/execution policy değişmedi. Bağımsız readback ilk bigint string/number tip kontrolünde durdu; Number ile kimlik karşılaştırması düzeltildi, hedef/veri değiştirilmedi.

### UNKNOWN okuyucu hazırlığı

Customer list/detail ve supplier DTO'daki Number(row.balance || 0) dönüşümü nativePartyBalance ile değiştirildi. NULL/eksik/geçersiz değer null kalır; gerçek0 ve negatif tutar mevcut sayısal gösterim anlamını korur. Kaynak hassasiyeti veya saklanan bakiye değiştirilmedi; döviz hesabının yerine scalar kullanılmaz.

Bu dar kaynak düzeltmesi yeni5536kartının veya diğer eksik kartların aktarımı değildir. customers/suppliers.balance NOT NULL ve normal create yolunun0varsayımı hâlâ storage/write engelidir. Mevcut protected session hedefleri CLEAN/DB02'ye bağlıdır; gerçek veri hedefinin desteklenen backend/persistent-session profili de ayrıca tamamlanmalıdır. CLEAN synthetic bayrağını kaldırmak veya gerçek veriye CLEAN oturumunu taşımak çözüm sayılmaz.

10 hedefli yerel test PASS: managed-user çekirdeği4, exact hedef/onay/izin policy4 (biri private gerçek izin kanıtı; CI'da dosya yoksa SKIP), UNKNOWN2. İlgili JS syntax kontrolleri geçti. Bu sonuç kaynak/yerel SQL/API kanıtıdır; yeni backend/GUI/insan kabulü veya CI PASS değildir.

Private kanıtlar aynı ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private alanındadır: account-target-admission.json, account-before-*.json, account-install-*.json, account-normal-api-proof.json. Kimlik ve şifreli ilk giriş runtime/UNIFIED-5244-SEMIH-20261027 altında tutulur; GitHub'a eklenmez.

## 5244 business backend ve normal oturum adayı

27 Ekim20:39TR: canonical4144 aynı DB/SQL kimliğini korur. Yeni isteğe bağlı businessWorkface profili yalnız Semih17/rol17 ve onaylı36satır için, gerçek servis pool'undan yeni SQL tanığı ile açılır. Başka DB/port, sysadmin/control/LIVE erişimi, CLEAN bayrağı, yanlış kullanıcı veya değişmiş izin seti reddedilir. Normal user read sırasında permission satır hash'i yeniden kontrol edilir; fingerprint kullanıcı ve rol row_version'larını da içerir. Eski/native/CLEAN/DB02 davranışı isteğe bağlı profil yoksa aynıdır.

Mevcut normal refresh store ve normal login/refresh/logout/session-confirm kullanılır; yeni parola/login motoru veya SQL yetkisi yok. Yalnız bu kimlikte açık çıkış ömrü kullanılır; accessJWT kısa, yenileme rotasyonlu ve iptal edilebilir kalır. Yeniden açılan depo, eski yenilemenin reddi, eski token ile bütün family logout, aktiflik/rol/row-version değişimi test edildi. Kalıcı oturum henüz kurulu API'de açılmadı.

Aynı yeşil5244 için ilk aday, explicit build profiliyle mevcut4144'e same-origin proxy yapar. Başlangıçta source/package/DB/login/uygulama profili ve yeni kalıcı-session health'i eşleşmeden web bağlanmaz; eski CLEAN sağlık cevabı kabul edilmez. Interface/Host/Origin/finite Tailscale peer ve forwarded-header koruması korunur. Normal browser yenileme sırrı JSON veya localStorage'a verilmez; host-only HttpOnly/SameSiteStrict çerezi ve normal API akışı kullanılır. Yerel şirket TEST'inin mevcut HTTP taşımacılığı değişmedi; LIVE/TLS kabulü değildir. Native protected-device taşıması ayrı kalır; CRM kimlik/oturum eşlemesi açılmadı.

İlk adayın veri kapsamı bilinçli olarak ürün/katalog/fotoğraf ve müşteri/tedarikçi kart okumalarıdır. Proxy ve istemci normal auth lifecycle dışında ticari yazmayı reddeder. Bu, geçmiş satış/finans akışlarının gerçek veri kapsamına açıldığı iddiası değildir. customers/suppliers scalar NOTNULL/default0 sorunu nedeniyle yeni UNKNOWN kartların yazıcısı hâlâ admit edilmez; mevcut ayrı döviz hesaplarının NULL/UNKNOWN gösterimi değiştirilmez veya0yapılmaz.

Gerçek servis tanığı private business-session-service-witness.json ve profil fragmanı business-session-profile.json içinde: mevcut named SQL principal, sysadmin0/control0/LIVE erişimi0; hedef/actor/36izin ve session hedefi kabul edildi. SQL DML0, grant dosyası0, listener0, kurulum0. Bu bağımsız metadata kontrolü normal yeni GUI veya gerçek oturum yenilemesi değildir.

99 farklı yerel hedefli test geçti: backend identity/session/route retleri, mevcut CLEAN ve protected-device kapsamları, proxy origin/health/CLEAN karışma retleri, cookie body/family enjeksiyon retleri, browser factory reopen/logout ve safe logging. Yerel private tanığı olmayan CI'da iki LOCAL test SKIP olur. Frontend/API paket üretimi ve gerçek normal ekran kontrolü ayrı sonraki fiziksel adımlardır.

## Paketler ve owner geçişinin daraltılması

27 Ekim21:18TR: İlk private API assembly1592payload'a10340mevcut bağımlılık dosyası hash-eş kopyalanarak tamamlandı:11932dosya, module import0, manifest13240dfa0161307f12ebab6187826abddc63381f69adc752fd009924c0d474ff. İlk source receipt'teki dependency ifadesi yalnız manifestteki source dosyalarını kapsıyordu; final receipt gerçek10340dependency sonucunu ayrıca tutar. Web7336dosya/6637dependency,53dist/11CSShash-eş; manifest981e1a5b61fa870f3e6cfe00f72c43144a37df637037abd73cbbe0b8029f7d8f. SQL/runtime/listener/kurulum0. Bu v1paketler çalışıyor diye sunulmaz.

Dağıtım öncesi inceleme, yeni normal family JWT'sinin korunan eski readonly native tarafından eski imza anahtarıyla doğrulanmamasını gerektirdi. Bu nedenle yalnız yeni business family için ayrı sunucu imza alanı eklendi; mevcut kullanıcıların ve native'in eski anahtarı değişmez. Yanlış alan/aktör ve eski anahtarla family taklidi reddedilir. v1adayları bu kaynak düzeltmesini taşımadığı için dağıtım izni yoktur; v2paket gereklidir. Frontend bundle içeriği değişmediğinden53çıktı yeniden derlenmeyecek; Vite host sağlık doğrulayıcısı yeni imza alanını da ister. API runtime config'e yalnız yeni businessSessionAccessSecret alanı eklenebilir; eski jwtAccessSecret ve kullanıcı parolaları değişmez. Sır kaynak/rapor/GitHub'a yazılmaz.

Gerçek named servis hesabıyla v2 context admission21:18TR tekrar salt okunur doğrulandı:sysadmin0/control0/LIVE erişimi0,36izin; yeni imza girdisi yalnız bellekte üretildi, login/JWT/grant dosyası oluşturulmadı. Private business-session-service-witness-v2.json. Mevcut Task/supervisor/5194/4146/4144 fresh planı da kaynak/instance/owner/birth/health eşliğiyle doğrulandı; pauseReadyfalse, stop/start0. Kanıt business-current-owner-admission.json; bu gerçek kesinti makbuzu değildir.

En dar kalıcı yol mevcut kayıtlı canonical görev ve launcher üzerinden yalnız API component root'unu pinlemektir. Native ve5194web aynı eski paket/argümanlarla kalır; API health kendi manifest/package ve Semih17normal-session/imza-alanı kanıtıyla doğrulanır. Görev tanımı veya RunLevel değiştirilmez. Kanonik launcher mevcut Git kaydı temiz ve eski byte'ları feature tabanıyla eş; kullanıcıya ait npm test değişikliği ayrı korunur. Fiziksel uygulama öncesi yeni launcher before-image/CAS, tek-owner task stop/start ve üç mevcut çocuk kimliği gerekir. Yeni owner kütüphanesi ve negatif fixture testleri hazır; gerçek güncelleme henüz yapılmadı.

Kullanıcının TEST verilerini5244'ten kaldırma hedefi, portun okuma kaynağını mevcut gerçek-veriTEST125'e alarak karşılanabilir. CLEAN DB, hesap/parolalar, CRM bağımlılıkları ve rollback verisi silinmez; aktarımlar yeniden yapılmaz. Bu kayıt yeni silme/reset veya bakiye aktarımı değildir.
