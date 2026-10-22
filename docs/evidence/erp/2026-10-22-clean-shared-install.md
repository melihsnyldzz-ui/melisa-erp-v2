# 22 Ekim — Güncel normal GUI ve bağlantı kesintisi sonucu

Güncel kurulu uygulamalar **ERP970cfc24b9fdb0017a79c5ca6c03bb4b59a23bbc / CRM1dd07d1f49b01a1847a519a0868294cb05188cd2**. Aşağıdaki100/a24 ilk makbuzu tarihseldir. Normal girişin bu yeni hedefte desteklenmediği varsayımı gerçek normal form denemesiyle düzeltildi; ERP-DEC-069 kaydı bağlayıcıdır. Önceki gerçek/Shared credential retleri için dolanma yasağı aynen sürer.

| Kapsam | Gerçek sonuç |
|---|---|
|2.4–2.5 normal oturumlar|ornek-personel CRM atanmış Örnek Mağaza ve ornek-satis ERP normal yeşil ekranlarında açık|
|3.3–3.5 /4.1 gerçek GUI bağlantısı|CRM ürün/müşteri/adet/fiyat→native SQL→ERP Onaylar; son belge CR2-450649569C91470FA7B6A9330B,0007 MELISA,3×125,50TRY=376,50TRY|
|4.4 istek ulaşmadan kesinti|Aynı fb911576-bfce-4f05-b015-3ea0879c688a UUID/body; GET404→tek POST200→GET200,251TRY|
|4.4 commit sonrası yanıt kaybı|POST200 yanıtı tutulurken bağımsız SQL order3'ü gösterdi; istemci timeout/recovery GET kaybı sonrası yalnız GET200 ile aynı45064956-9c91-470f-a7b6-a9330b60e456 açıldı; yeni POST0|
|Yenile/tekrar aç|CRM normal oturumu reload sonrası kaldı, geçmişten aynı taslak açıldı; yeni POST0|
|Fotoğraf düzeltmesi|Doğal320×320original PNG, kaynak SVG/SHA ve ayrı immutable metadata; normal CRM galeride HTTP200/complete/natural320×320; preview/thumbnail büyütülmedi|
|Türkçe hata düzeltmesi|“Bağlantı kesildi. Taslağınız korunuyor; aynı taslağı yeniden doğrulayın.” Mevcut order3 GET-only kesilip sonra geri okunarak gerçek ekranda doğrulandı|
|Son bağımsız SQL|3farklı UUID/3order/3line/3journal, her UUID1; önceki order1 korunur; pending0, stok24/12/0, stok hareketi/fatura0, cari bakiye0,8native tanım/hash geçerli|
|Kurulu eski sistem|16listener adres/PID/birth birebir aynı; eski TEST125/DB02/veriler/roller/yedekler üzerinde işlem yok|
|5.2 bağımlılık|Yeni kaynak/runtime ve kalıcı Node24.19.0 kullanılır; eski deneme/release/Desktop klasörüne başlangıç bağımlılığı yok|
|5.1 kolay açılış|Mevcut .cmd ve alt start sözdizimi doğrulandı; alt start dosyaları gerçekten kullanıldı. Actual .cmd çağrısı komut başlamadan otomatik onay denetiminde `rejected: blocked by policy`; ayrıntılı gerekçe verilmedi. Başka araçla ret aşılmadı. BLOCKED; gerçek reboot/logon DENENMEDİ|

Geçici browser kesintileri tamamen kaldırıldı; bilgisayar ağı veya eski servisler kesilmedi. Yeni gerekli iki GUI vaka kaydı önceki API order1'e ektir; global toplam1 iddiası geçersizdir, tek etki her UUID için ayrı doğrulandı. Normal parola formu mevcut korumalı DPAPI kaydından CUA belleğiyle dolduruldu; sır çıktı/log/pano/kaynak/GitHub'a çıkmadı, auth/token/cookie bypass yok. Teknik GUI testi gerçek personel/insan kabulü değildir; özgün49/25 ve kabul sayaçları değişmez.

Yeni private makbuz `C:\Sirket\ERP\clean\20261022\runtime\installation-receipt-gui.json`, SHA256 `9407d35235d5b6575706c57d1c624afbc79d3b29f2bac1c0b5705f0906341014`. ERP sunulan index2f4b180c ve CRM index656a01b5 gerçek dist ile eşleşir. Ham private makbuz/sırlar GitHub'a alınmaz.

Private kanıtlar: `gui-request-cut-proof.json`, `gui-response-loss-proof.json`, `gui-response-paused-sql.txt`, `gui-reload-proof.json`, `gui-turkish-network-proof.json`, `gui-original-photo-proof.json`, `gui-final-sql.txt`; görüntülerin asılları aynı private runtime alanındadır. Aşağıdaki kopyalar yalnız yapay kayıtları gösterir; gerçek ticari arşiv, credential veya özel ayar içermez.

![ERP normal Onaylar aynı siparişi okuyor](2026-10-22-clean-erp-order.jpg)

![CRM normal katalogda orijinal fotoğraf](2026-10-22-clean-crm-catalog.jpg)

![Türkçe bağlantı uyarısı ve korunmuş miktar](2026-10-22-clean-crm-network.jpg)

![Aynı sipariş ikinci kayıt olmadan geri okundu](2026-10-22-clean-crm-recovered.jpg)

ERP970cfc2 exact [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39764410141) / [push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39764404384) SUCCESS; CRM1dd07d1 exact [PR CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/39764301807) / [push CI](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/39764294296) / [AI offline](https://github.com/melihsnyldzz-ui/melisa-crm/actions/runs/39764301782) SUCCESS. Son belge HEAD kaynak/paket CI'sinden ayrıdır.

---

## Tarihsel ilk kurulum —100/a24

ERP-DEC-068'in teknik kurulum kanıtıdır. Eski P03/Shared devralmanın, bütün ürünün veya insan kabulünün tamamlandığı anlamına gelmez. Önceki kayıtlar korunur.

| Alan | Gerçek sonuç |
|---|---|
| ERP uygulama source | `100a9a5596a9d7b2aff27230b03e3a8fbcc03aa1` / PR54 |
| ERP kurulu kimlik | `CLEAN-ERP-20261022-100a9a5596a9` |
| CRM uygulama source | `a24c00d017ffb76814101013754b70a01cda3a3c` / PR3 |
| CRM kurulu kimlik | `CLEAN-CRM-20261022-a24c00d017ff` |
| CRM frontend build source | `334fef95f485098e8dd3bd2a3f1a817f3c686ad0`; sonraki a24 yalnız gateway/test/doc değişikliği |
| Veri alanı | `Semih\MELISADEV / MELISA_ERP_CLEAN_TEST_20261022`, yalnız yapay kayıt |
| Kimlik | `e662fd94-d797-4b3b-938a-d143ad758b67`, immutable; synthetic=true / actualT1=false / externalOperations=false |
| ERP | `http://127.0.0.1:5244/ornek-akis.html#stock`; API4194/native4196 |
| CRM | `http://127.0.0.1:62800/`; gateway62801/catalog62802/orders62803 |

## Gerçek teknik sonuç

- Normal ERP authService ile ayrı nonadmin yapay personel login/refresh/logout; normal CRM scrypt/JWT kullanıcı/rol/atama yolu çalıştı. Eski hesap/parola/rol değiştirilmedi; auth bypass veya eski TEST ADMIN/personnel issuer kullanılmadı.
- Gerçek SQL katalog3 ürün, üç ayrı TRY/USD/EUR fiyat, baştaki sıfırı korunan barkodlar, stok24/12/0. Ürün1 için programatik örnek görsel: merkezi yeni runtime'da PNG320 + thumbnail64, SHA256 ve immutable metadata; SQL binary yok. Eski gerçek fotoğraf taşınmadı, Vega provenance uydurulmadı.
- CRM normal personel atanmış konuşma55'i, yönetici aynı konuşmayı okudu; başka personel403. CRM'de ilk fotoğraflı filtre1 ürün döndürdü: `0007 MELISA`, `125.50000000 TRY`; thumbnail1359byte. Ürün/fiyat/görsel gerçek yeni ERP HTTP/SQL'den geldi; JSON ürün/sipariş motoru yok. Konuşma içeriği yalnız açıkça yapay metadata projection'ıdır; gerçek müşteri mesajı yok.
- Mevcut native v2 SQL writer/transaction/CAS/replay/immutable receipt motoru kullanıldı. Tek yapay örnek request `89a4d734-0f03-49c9-a9bd-b5a790521021`, order1, ürün1×2, toplam251.0000TRY. Normal CRM→ERP HTTP geri okuma ve replay aynı order1 döndürdü; aynıUUID/farklıbody409; yanlışfiyat51204; yetkisiz ERP okuyucu create51201.
- Normal ERP mevcut `/api/sales-orders` okuyucusu aynı siparişi ve satırı geri okudu. Yeni profilin mevcut Onaylar bölümünde salt okunur CRM taslak listesi/ayrıntısı bu okuyucuya bağlıdır; burada satış onaylama/finans yazması açılmadı.
- Bağımsız SQL:1order/1line/1request journal; stok hareketi0, satış/alış faturası0, cari bakiyeleri0, stok24/12/0,8SQLdefinition/8hash. Yeni draft stok, borç, tahsilat veya rezervasyon yaratmadı.

## Giderilen somut eksikler

1. Yeni şemada filtreli indeksin SQL oturum seçenekleri: yalnız yeni alanın eksik şeması tamamlandı; DB yeniden oluşturma/restore yok.
2. Yeni hedef için sonlu SQL/port/normal auth ve yapay provenance dalı eklendi; eski TEST/Shared/LIVE guardları korunur. SQL login eski/gerçek DB'lere erişemez, sysadmin/control0.
3. Gerçek CRM katalog denemesi `ERP_SOURCE_IDENTITY_REQUIRED` verdi: gateway'nin eski CANONICAL_TEST literal beklentisi yalnız exact clean profile için ayrı kimlik kanıtıyla düzeltildi. Eski kimlik kontrolü genişletilmedi.
4. ERP'nin gerçek SQL BIGINT string ID'si yeni readonly UI adapterinde dar şekilde normalize edildi. Baştaki sıfırlı/üs biçimli/unsafeID hâlâ reddedilir.
5. Yeni bağlam importunun config-only VM test bağımlılığı ve iki literal hata kodunun kapalı logger kaydı tamamlandı. Kontroller atlanmadı.

## Yeniden açma, koruma ve kanıt

Yalnız yeni6process/7port kapatılıp açıldı. Yeni source/SQL/safety/normal HTTP geri okundu. Önceki16listener adres/PID/creation-time kaydı birebir aynı. Önce/sonra bağımsız yeniSQL ticari readback SHA256:

`de41d06cb539a730857b00aff9717e860bce21eaf0551a29ce9795cda2c7ef4a`

Bu SQL restore veya gerçek Windows reboot/logon provası değildir. Eski TEST125/DB02/Shared, migration geçmişi, karantinalar, LL dışlamaları, maliyet/fotoğraf/cari aktarımları ve yedekler üzerinde işlem yapılmadı. Çalışan eski servisler stop/restart edilmedi. Geri dönüş sınırı yalnız doğrulanmış yeni process'leri durdurmaktır; yeni SQL/order kanıtı saklanır. Eski DB'ye restore/reset veya eski P03 claim replay yok.

Private makbuz: `C:\Sirket\ERP\clean\20261022\runtime\installation-receipt.json`. Burada gerçek PID/executable/path/creation, source/paket, served-index eşliği, normal API/SQL ve restart kanıtı bulunur. Backend credentials DPAPI+owner/SYSTEM ACL alanında kalır; frontend bundle'a taşınmaz. Ham ticari veri, private config, parola/JWT/token veya fotoğraf arşivi GitHub'a yüklenmedi.

HTTP'den alınan HTML byte'ları gerçek dist dosyalarıyla eşleşti:

- ERP index SHA256: `2f4b180c152a1100df4c36aee0b1efcbc78b4d32af835a6adf86709c6c14fe9d`
- CRM index SHA256: `8478510ca6b0d8db305573d2e7698df3eceeb998949adf6e1a3b2bf449d32104`

Kolay açılış: `C:\Sirket\ERP\clean\20261022\Melisa-TEST-Ac.cmd`. Mevcut yeni servisler açıksa adresleri açar; tamamı kapalıysa yalnız bu yeni hedefi başlatır; kısmi/yanlış hedefte ikinci kopya veya otomatik kurtarma yapmaz. GUI açılış kabuğunun gerçek reboot/logon kabulü verilmedi; altında kullanılan yeni startup adımları gerçek kurulumda çalıştırıldı.

## Test, CI ve açık kalan gerçek sınır

Değişen davranışa yönelik106 hedefli test,22 CI uyumluluk regresyon testi, son BIGINT kimlik kontrolü ve normal ERP/CRM build'leri geçti; bu sayılar birbirine eklenmiş bir ürün kabul sayısı değildir. ERP kaynak incelemesi ve CRM gateway regresyonu bağımsız incelendi. ERP100a9a5 exact PR CI quality-build-test/secret-scan/windows-startup-test SUCCESS. CRMa24c00d exact PR/push aynı üç kontrol ve ai-sales-offline SUCCESS. Son belge commit'inin CI durumu uygulama kaynak sonucundan ayrıdır.

Graphify saltokunur sorgusu5670node/13246edge yanıtladı; önceki erişim engeli kalkmış. Defender istisnası/koruma kapatma yapılmadı; Microsoft incelemesi kurulum için aşılmadı.

**Normal iki uygulamanın giriş sayfası gerçek tarayıcıda açıldı; oturum içi ürün/katalog/sipariş GUI DENENMEDİ/BLOCKED.** Korumalı ilk GUI credential aktarımı desteklenmediğinden bu sınır API login/SQL/CI ile PASS yapılmadı. Parola istenmedi, credential/token/cookie/clipboard/enjeksiyonla ret dolanılmadı. Private screenshot'lar `runtime/erp-normal-login.jpg` ve `runtime/crm-normal-login.jpg`; giriş sayfası kanıtıdır. İnsan/cihaz kabulleri ve özgün bitiş sayaçları değişmez.

Sıradaki tek iş desteklenen korumalı normal GUI ilk giriş devri ve mevcut kabul ID'leriyle oturum içi denemedir. Yeni finans/migration/LIVE/ticari kayıt, gerçek müşteri mesajı, ücretli servis, main merge veya başka Goal başlatılmadı.
