# ERP-FINOPS01 — teknik tamamlandı / insan kabulü bekliyor

## Güncel kapanış — TEST71, 6 Ekim2026

ERP-DEC-016 ile kullanıcıya giriş yükü olmadan mevcut normal TEST aktörleri15/16 kullanıldı. **Goal3 zorunlu teknik maddeleri tamam; ERP-UA13–17 bekliyor.** Demo görsel kanıtı gerçek native sonucun yerine kullanılmadı. [Makine özeti](technical-completion-71.json), [runtime](runtime-71.json), [switch](runtime-switch-finops-71.json). İnsan kabulü ve finish49/7tamam/24kısmi/18açık değişmez; Goal4/CRM/bonus başlamadı.

| Zorunlu madde | Native kanıt / sonuç |
| --- | --- |
| Personel sayımı ve yetkili gerekçe | [Sayım71](goal3-count71.json):39 aktör15 stok etkisiz taslak;16 ayrı gerekçe ile3→4, hareket917931/audit126135. Gerekçesiz400, personel403. |
| Replay / refresh / çift istek / yanıt kaybı | Paralel iki200, ilk yanıt gövdesi atıldı; aynı UUID/body retry replayed, yeni UUID aynı onaylı taslak alreadyApplied, refresh approved. Counted/replayed hareket dizileri aynı, ikinci etki0. |
| Başlangıca dönüş | Ayrı telafi42 hareket917932/audit126138 ve ayrı gerekçe4→3; ilk sayım silinmedi. Bilinmeyen41 reddedilip geçmişte kaldı. |
| Fiziksel alış iadesi / finans | [İade66](goal3-return66.json):40/native224 kaynak25075/93173/301986, supplier13373; qty1 stok32→31, borç60→0TRY, kasa0. Tek stock ve tek supplier etkisi. |
| İade ters / özgün alış | Gerekçeli ters31→32, borç0→60TRY, kasa0; özgün fatura/item digestleri ve kaynak hareket903120/supplier47921+47922 korundu. [TEST71 salt okunur recheck](goal3-extra-native71.json); yeni71 iade yazıldığı iddia edilmez. |
| Roller / API negatifler |15 count/finance +12 return/finance negatif denemesi. Personel15 stock.adjust/purchase.cancel/finance.payment=false;16 mevcut true. Yeni rol, grant veya password yok; ordinary login kullanıldı, test-admin session kullanılmadı. |
| Native SQL negatifler | [13 guard denemesi](goal3-count-guard-negatives67.json), her biri ROLLBACK: tag/aktör/transaction/draft/delta/ürün adı/stock actor/cost/duplicate/audit actor/note/duplicateaudit ve4620 karantina. Kalıcı saldırı etkisi0. |
| Sınırlar | Genel products/suppliers/customers/product_prices/finance_accounts/users/roles/permissions digestleri aynı. API held scope403, gerçek hold gate blocked ve directSQL51076 ayrı kanıtlar; sahte HTTP409 ileri sürülmez. |
| Ödeme / kasa | Önceki [native ödeme](payment-native-accepted.json) korunur:100+200TRY ve iki ters; borç300→200→0→300, kasa1000→900→700→1000, stok5 değişmez. Güncel normal ekran geçmişi ve TRY/USD/EUR ayrı hareket toplamları, gerçek banka/açılış değildir. |

### Kaynak düzeltmesi ve güvenli SQL kurulumu

Sayım parmak izi normalize edilmiş snapshot alanına bağlandı. Eski üç ticari guard gövdesi korunarak yalnız mevcut301985/325503 sentetik ürünlerin kalıcı sayım farkı için draft39 gibi kayıtlı pending body, aktör16/stock.adjust ve CURRENT_TRANSACTION_ID eşleşen dar izin eklendi. Üç session-context anahtarı işlem giriş/çıkışında temizlenir; farklı transaction izin devralamaz. SQL row_version otomatik alanı karşılaştırmadan çıkartılır, tüm ticari alanlar korunur. Yetkili ayrı3–500karakter onay gerekçesi zorunlu; draft.reason ve karar/audit metadata içinde saklanır, normal modal yenilemede gösterir.

Kalıcı kurulum kanıtı [count-upgrade-applied68.json](count-upgrade-applied68.json): dosya adı eski helper etiketidir; gerçek apply zamanı14:11:33UTC, source7bb37a0, final rowversion fix dahil. SQL SHA256582F92D810BE3DB4978344F8C05A1B04185F4FAAF5BCC611FEBB76C7AC5144FC.3guard+ready/fingerprint hashleri API pinle eşleşir. Dört metadata guard yalnız atomik DDL içinde geçici kapatılıp commit öncesi eski durumuna gelir;37karantina/ticari guardlar devrede. Yalnız3manifest tablosunda7doğrulama hash satırı güncellenir;FXmanifest değişmez. Yeni gerçek rol/grant yok.

Önceki adayın pin/CREATE-ALTER/line-ending ve rowversion hataları dış işlemde geri alındı; başarısız aday teknik kabul sayılmaz. [Tam kurulum dış rollback](count-upgrade-full-rollback69.json) önceki aday denemesidir, finalproducts hash diye kullanılmaz. [Geçerli native outer rollback](count-valid-native-rollback69.json) stok4/tek hareket→rollback3/0kalıcı etki kanıtladı. Son kurulum/hashiapplied dosyasındadır. API hazır prosedürü final hashA6FF41D0EFDA6518925EBCA5386612CE7000ABDA9753C9BDDBB3EAC9040C2D8D. İki bağımsız salt okunur reviewer kaynak/native sonuçlar için CLEAR verdi.

**Rollback yalnız hazırlandı:** sağlıklı kaynak TEST66/source0383c5 + eski SQL tanımları/object grantleri/manifestler birlikte geri döndürülmelidir. TEST68 ara fail-closed aday sağlıklı rollback hedefi değildir. Repo dışı yedek `count-guards-before67.json` SHA2566CB393F8AA7B8CC00797B7AB3C5B5D8DFD06FC5BFE2D48C8CE71A0DD388303BC; `count-guards-rollback70.sql` SHA2569A647472285459EC8DE0066E6227BC586B29378AD5DED1C44CBA964C9717A415. Eski CREATE header/grant/7metadata satırı/141trigger durumu korunur; business history silinmez. Script uygulanmadı, bağımsız incelendi. Tam yedek/credential repo dışındadır.

### Güncel hız

LAN HTTP, aynı mevcut normal İlker16,50satır,3örnek; login ölçüm dışında. HTTP gövdesi okunup JSON parse bitene kadar; browserpaint veya soğuk SQL cache değildir. Finans normal ekranın invoiceGET ardından iki paralel contextGET toplamıdır. [TEST65 baseline](speed-after-65.json), [TEST71 raw](speed-after-71.json).

| Ölçüm | TEST65 medyan ms | TEST71 medyan ms | TEST71 üç örnek ms |
| --- | --- | --- | --- |
| İlk50 | 627 | 617 | 719 / 617 / 590 |
| Sonraki50 | 507 | 475 | 469 / 475 / 554 |
| Kod | 524 | 544 | 453 / 544 / 589 |
| Barkod | 316 | 283 | 269 / 287 / 283 |
| Kart36724 | 169 | 168 | 157 / 197 / 168 |
| HOME | 98 | 79 | 151 / 79 / 79 |
| Sayım | 56 | 52 | 101 / 52 / 51 |
| İade | 369 | 340 | 620 / 340 / 318 |
| Ödeme | 439 | 426 | 509 / 413 / 426 |
| Finans (üç GET) | 430 | 453 | 594 / 453 / 398 |

İlk gözlenen first50 1691→719ms; server/SQL cache sıfırlanmadı. Kod/finans küçük örnek farkları dürüstçe korunur, birkaç saniyelik katalog regresyonu yok. Kart helper kopya hatası37024→originalbaseline36724 düzeltildi; yalnız3kart GET tekrarlandı; eski148/154/164ms değerleri comparison'a dahil edilmedi. Katalog16622/50/54hold metadata assert edildi;3830medya/67belirsiz kaynak kapsamı değişmedi,30Eylül snapshotı güncel Vega deltası değildir.

### Gerçek normal ekran kanıtları

- Sayım39 yetkili kayıtlı onay/gerekçe: [1440](count-native-71-1440.jpg), [1024](count-native-71-1024.jpg), [390](count-native-71-390.jpg). document scrollWidth1425/1009/375; geniş tablo kendi içinde kayar, sayfa yatay taşmaz. [Personel15](count-personnel-native-71.jpg): aynı geçmiş okunur, uygulama eylemi kapalı. Pending personel kontrolünün önceki gerçek [TEST66 görüntüsü](count-personnel-native-66.jpg) korunur.
- [Güncel iade/ters kayıt](return-native-71.jpg), önceki gerçek TEST66 [1440](return-native-66-1440.jpg)/[1024](return-native-66-1024.jpg)/[390](return-native-66-390.jpg). Bunlar ordinary normal sessions; demo renderer değildir.
- [Ödeme71](payment-native-71.jpg): supplier23381 borç300TRY/kasa1000TRY ve48065–68 özgün/ters geçmiş. [Finans71](finance-native-71.jpg): ayrı TRY/USD/EUR giriş/çıkış/net ve “kasa açılış bakiyesi değildir”. [HOME71](home-native-71.jpg): gerçek gün özeti/görevler ve bağlı olmayan bakiyeler.
- URL'ler: [Sayım](http://127.0.0.1:5194/ornek-akis.html#count), [İade](http://127.0.0.1:5194/ornek-akis.html#returns), [Ödeme](http://127.0.0.1:5194/ornek-akis.html#supplier-payments), [Finans](http://127.0.0.1:5194/ornek-akis.html#collections), [HOME](http://127.0.0.1:5194/ornek-akis.html#home). Teknik tarayıcı provası LAN192.168.1.46 normal15/16 üzerinden; kullanıcının localhost demo tercihi ayrı yüzdür. İnsan PASS yok.

### Paket / GitHub / durma noktası

TEST71 source `9ada67ca44947d16226a4894cfcf52aeb6e1c923`, immutable release `CANONICAL-FINOPS-TEST-20261006-71`,1532manifest dosyası, SHA256 `D672E77CA9A46094C95705E2CE7BF5F095B8728AA46025BF69BB57E157876889`,16977dependency byte doğrulaması. API/native/web port4144/4146/5194 exact package; native readonly ve loopbackonly; DB ve LIVE izolasyonu [runtime](runtime-71.json). Önceki release/yedekler korundu.

API439, Sites589, canonical125+media7 offline kontroller/build PASS; native iki bağımsız review CLEAR. Dal `codex/erp-finish-20261004`, [draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23); source9ada CI push37477836029/PR37477845178 quality-build-test ve secret-scan SUCCESS. İzleyen doküman/evidence head source paket değildir; exacthead CI [Checks](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23/checks) teslimde ayrıca doğrulanır. Main merge/LIVE/Vega/CRM yok. Genel FX/çok satırlı iade, batch sayım iptali ve insan/cihaz kabulü kapsamı açık kalır. Goal3 sonunda duruldu; Goal4 veya bonus başlamadı.

## Tarihsel çalışma kayıtları — aşağıdaki eski eksikler güncel engel değildir

### Önceki kabul kanıtı çalışma kaydı

## Önceki kısmi teslim — TEST65 / 6 Ekim2026

- Source `cd1eab3960afae31ce64b223f61b96d784edfb6d`; [runtime/manifest/izolasyon](runtime-65.json). TEST web5194/API4144 loopback ve192.168.1.46, native4146yalnızloopback; aynı namedTEST DB, sysadmin/control/LIVE0/externalfalse.1522manifest dosyası ve16977dependency byte doğrulandı. TEST64 ve geri dönüş launcher korundu; LIVE sahipleri/config/IP aynı; bu iade diliminde ticari yazma0.
- Normal canlı veri `#returns` yalnız mevcut sunucu sahipli bağlı alış/satır/kalan miktardan fiziksel iade taslağı, yetkili onay/red ve gerekçeli ters kayıt yapar. Backend kapsamı/SQL guard genişlemedi; ayrılmış TRY/tek satır linked kaynaklar. Genel TSTB çok satırlı/C09 FX iade değildir. Özgün fiyat/kur snapshotları korunur; stok ortalama maliyeti özgün alış maliyeti diye etiketlenmez. Nakit geri ödeme kendiliğinden oluşmaz.
- [Yerel renderer kanıtı](return-screen.json): gerçek tarayıcı CSS1440/1024/390, yatay taşmasız,44px kontroller; taslak→onay→gerekçeli ters kayıt görünümü. [1440](return-render-1440.jpg), [1024](return-render-1024.jpg), [390](return-render-390.jpg), [ters kayıt](return-render-reversal-390.jpg). Veriler browser-local sentetiktir; bu sayım/iade native SQL kabulü değildir. Kullanıcının seçtiği demo normal5194`#returns` adresinde [paket65 ekranı](runtime-demo-65.jpg) ile ayrıca doğrulandı.
- Request storage başarısızsa gönderilmez; lost-response/reload tam gövde ve aynı UUID ile kurtarılır. Eski retry yeni isteğin kaydını silemez; write başarılı/read403 durumunda kurtarma saklanır. Loading sırasında retry engelli, geç GET/disposal kaynak veriyi ezmez. İşlemden sonra yeni context okunur; eski iade planı güncel stok diye gösterilmez. Çok satırlı sayım iptali backend desteklemediği için görünmez/gönderilmez; desteklenen eski tek hareket veya hareketsiz kayıt korunur.
- Home native sayım/purchase görevleri normal yeşil`#count/#returns` yüzüne yönlenir. Eski`count-cancel`scope yeni count'a eşit sayılmaz. Günlük tahsilat/ödeme/ters toplamları ayrıTRY/USD/EUR; kasa açılışı/banka/vade henüz bağlı değil.
- Sites585/585, iade journal/view/reversal9/9, API Home/count/source16/16, production build ve iki bağımsız review geçti. Uygulama exacthead için GitHub push37466190997/PR37466196198 quality-build-test ve secret-scan SUCCESS. İzleyen doküman head kendi CI'si ile doğrulanır; uygulama source'u değişmez.
- **Somut engel/kalan:** kullanıcı yalnız yerel demo seçti, normal personel/yetkili TEST oturumu kullanılmadı. Yeni sayım/iade zinciri, role negatifler/refresh/yanıt kaybının native sonuçları ve yeni katalog/HOME/operasyon hızları henüz ölçülmedi. TEST61 medyanları tarihsel kanıttır, TEST65 ölçümü değildir. ERP-UA13–17 bekliyor; Goal3 tümü tamam değil. Müşteri iadesi bonusu veya başka finish işi başlamadı.

## Kalıcı sayım normal yüz bağlantısı — TEST64

- TEST63/source `5e647c912fb8cc7397cf0191308ee836bb6a908e` kalıcı iki ürünlü sayım model/API'sini içerir. TEST64/source `100a5286f943baee4f4699229e1bd101452d7dff` bunu normal `ornek-akis.html#count` canlı moduna bağlar. Sadece bu sayfa için tam allowlist `/api/test-daily/count` GET ve `draft|approve|reject|cancel` POST kullanılır; mevcut normal API oturumu ve rol kontrolleri yürür. Sayım görünümünde TEST istatistik bandı yoktur. Otomatik TEST ADMIN'e geçiş bu akışta kapalıdır.
- Kullanıcı parola bilmediğini söyledi ve açık erişim tercihi olarak **yalnız yerel demo** seçti. Bu nedenle gerçek kullanıcı oturumu veya SQL sayım yazması yapılmadı. TEST64'te gerçek tarayıcıyla `http://127.0.0.1:5194/ornek-akis.html#count` açıldığında “ÖRNEK MOD — Bu kayıtlar TEST veritabanına yazılmaz” uyarısı ve yerel sayım/fark inceleme listesi görüldü; örnek ürün ve adetler localStorage demosudur. [Tarayıcı gözlem kaydı](count-screen.json). ERP-UA15 hâlâ bekliyor; bu UI gözlemi ortak TEST kabulü değildir.
- TEST64 runtime source/package/DB/isolasyon, LIVE sahipleri ve geri dönüş kaydı: [runtime-switch-finops-64.json](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-64.json). API4144/native4146/web5194 yeni source `100a5286f943baee4f4699229e1bd101452d7dff`; database `MELISA_ERP_SIRKET_TEST_20260929_01`; sysadmin/control/LIVE=0, external=false, business writes=0; native loopback-only; önceki paket63 korundu.
- Kaynak kontrolleri: `apps/sites-workflow` 575/575 test ve production build PASS; count model + route policy 14/14 PASS; PR23 exact head `100a5286f943baee4f4699229e1bd101452d7dff` CI/secret-scan SUCCESS. Kaynak checkout'unda `testDailyAdminAccess.test.mjs` `sqlserver.node` native binding'i bulunmadığından çalışmadı; TEST64 switch gerçek API/native sağlık ve TEST kimliğini doğruladı.

2026-10-06, ERP-DEC-015 / Uzun Goal3. **Ödeme/kasa/tedarikçi zinciri TEST62, kalıcı sayım modeli TEST63 ve normal sayım ekranı bağlantısı TEST64/source `100a5286f943baee4f4699229e1bd101452d7dff` üzerinde teknik hazırdır.** Dal `codex/erp-finish-20261004`, draft PR23. ERP-UA13–17 insan kabulü bekler. Kullanıcı yalnız yerel demo yolunu seçti; gerçek SQL sayım kabulü yapılmadı. Sonraki geliştirme bölümü fiziksel alış iadesidir.

## Tedarikçi kartı: kabul/fatura/ödeme zinciri

- TEST62'nin [runtime geçiş kaydı](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-62.json) aynı TEST DB, API4144/web5194 LAN+loopback ve native4146 loopback-only kimliğini doğrular; LIVE port sahipleri/özel ayarlar değişmedi ve iş yazması yapılmadı.
- Normal [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers) ekranında iki ayrı kaynağın karışmadığı doğrulandı: fiziksel mal kabul kartı supplier13370, finans denemesi supplier23381. İkincisinde receipt39 → invoice `TDAY-FINOPS-20261006` → belge/cari 300TRY → ödenen0/iade0/kalan300TRY; OD-48065/66 ödemeleri ve ODI-48067/68 ters kayıtları hesap, tarih ve aktif/ters durumu ile gösterilir. Kaynakta timestamp bulunmayan hareketlere saat eklenmedi.
- Ekran kanıtı [supplier-card-screen.json](supplier-card-screen.json) tarayıcı AX gözlemindeki kullanıcıya görünen başlıkları ve değerleri, paket kaynağını ve normal URL'yi kaydeder. Ayrı fiziksel kabul/fatura bölümü eski kayıtlarda bilinmeyen kabul bağlarını tahmin etmeden göstermeyi sürdürür.
- `sites-workflow` tam testleri 575/575; yeni tedarikçi zinciri hedefli testi 12/12; Vite uygulama build'i ve PR23 CI/secret scan başarılı. ERP-UA13 insan kabulü pending; bu ajan ekran denemesi kullanıcı PASS'i değildir.

## Güncel TEST ekranı: ödeme ve kasa hareketleri

- [TEST61 paket geçişi](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-61.json): source/manifest doğrulandı; TEST web5194/API4144 ağ ve loopback, native4146 loopback-only. TEST DB `MELISA_ERP_SIRKET_TEST_20260929_01`; LIVE port sahipleri ve özel ayar aynı kaldı; eski release korundu.
- Ödeme denemeleri için [native onay kaydı](payment-native-accepted.json) ve [ticari tabloların karşılaştırması](commercial-after.json) eklendi. Dar sentetik tedarikçi için 100 TRY kısmi, 200 TRY kalan ödeme ve iki ayrı iptal/ters kayıt UI'den yapıldı; son borç300/kasa1000, ürün stoğu5 (tek önceki kaynak mal hareketi) olarak korundu. Kimlik/UUID ve yanıt sonuçları native journal'da eşleşti.
- Normal [Tahsilat ve kasa hareketleri](http://127.0.0.1:5194/ornek-akis.html#collections) ekranı TEST61'de tarayıcıda açıldı. TRY/USD/EUR ayrı özetler, müşteri girişleri, tedarikçi çıkışları ve her iki tarafın ters kayıtları görünür. Banka tipi hesaplar listelenebilir, ancak hiçbir açılış bakiyesi/gerçek banka entegrasyonu ileri sürülmez. Görüntülenen özet yalnız listelenen sentetik/TEST kapsamının hareket toplamıdır.
- Paket61'de aynı LAN/actor16/50 satır/3 örnek koşulunda [ölçümler](after-61.json): first50 500ms, sonraki50 402ms, kod araması436ms, barkod araması266ms, kart140ms, Ana Sayfa78ms medyan. Önceki TEST58 medyanlarıyla karşılaştırma: sırasıyla677→500, 556→402, 605→436, 329→266, 180→140, 180→78ms. Katalog için ticari yazma yapılmadı.
- Hedefli TEST ödeme UI/API zinciri, ödeme lifecycle, normal collection workflow ve ayrı TRY/USD/EUR mapping doğrulandı; tüm proje/hosted CI durumu PR23 [checks](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23/checks) üzerinden son head için ayrıca izlenir. ERP-UA13/14 insan kabulü bekler; ajan tarayıcı kanıtı PASS değildir.

## Başlangıç kanıtı

- [Gerçek runtime kimliği](runtime-before-58.json): API4144 ERP, native4146 yalnız loopback, TEST DB/LIVE erişimi0/externalfalse; LIVE port sahipleri karşılaştırma için kaydedildi.
- [Korunan önceki zincirlerin native durumu](native-before.json): inbound stok30/3, tedarikçi−100TRY; gece stok17/18, müşteri borcu100TRY/kasa300TRY. Eski kayıtlara yeni borç veya açılış uydurulmaz.
- [Aynı koşulda TEST58 hızları](before-58.json): LAN HTTP, actor16,50satır,3örnek. first50 1423/574/677ms, next50 556/522/556, code596/605/773, barkod326/329/366, kart167/180/186, HOME206/180/167. İlk örnek ve sonraki örnekler birlikte korunur; geçmiş en iyi değer yeni baseline gibi kullanılmaz. Ticari yazma0.

## Ödeme kapsamı kurulum provası

- [SQL dış işlem doğrulaması](fixture-validate.json): TEST58 health kimliği ve ayrı sysadmin operatör transaction'ı içinde kaynak SQL başarıyla kuruldu ve tüm native/module/scope/rol/izin korumaları karşılaştırıldı. Sonuç **ROLLBACK**; kalıcı fixture tablo/procedure/rol/işlem kaydı oluşmadı. SQL Server identity sayaçlarında boşluk kalması beklenir ve ID reset uygulanmadı. Deneme kimlikleri yalnız bu geri alınmış çalıştırmaya aittir; yeniden kurulumda tekrar ayrılır.
- SQL kaynak SHA-256 `F428678D9C35BE17D2BC6836081016D97A30795ED23FFE99A8B21216311B6197`. Uygulamadan önceki bağımsız review P0/P1 vermedi. Bu prova normal çalışma API'sinin yeni ödeme endpoint'ine bağlandığını veya gerçek ödeme zincirini kanıtlamaz. TEST runtime58/source93365d0 değişmedi.
- API, sites workflow ve canonical fixture offline kontrolleri sırasıyla 434/572/122 test PASS; quality syntax PASS. Bu hosted-GitHub CI veya insan kabulü değildir.

## Zorunlu sıra ve tamamlanma kanıtı

| Bölüm | Gerçek sonucu kanıtlayacak kabul | Durum |
| --- | --- | --- |
| 1 Tedarikçi ödeme | Kaynak kabul/fatura pozitif borç → kısmi ödeme → kalan → tam ödeme → ters kayıt; her aşamada SQL borç/kasa doğrulanır, stok değişmez. TRY/USD/EUR ayrı; fazla ödeme, yanlış döviz ve bilinmeyen kur uygulanmaz. | Teknik hazır TEST61; ERP-UA13 insan kabulü bekliyor |
| 2 Finans/kasa | Müşteri tahsilat girişi ve tedarikçi ödeme çıkışı; tarih/party/döviz/tutar/yön/belge/aktif-ters durumu ve döviz ayrı toplamları. Doğrulanmamış ticari açılış/gerçek banka bağlantısı uydurulmaz. | Teknik hazır TEST61; ERP-UA14 insan kabulü bekliyor |
| 3 Tedarikçi kartı | Aynı kaynak kabul→fatura→borç→ödeme/kalan/ters zinciri; fiziksel ve finansal olaylar ayrı, eski bilinmeyen bağ tahmin edilmez. | Teknik hazır TEST62; ERP-UA13 insan kabulü bekliyor |
| 4 Stok sayımı | Personel kalıcı barkod/kod/miktar ve bilinmeyen kayıt; sistem/sayılan/fark. Tamamlama stok etkisiz; actual yetkili gerekçeli onay bir kez stok düzeltir; personel403. | TEST63/64 model/API ve normal ekran bağlantısı teknik hazır; ERP-UA15 gerçek TEST hesabı kabulü bekliyor; kullanıcı yalnız yerel demo seçti |
| 5 Fiziksel alış iadesi | Ayrı kaynak belge, özgün fiyat/kur ve kalan miktar; stok azalır, borç ters etkisi; eski fatura korunur, fatura iptali fiziksel iade sayılmaz. Stok ortalama maliyeti kaynak alış maliyetiyle karıştırılmaz. | TEST65 dar normal ekran/model/yerel renderer hazır; yeni normal oturum/native zincir açık, ERP-UA16 bekliyor. Genel çok satırlı/FX kaynak açılmadı. |
| 6 Ana Sayfa | Gerçek günlük tahsilat/ödeme, bekleyen kabul/sayım/iade işleri; izinli sınırlı okuyucular, temiz boş durum, ayrı döviz. | TEST65 mevcut native özet ve normal count/purchase yönlendirmesi hazır; gerçek oturum/güncel hız/ERP-UA17 açık. |
| 7 Teslim | Gerçek üç genişlik, rol/negatif/native SQL/yanıt kaybı, önce-sonra hız, bağımsız inceleme, yeni immutable TEST paket/launcher, exact source/hash ve PR23 CI/secret scan, status/tree/UA. | TEST65 kaynak/paket/launcher/585regresyon/review/CI teslim edildi. Yerel renderer üç genişlik kanıtı native SQL veya insan kabulü değildir; yeni normal oturum/native/hız eksikleri nedeniyle Goal3 PARTIAL. |

Her yeni yazmada aktör+UUID+tam gövde kalıcı replay; farklı gövde409, çift tıklama/paralel replay ek etki0; sunucu sonrası yanıt kaybı ve refresh aynı sonucu bulur. Gerçek korunmuş kart/karantina/0-negatif miktar/borç üstü ödeme/yanlış döviz native sonuçları kaydedilir. Rol15 finans/maliyet/kâr/stok onayı görmez,16 mevcut gerçek yetkilerinden fazlasını almaz. Yetki güncel SQL ile doğrulanır; eski token veya admin görünümü bypass değildir.

Katalog16.622,3830CONFIRMED,67belirsiz ve hold korunur; 30Eylül kaynak snapshotı güncel Vega delta değildir. Kaynak fotoğraflar, CRM/LIVE/Vega/main merge/gerçek ödeme/mesaj/terminal/rapor/ayar kapsam dışı. Ek müşteri iadesi ancak zorunlu teslim paketli/testli/GitHub'da tamamlandıktan sonra değerlendirilir; güvenli mevcut temel yoksa yarım akış açılmaz.
