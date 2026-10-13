# ERP04 / C09 — normal ürün fiyatını sürümlü kaydetme

Durum: **uygulama sürüyor; çalışan fiyat yazıcısı henüz teslim edilmedi**.
Ana kapsam ERP-COMPLETE01 / ERP-DEC-050/053/054/055; PR #23.

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
