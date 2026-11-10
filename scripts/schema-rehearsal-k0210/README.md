# K02-10 ayrı şema provası — çevrimdışı kaynak

Bu dizin yalnız `Semih\MELISAERP / MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210`
için kaynak uyarlamasıdır. Modüller SQL bağlantısı açmaz, komut çalıştırmaz,
veritabanı/hesap oluşturmaz ve yürütme yetkisi vermez. Üretilen SQL bir
önizlemedir; `executionAuthorized:false` ve `sqlTested:false` kalır.

Onaylanan kapsam yeni hedef uyarlaması, sentetik yanlış/eksik hedef testleri,
bağımsız kaynak incelemesi ve hedef oluşturma planıdır. Gerçek hedef oluşturma,
SQL envanteri bağlantısı, şema kurulumu ve geçiş yürütmesi ayrı teknik karara
bağlıdır. Sentetik kimlikler gerçek veritabanı kimliği veya yürütme izni değildir.

## Başlangıç ve sınır

Yeni boş hedefte V1'in 27 tablosu; bunların içinde üç yerel katalog tablosu ve
ayrı kurulum işaretçisi bulunur. V1→V2 sınırı dokuz yeni ilk satış tablosu,
işaretçinin V2/yazılabilir durumuna geçmesi ve boş, atanmasız veritabanı rolüdür.
Yeni login, uygulama kullanıcısı, parola, GRANT veya rol üyeliği bu kapsamda yoktur.
Ticari tabloların boş olması korunur; bu, dolu ticari verinin taşınması deneyi değildir.

Başlangıç DDL'i mevcut derleyicilerin varsayılan çevrimdışı çıktısından alınır:
iki tam kaynak sonucu ve batch sırası SHA-256 ile sabittir. Her batch'te tam eski
guard prefix'i doğrulanıp yalnız bu prefix çıkarılır; gövde değiştirilmez. Yeni
hedef guard'ı ayrı eklenir. Eski hedefin ortam kimliğini taşıyan işaretçi yerine
yeni hedefin ortam kimliğiyle açık bir şablon üretilir. Genel SQL metni değiştirme,
eski allowlist'i genişletme veya eski yürütme betiklerini çağırma yapılmaz.

Mevcut Desktop TEST, LAB/LAB2 ve restore kopyası korunur. Yeni hedefin adı, gerçek
DB ID/GUID'i, SQL süreci, yönetici SID'i, ham SQL oluşturma zamanı ve ayrı ortam
kimliği kanıtlanmalıdır. Ad uygun olsa bile eksik veya yanlış kimlik reddedilir.
İstemci process/host alanı tek başına güvenilir işletim sistemi sahipliği kanıtı
değildir; gelecekteki yürütücü gerçek süreç ve oturumu ayrıca doğrulamalıdır.

## Hedefli doğrulama

Node yerleşik test çalıştırıcısı kullanılır; SQL, uygulama bağımlılığı veya yerel
derleme gerekmez:

```powershell
node --test scripts/schema-rehearsal-k0210/identity.test.mjs scripts/schema-rehearsal-k0210/foundation.test.mjs scripts/schema-rehearsal-k0210/transition.test.mjs
```

Aynı komut Windows CI işine de bağlıdır. Test sonucu kaynak davranışını kanıtlar;
gerçek SQL sözdizimi, SQL izinleri, kilit/transaction sonucu veya kurulum kabulü
olarak sunulmaz.

Semantik karşılaştırma eski şema projeksiyonunu ve izin verilen yeni nesne
sınırlarını kontrol eder; yeni dokuz tablonun tüm SQL Server metadata biçimini
ham DDL'den türeten ikinci bir şema motoru değildir. Yeni şema ayrıntılarının
bağı, sabit DDL ile gerçek geri alma denemesinden alınacak adayın semantik hash'i
ve uygulama sonrasındaki bağımsız okumadır. Gelecekteki yürütücü, aday JSON'un
gerçek denemeye ait olduğunu SQL/kaynak hash'i ve süreç/observer receipt'leriyle
ayrıca doğrulamalıdır. Karşılaştırıcı tek başına süreç kökeni, geri alma başarısı
veya dosya bütünlüğü yetkisi üretmez; bellek içi bir review nesnesi de bu kanıtların
yerine geçmez.

## SQL Server 2022 dilbilgisi kontrolü

SQL Server'ın ayırdığı `ROWCOUNT` adı, anlık görüntü sorgusunda hem
`AS [rowCount]` hem `x.[rowCount]` biçiminde sınırlandırılır. JSON alanının adı
`rowCount` ve güvenlik kontrolleri değişmez.

Çevrimdışı kontrol için Microsoft'un `Microsoft.SqlServer.TransactSql.ScriptDom`
161.8901.0 paketindeki `lib/netstandard2.0` DLL'i kullanılır. Beklenen SHA-256:
`dda9fb7d3a752183a0727a6f31bc7da04cbbc19f9d792792d7d468f74ccebc02`.
PowerShell 7.6 ile, DLL yolunu belirterek:

```powershell
node scripts/schema-rehearsal-k0210/syntax-fixture.mjs > "$env:TEMP/k0210-synthetic-syntax.json"
pwsh -NoProfile -File scripts/schema-rehearsal-k0210/syntax-parser.test.ps1 -ScriptDomDll '<ScriptDom DLL yolu>' -FixtureFile "$env:TEMP/k0210-synthetic-syntax.json"
```

Altı sentetik çıktı ve AST ile çıkarılan 73 sabit dinamik SQL gövdesi
`TSql160Parser` ile ayrıştırılır. Olumsuz kontroller, ayrılmış adın açık kullanımını
ve dış sorgu geçse de hatalı iç SQL'in reddini doğrular. Bu yerel test SQL'e
bağlanmaz; ad bağlama, izin, transaction, bootstrap veya kurulum sonucu değildir.
Mevcut Node CI kontrollerinden ayrı bir yerel dilbilgisi kanıtıdır.

## Boş metadata koleksiyonları

`sys.synonyms` ve kullanıcı tanımlı türler boşken iç `FOR JSON` sorgusu NULL
üretebilir. Bu iki projeksiyon SQL tarafında `JSON_QUERY(COALESCE(...,N'[]'))`
ile boş dizi üretir; dolu koleksiyonun alanları ve sırası aynı kalır. Diğer sekiz
semantik parça ve nullable scalar metadata değişmez. İstemci NULL'ı boş diziye
çevirmediği için katı şekil ve UTF16 hash kontrolleri korunur. Gerçek boş katalog
kalibrasyonu, kaynak testleri, kurulum ve bağımsız V1 başlangıç ölçümü ayrı
kanıtlardır; yeni sorgu çıktısı eski başarısız okumayı PASS yapmaz.

## Sonraki ayrı karar

Somut yerel plan `Masaüstü/ERP/kurulum/k02-10-offline-source-v1/provisioning-plan.json`
altında tutulur. Plan yeni dosya yollarını, boyut sınırlarını, ad/alan/model
kontrollerini ve korunacak hedefleri tanımlar. Canlı envanter, yönetici erişimi,
dosya yokluğu, model temizliği ve kapasite henüz doğrulanmamıştır; bunlar uygun
değilse otomatik alternatif hedef, eski LAB tekrarı veya restore kopyasını
kullanma yoktur.

Hedef oluşturma kararı, bootstrap/DDL yürütme yetkisi değildir. Oluşturma sonrası
gerçek kimlikler ve bağımsız başlangıç ölçümüyle SQL önizlemeleri yeniden
sabitlenip ayrı değerlendirilmelidir. Transaction geri alması ile kalıcı V2→V1
down migration farklı kabullerdir. Bu tek sınır tüm V1–V7 geçişleri, tam K02-10,
normal ekran, insan veya LIVE kabulü değildir. İlk hata veya belirsiz sonuçta
durulur; sonraki adımlar `NOT_RUN`, önceki deneme kimliği ve kanıtı korunur.
