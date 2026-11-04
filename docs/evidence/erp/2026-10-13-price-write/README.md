# ERP04 / C09 — normal ürün fiyatını sürümlü kaydetme

Durum: **normal ERP fiyat kaydı, yenileme ve tekrar güvenliği çalışan DB02 paketinde doğrulandı; CRM sipariş tüketicisi ve insan kabulü açık**.
Ana kapsam ERP-COMPLETE01 / ERP-DEC-050/053/054/055; PR #23.

## Güncel çalışan teslim — 13 Ekim 2026, 16:06

Source `59c444f9bc79094172ce0a5559a4874cf74d667c`, paket
`CANONICAL-COMPLETE-TEST-20261011-59c444f`, 1917 dosya;
manifest `a2ce175678fa100d6fbdba0cef92e9535521ec7a76aceb672e68dd9612c9bff3`.
Web5234/API4184/native4186, DB02/copye16b70f0 ve actualT1=false doğrulandı.
TEST125 ve CRM09ca/native60e aynı kaldı; bu belge commit'i uygulama source'u değildir.

Normal Chrome ürün kartında mevcut yetkili TEST İlker rolüyle bir doğrulanmış
ürünün mevcut satış fiyatı tuple'ı değiştirildi. Liste ve kart yeni fiyatı
gösterdi. Sayfa yenilendi, aynı ürün tekrar açıldı; tutar ve gerekçeli geçmiş
korundu. İkinci gerekçeli kayıtla başlangıç tutarı geri getirildi. İki immutable
sürüm ve iki istek kaydı kaldı; kaynak fiyat satırı değiştirilmedi.

Bağımsız SQL/API: kaynak satırının önce/sonra tam içeriği aynı; doğru ürün,
birim/kademe/döviz, aktör, iki gerekçe ve sürüm zinciri doğrulandı. Kayıtlı iki
UUID/body, ilk kayıt daha eski sürüm olmuşken yeniden gönderildi. İki yanıt da
replayed=true; yeni sürüm0, güncel pointer değişikliği0, SQL önce/sonra kanıtının
tamamı eşit. Eski tutara dönülmesi MANUAL kaydını SOURCE gibi göstermedi.
Diğer satış fiyatı kademeleri de API'de birebir korundu. Satış, stok veya finans
işlemi oluşturulmadı. İnsan kabulü bekliyor.

Özel kanıt: repo dışındaki ERP-COMPLETE01-20261013/private/erp04-price-write
altında gui-proof/gui-summary.json, bağımsız SQL/API kayıtları ve gerçek
tarayıcı erişilebilirlik metinleri. Ekran görüntüsü aracı capture timeout verdi;
görsel dosya varmış veya piksel incelemesi tamamlanmış sayılmadı. İlk SQL kanıt
çağrısında UTF-8 Türkçe gerekçe okuması reddedildi; açık -f65001 ile düzeltilen
salt okunur kontrol geçti, veri değişmedi.

### Hız: aynı normal API, üç örnek ortancası

| Okuma | Önce 2bf2762 | İlk entegrasyon 0da9f3d | Çalışan 59c444f |
|---|---:|---:|---:|
| İlk50 | 3391ms | 4894ms | 3146ms |
| Sonraki50 | 3073ms | 5642ms | 2726ms |
| Kod | 2920ms | 2705ms | 2911ms |
| Barkod | 2540ms | 2460ms | 2731ms |
| Kart | 2307ms | 2346ms | 2275ms |
| Fiyat düzenleyici | yok | 8384ms | 8942ms |

Ölçüm GUI yazmasından önce yapıldı; 15 karşılaştırılan yanıtın veri hashleri
birebir aynı. Liste overlay'i yalnız mühürlü copy kapsamındaki gerçek ürün
kesişimine uygulanır; native kimlik/kaynak/hold/yetki kontrolleri kaldırılmadı.
Listeye eklenen regresyon giderildi; genel saniye düzeyindeki gecikme ve
düzenleyicinin yaklaşık9s açılması ERP09 kapsamında açıktır.

UI82/82, gerçek özel kaynakla katalog5/5, bağımsız inceleme GO, build ve secret
scan0. Tam source59c444f için hostedCI altı işi hesap ödeme/harcama sınırından
başlamadı (check115303054422); yeşil CI veya insan PASS iddiası yok.
CRM MANUAL fiyat witness sözleşmesi/native successor ayrı açık bağımlılıktır;
ERP04/C09 ve completeDelivery=false sürer. Aşağıdaki kesitler tarihsel ilerlemedir.

## Sıra ve bağımlılık

ERP09 profil-hash alt teslimi `2bf2762`, belge teslimi `def5873` korunur.
Kalan okuma maliyeti için mevcut native profil ve sorgu planı kanıtı incelendi.
Eski sorgu planı adayı, mevcut V11 owner/context/intent ve bootstrap hash
zincirine doğrudan uygulanamaz. İki predicate'i değiştirmenin ötesinde bağlı
modüllerin birlikte sürümlenmesi ve güncel olumsuz kontroller gerekir.
Bu incelemede SQL, runtime veya kaynak performans kodu değiştirilmedi;
aynı benchmark/prova tekrar edilmedi. ERP09 açık kalır.

Onaylı sıradaki ERP04 için mevcut C09 fixture koruması kaldırılmadan ayrı
DB02 fiyat sürümü hazırlanıyor. Mevcut kaynak fiyat satırı, kaynak bağı,
profil mührü ve eski belgeler değişmeyecek. İlk alt kapsam yalnız doğrulanmış
mevcut satış fiyatı tuple'ıdır: ürün + kaynak fiyat kimliği + birim + kademe +
döviz. Yeni tuple, maliyet, alış fiyatı veya yeni rol izni eklenmez.

## Tamamlanma koşulları

- Güncel native aktör/yetki, ürün ve karantina kontrolü; ayrı kayıtlı TEST
  yeteneği olmadan genel fiyat yazması kapalı.
- Kaynak hassasiyeti korunarak sekiz ondalık saklama; NULL bilinmeyen,
  gerçek sıfır ayrı; kaynağa sessiz geri düşme yok.
- Değişmez sürüm ve istek geçmişi; aynı UUID/body ikinci sürüm üretmez;
  farklı body veya eski güncel sürüm çakışması reddedilir.
- Yeni satış güncel izinli fiyat sürümünü; eski belge kendi kayıtlı fiyatını
  okur. Yalnız metadata kaydetmek veya API eklemek bu işi tamamlamaz.
- Bağımsız native kanıt, normal ürün kartı, ilgili hedefli testler, çalışan
  paket ve uzak GitHub teslimi ayrı ayrı doğrulanır.

Mevcut TEST125/DB02, finans/stok kayıtları, maliyetler, fotoğraflar,
karantinalar ve kullanıcı rolleri korunur. İnsan kabulü bekler.

## İlk kaynak alt teslimi

Fiyat metadata derleyicisi ve native kayıt doğrulayıcısı, API model/store/service
ve normal ekran için henüz bağlanmamış fiyat düzenleyici hazırlandı. 33 hedefli
çevrimdışı kontrol geçti; bağımsız kaynak incelemesi bu kapalı hazırlık için GO.
Yanlış döviz/kademedeki geçmişin ekran başarı sonucu sayılması incelemede
bulundu ve tam tuple karşılaştırmasıyla kapatıldı.

Sentetik derleyici çıktısı SQL Server `PARSEONLY` ile sözdizimi kontrolünden
geçti. Bu kontrolde SQL nesnesi oluşturulmadı ve ticari yazma yapılmadı;
native uygulama, rollback veya tekrar güvenliği kanıtı değildir.

Kayıt doğrulayıcısının `canEdit=false` durumu sürer. API route/startup
bağlantısı, veritabanı kurulumu, satış tüketicisi aktivasyonu, başarılı native
fiyat kaydı/replay, normal ekran kabulü ve yeni TEST paketi **henüz yok**.
Çalışan source `2bf2762` korunur; hazırlık bir çalışan özellik sayılmaz.

Kaynak alt teslimi `cfccdf4920134567834ced3fea41fc78fc3e7075`,
`codex/erp-finish-20261004` ve PR #23 üzerinde uzak SHA ile doğrulandı.
21 dosya; yerel secret taraması 0 bulgu. Bu commit'in altı hosted CI
kontrolü hesap ödeme/harcama sınırı nedeniyle başlamadı; kontrol açıklaması
`115253995324` üzerinde doğrulandı. Vercel önizleme başarısı bu CI'nin
yerine geçmez. Çalışan paket ve veritabanı hâlâ değişmedi.

## İkinci kaynak kesiti — normal katalog ve satış tüketicisi

Normal kart editörü, tek toplu katalog fiyat okuması, sınırlı route/startup
bağlantısı ve ayrı satış tüketicisi hazırlandı. Yeni satış CURRENT sürümünü,
önceden oluşturulan belge immutable HISTORY fiyatını kullanır. Eski SOURCE
belgeleri eski owner yolunda kalır. NULL fiyat bilinmeyen olarak gösterilir,
satışa eklenmez; sıfır ve kaynak fiyatına geri dönüşle karıştırılmaz.

Gerçek DB02 v11 kimliği salt okunur doğrulandı. Yeni 20 DDL adımı gerçek SQL
Server'da aynı transaction içinde derlenip geri alındı; yeni nesne kalmadı.
Bu prova aggregate içindeki alt sorgu hatasını yakaladı; per-product CROSS
APPLY ile düzeltildi ve aynı dar prova geçti. Kalıcı kurulum, fiyat yazması
ve native fiyat replay kanıtı henüz yoktur.

Katalog sayfalamasında tek toplu GET kullanılır; tam başlangıç/yazma
doğrulaması korunur. Sidebar ve aktör değişimi editörün bekleyen isteğini
korur. Yetki geri çekilirse pending istek değişmeden saklanır, yeni POST
yapılmadan salt okunur çıkış mümkündür. Bağımsız kaynak incelemesindeki
gezinme ve yetki kaybı bulguları kapatıldı.

API/derleyici hedefli kesiti 106 PASS; 7 özel kaynak gerektiren kontrol
ayrıca hash-pinned kaynakla 7/7 PASS; UI kesiti 35 PASS ve frontend build başarılı. Modeled
CURRENT/HISTORY/store kontrolleri gerçek SQL fiyat uygulaması değildir.
Hosted CI'ye dört fiyat derleyici/bootstrap test dosyası eklendi;
özel kaynak bulunmayan kontroller açık SKIP kalır, SQL erişimi eklenmez.

Çalışan source **2bf2762** değişmedi. Yeni private startup descriptor olmadan
bu kaynak kesiti fiyat yazmasını açmaz. ERP04/C09 ve insan kabulü açık;
sonraki zorunlu iş kalıcı dar TEST kurulumunun eski runtime ile uyumu,
native kayıt/replay, normal ekran ve çalışan paket kanıtıdır.

## Üçüncü kesit — native kurulum ve geri alınan gerçek fiyat provası

13 Ekim'de yeni fiyat alanı DB02'ye runtime kapalıyken kuruldu. İlk gerçek
okuma SQL Server'ın `kind IN (...)` CHECK ifadesini eşdeğer iki OR eşitliği
olarak sakladığını gösterdi. Doğrulayıcı yalnız aynı iki sabit değerin sonlu
eşdeğer biçimlerini kabul eder; ek değer, OR 1=1 veya farklı sabit kabul edilmez.
Boş geçmiş native JSON yanıtında NULL dönüyordu; GET ve SET journal kartları
artık açık `[]` döndürür. API modeli array zorunluluğunu korur.

Düzeltme, exact eski modül hashleri ve boş V/C/R + fiyatlı belge/journal yokluğu
kanıtıyla yalnız yeni 20 nesneye aynı SERIALIZABLE/Exclusive transaction içinde
uygulandı. Eski modüller ve 14 korunan tablonun tam satır hashleri/sayıları aynı.
Metadata sürümü `12CC03BC410804FF88EFE673E0909330F81877E970E789677230E056D8D52557`,
tüketici `E9E4D83BB93263BB67BFE7F1B07AA53E25D54973206811E2147D16E964E59078`.

Gerçek kısıtlı SQL bağlantısında canonical V11 + metadata + tüketici doğrulaması
ve normal store yolu geçti. Aynı native transactionda A gerçek sıfır, B NULL
kaydedildi; A'nın aynı UUID/body tekrarı A'nın değişmez yanıtını verdi, güncel
pointer B ve iki geçmiş kaydı korundu. Transaction geri alındı ve yeni okuma
ilk kartla birebir aynıydı. Kalıcı fiyat/ticari hareket yazması yok; SQL identity
sayacında rollback boşluğu olabilir ve sayaca müdahale edilmedi. 18 hedefli
kaynak testi geçti. Private kanıt: ERP-COMPLETE01-20261013/private/erp04-price-write;
ham kartlar, SQL ve özel yapılandırma repoya alınmadı.

Mevcut 11 Ekim DB02 copy-only/checksum yedeğinin referansı/dosya varlığı taze
kontrol edildi. Önceki restore kanıtı korundu; bu kesitte yeni restore yapılmadı.
Yeni satış/history tüketimi, olumsuz native kontroller, normal ekran/paket hâlâ
ayrı açık koşullardır. Çalışan 2bf2762 ve TEST125 değişmedi; e8e42ef paketi boş
geçmiş düzeltmesinden önceki inactive hazırlıktır ve aktive edilmeyecektir.

## Native tüketici yanıtı düzeltmesi

Kaynak kesiti `c94bf781197ddfbd52d004a939a1ebf131285492` uzak PR #23
head'i olarak doğrulandı. Altı hosted CI yine hesap ödeme/harcama engeliyle
başlamadı (check 115279302073 açıklaması); yerel kanıt CI yerine sayılmaz.

Gerçek restricted native olumsuz prova dokuz durumu beklenen SQL hata koduyla
reddetti: yetkisiz aktör, aynı UUID/farklı body, eski kart sürümü, yanlış döviz,
yanlış birim, fazladan alan ve üç metadata tablosuna doğrudan UPDATE.
Her ayrı transaction rollback sonrası kart ilk haliyle aynı; bağımsız SQL'de
V/C/R 0/0/0, fiyatlı link ve pricing intent 0. Bu kanıt manuel fiyat owner'ına
aittir; satışın tüketici kabulü ayrıca gerekir.

Tüketici CURRENT gerçek okuması eksik ürün fiyat dizisini reddetti. Dar native
SQL probu `OPENJSON ... WITH(value ... '$' AS JSON)` ifadesinin bu sunucuda
NULL döndürdüğünü gösterdi. Kaynak quote JSON'u artık doğrudan `raw.value` ile
korunur; fiyat kimliği/döviz/tutar JSON kontrolü eklenir. Pure proof kontrolü
gevşetilmedi. Özel V11 kaynakla yedi compiler kontrolü geçti. Bu kesitte
tüketicinin yeniden native doğrulanması ve normal ekran hâlâ beklemektedir.

## Paket ve native CURRENT kanıtı — 13 Ekim

`0da9f3d70d1441900a7b412c0f0b170f75248c94` uzak PR #23 head'i olarak
doğrulandı. Altı hosted kontrol hesap ödeme/harcama engeliyle başlamadı
(check 115282697024); yerel sonuçlar CI veya insan kabulü değildir.

Metadata `12CC03BC…D52557` aynen korunarak yalnız dokuz tüketici nesnesi
`B174E6F0…6461F` sürümüne geçti. Eski tüketici hashleri, boş fiyat
metadata/link/journal koşulları ve korunan 14 tablonun tam satır karşılaştırması
aynı transaction içinde doğrulandı. Kaynak fiyat, stok ve cari yazması yok.

Restricted native CURRENT artık gerçek kaynak fiyat listesini doğruluyor.
Tek geri alınan NULL fiyat kaydı CURRENT'ta MANUAL/NULL olarak okundu;
satış önizlemesi `WORK_PRICE_UNKNOWN` ile reddedildi. Kaynak fiyatına geri
dönülmedi; ayrı SOURCE okuyucusu aynı kaynak değerini korudu. Transaction
rollback edildi. Bu aktör altında eski fiyatlı belge bulunmadığından HISTORY
başarılı sayılmadı; gerçek draft/journal yolu üzerinden ayrı rollback provası
zorunlu açık koşul olarak sürüyor.

1917 dosyalı `CANONICAL-COMPLETE-TEST-20261011-0da9f3d` paketi derlendi;
manifest `18a0aed3774fe0efb38dd9f01bb58e085efbf53c0eadf6be9bc1e3cb73f39a93`.
Yalnız hazırlık ve aktivasyon ön kontrolü tamamlandı; bu kayıt anında çalışan
paket hâlâ `2bf2762`, yeni paket aktive edilmedi.

Aynı normal katalog API'sinde aktör 16 ile beş rotanın üçer salt okunur
ölçümü alındı. Medyanlar: ilk 50 ürün 3391 ms, sonraki 50 ürün 3073 ms,
kod 2920 ms, barkod 2540 ms, kart 2307 ms. Her rotanın üç veri hash'i aynı;
yalnız ölçümün kendi oturumu kapatıldı. Bunlar yeni özellik öncesi baseline;
eski hız hedefinin sağlandığı veya yeni paketin performansı anlamına gelmez.

## Gerçek native belge geçmişi ve rollback

Aynı `0da9f3d` paketinin gerçek ODBC sürücüsü ve uygulama korumalarıyla
normal satış aktörü 15, ayrı fiyat aktörü 16 kullanıldı; rol veya admin bayrağı
eklenmedi. Tek SERIALIZABLE/Exclusive transactionda fiyat A kaydedildi,
canonical BEGIN/INTENT ve native draft servisi gerçek taslak/journal üretti.
Fiyat B'ye geçildiğinde CURRENT B oldu; HISTORY A'nın exact fiyatını,
sürümünü, JSON'unu ve hash'ini korudu. Gerçek UUID replay ikinci draft
callback'ine girmedi. Mevcut eski SOURCE belgesi de kendi kaynağıyla okundu.

Stok, hesap ve hareket sayıları aynı kaldı; finalize çağrısı yok. Son commit
yerine gerçek rollback çalıştı. Sonraki native sorguda invoice/item/link/journal
kalıntısı sıfır; bağımsız SQL'de fiyat V/C/R 0/0/0, fiyatlı link 0 ve
`OPENJSON` ile denetlenen pricing intent 0. SQL identity boşlukları olabilir;
sayaca müdahale yok. Bu geri alınan teknik prova insan kabulü değildir.

Private `historical-sale-rollback-proof.json` tüm 12 coverage alanını true ve
missing listesini boş kaydetti. Native tüketici NULL/replay/rol olumsuz kanıtları
ile birlikte normal ekran/paket doğrulamasının ön koşulu tamamlandı.

CRM'nin canonical katalog rotası aynı fiyat overlay'ini tüketiyor. Ancak eski
CRM V2 sipariş sözleşmesi manuel sürüm bilgisini taşımıyor ve kaynak fiyatı
eşitliğini koruyor: farklı manuel fiyatlı sipariş `CRM_V2_PRODUCT_CHANGED`
ile reddedilir. Bu kaynak incelemesi CRM sahibine mevcut sipariş işi altında
aktarıldı. Kaynak eşitliği gevşetilmeyecek; sürümlü fiyatı donduran ayrı
tüketici bağlantısı ve gerçek CRM kabulü açık. ERP normal fiyat yazması
kanıtı, bütün ortak sipariş akışının tamamlandığı anlamına gelmez.

## Normal ekran ve liste regresyonu düzeltmesi

0da9f3d paketi gerçek DB02/5234/4184/4186 üzerinde etkinleştirildi; altı core
süreç, Hub, TEST125 ve CRM kaynakları doğrulandı. Normal API'de fiyat okuması
200 olmasına rağmen ekranın mevcut oturum allowlist'i current-prices yolunu
reddetti. Yalnız doğrulanmış DB02 web/API çifti, tam ürün yolu ve mevcut
product.view/purchase.view/product.price.edit ile dar GET/POST bağlantısı
eklenir. 403 oturumu silmez; POST'un aynı UUID/gövdesi ve sınırlı bekleme
süresi korunur. Eski TEST veya başka rotalar yazmaya açılmaz.

İlk etkin pakette üç örnek medyanı: ilk50 3391→4894 ms, sonraki50
3073→5642 ms; kod2920→2705, barkod2540→2460, kart2307→2346. Veri hashleri
aynı kaldı. Liste gerilemesi kabul edilmedi. Native BULK'a50 yerine yalnız
mühürlü copy ile kesin ID kesişimi gönderilir (bu sayfalarda2/3 ürün); bütün
yerel fiyat/hold/aktör/sürüm/transaction kanıtları aynı çağrıda korunur. Kapsam
dışı satırlar ve sıralama değişmez. SQL tanımı veya native revision değişmez.
Kazanç henüz yeni paket üzerinde ölçülmedi.

Normal fiyat kartı mevcut doğrulanmış son değişiklikleri önce/sonra tutar,
döviz, gerekçe ve tarih/saatle gösterir. Bu kaynak düzeltmeleri henüz çalışan
pakete alınmadı; kalıcı ekran kaydı ve insan kabulü bekler.


## 20 Ekim — ERP04 / A02–C09 gecikmiş fiyat yanıtında bekleyen kaydı koruma

`DOT-ERP-PRICE-PENDING-CAS-20261020-1515`: mevcut normal fiyat düzenleyicisinde A isteği beklerken storage kaydı B ile değiştiğinde, gecikmiş HTTP400/403/409 yanıtı A/rejected yazarak B kurtarma kaydını eziyordu. Mevcut controller integration düzeneğinde 400/new-request regresyonu önce FAIL; aynı isteğin normal ret kontrolü PASS olarak kanıtlandı.

Yalnız editor ve mevcut integration testleri değişti: POST öncesinde ve saved/rejected yazmadan hemen önce mevcut actor/product/copy/seal, pending durumu ve tüm request body (expectedRevision dahil) tekrar doğrulanır. Senkron read/compare/write arasında await yok; bu, sekmeler arasında küresel atomiklik garantisi değildir. Kaybolan/değişen/bozuk/okunamayan kayıt veya setItem hatasında eski bellekteki istek devre dışı kalır; başarı/ret ilan edilmez, yalnız GET ile yeniden yükleme sunulur. Eski retry referansı ikinci POST oluşturmaz; normal ret, aynı UUID/body replay, saved sonrası salt GET yenileme ve readonly-close korunur.

Root21/21 hedef PASS, skip0:17 controller integration +4 saf model testi. Yedi yeni testte42 gecikmiş ret varyantı,3 normal ret,4 storage okuma/yazma hatası,3 gecikmiş acknowledgement,2 aynı-instance farklı-copy/seal remount ve1 disposed-editor,2 GET bekleyen remount alt senaryosu vardır. İlk review, sent envelope yerine yalnız current context karşılaştırmasındaki P2'yi bağımsız bellek provasıyla doğruladı; doğrudan sent actor/product/copy/seal karşılaştırması ve yalnız kendi pending nesnesini temizleme ile kapatıldı. İkinci review P2'si, yeni GET beklerken eski context'in finally ile çizilmesiydi; loading kapısı ve iki deferred-GET regresyonuyla kapatıldı. Son finally yalnız yükleme tamamlanmış mevcut context'i boyar; eski generation yeni kaydı veya UI mesajını değiştirmez. İki değişen kaynağın redacted stdin sır taraması0bulgu; scanner/istisna değişmedi. Bağımsız final review GO; açıkP1/P2=0, son3 hedef PASS/0skip (önceki20PASS ayrı kapsam). Exact source CI makbuzu push sonrası ayrıca kaydedilir.

Bu teslim kaynak/offline kapsamındadır; runtime/SQL/GUI/kurulum/prova veya rol/fiyat/finans yazması yok. Kurulu TEST ve kanonik package-npm.test.mjs yerel değişikliği korundu. 49ERP+25CRM, native Goal PAUSED ve özgün insan kabulü BEKLİYOR aynı. P03 kilit/yükseltme engeli bu kaynaktan bağımsızdır.
