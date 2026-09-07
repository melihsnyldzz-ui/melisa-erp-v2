# Commercial read-only MCP

Current review package (not deployed): [7 September 2026 coverage, evidence,
permission gaps and release steps](commercial-mcp-review-20260907.md).
The original deployment notes below describe the earlier 10-tool baseline.
For the 25-tool review version, follow the new report's null/unit rules,
administrator/customer boundary and explicit publication approval requirements.

Approved scope: extend the existing four MCP tools with a dataset catalogue,
typed query/aggregation, record and document reads for configured Vega and Melisa
sources. No Melisa AI changes, database writes, migrations, permission changes,
main merge or normal ERP service restart are included.

Implementation lives under `apps/api/src/mcp/commercial/`, with the existing MCP
server as the only published entry point. SQL credentials remain in separate
dedicated SELECT-only pools. No fallback to the normal ERP pool is permitted.

Risks and controls: metadata visibility is not proof of absence; unverified field
meanings and document relationships are explicitly labelled or blocked; monetary
totals require verified currency context; keyset cursors bind to the complete
query; permissions, input, time, concurrency and output limits fail closed.

Validation: existing read-only tool regression, synthetic adversarial query and
pagination tests, effective SQL permission checks, bounded live family reads,
and same-scope comparisons with ERP read calculations. Live rows and secret
configuration are excluded from Git. Only the MCP runtime may be replaced after
an isolated loopback preflight passes; the previous runner is the rollback path.

Detailed verified coverage and remaining mapping/permission gaps are recorded
in the delivery report; code completion alone does not imply complete data access.

## Çalıştırma ve sınırlar

Geliştirme dalı: `feat/mcp-commercial-readonly`. Başlangıç, çalışan PR #8
`dc70b9e` sürümüdür; çalışan worktree'deki beş yerel dosya korunarak taşınmıştır.
Normal ERP, Bionic API ve REST gateway değiştirilmez. MCP yalnız loopback'te
dinler; mevcut OpenAI Secure MCP Tunnel aynı `127.0.0.1:4113/mcp` hedefini kullanır.

```powershell
./scripts/start-commercial-readonly-mcp.ps1 -SecretDirectory C:\approved-local-secret-storage -McpPort 4113
```

Secret dizini repo dışında olmalıdır. `vega.env`, `bionic.env`, `external.env`
mevcut özel yerel yapılandırmalardır; örnek komutta gerçek sır bulunmaz.
Başlatıcı normal SQL ve OpenAI değişkenlerini alt proses ortamından temizler,
yalnız özel `BIONIC_` bağlantılarını yükler. Melisa ve Vega ayrı havuzlardadır.
Kimlik/etkili yetki doğrulaması başarısızsa ilgili kaynak kapalıdır; normal ERP
hesabına geçiş yoktur. SQL rolleri veya izinleri bu uygulama tarafından değiştirilmez.

Her veri sorgusu için izinler kontrol edilir. Girdi 64 KB, çıktı 192 KB,
tek metin alanı 4.000 karakter, alan seçimi 40, filtre 12, `in` listesi 25 değer,
eşzamanlı araç çağrısı 2 ve dakikalık HTTP isteği 180 ile sınırlıdır. SQL veri
sorgusunun süresi 12 saniyedir ve `MAXDOP 1` kullanır. Katalog keşfi ayrı,
15 saniyelik sınırlı metadata parçalarıyla yapılır; ilk keşif yaklaşık 30 saniye
sürebilir. Kimlik doğrulaması bütün yollar için zorunludur.

Denetim kaydı secret dizininin `commercial-audit` alt dizinindedir. Yalnız zaman,
istek kimliği, araç adı, sonuç kodu, süre ve kayıt sayısı yazılır. Sorgu metni,
filtre değeri, kişi bilgisi, sonuç gövdesi veya sır yazılmaz. Dört adet yaklaşık
5 MB dosyayla döndürülür. Denetim kaydı yazılamazsa araç işlemi kapalıdır.

## Araç sözleşmesi

Mevcut araçlar korunur: `get_stock_count`, `search_products`, `get_product`,
`erp_readonly_health`. Eklenen araçlar:

| Araç | Davranış |
|---|---|
| `list_datasets` | Görünen bütün tablo/görünümleri, dışlanan güvenlik nesnelerini ve erişim engellerini listeler. |
| `describe_dataset` | İzinli alanlar, SQL tipi, doğrulanmış/ham anlam, anahtarlar, ilişkiler ve filtreleri açıklar. Alan listesi de sayfalanır. |
| `query_dataset` | Tek veri kümesinde parametreli filtre, alan seçimi ve anahtara göre sayfalama. |
| `aggregate_dataset` | Filtrenin tamamını SQL'de hesaplar; sonuç grupları ayrıca sayfalanır. |
| `get_record` | Tam birincil/benzersiz anahtar ile tek kayıt. |
| `get_document` | Aynı firma/dönemde doğrulanmış alış veya satış faturası başlığı ve satırları. |

Her sayfa en fazla 50 kayıttır. `nextCursor` varsa aynı alan/filtrelerle devam
edilir; bu toplam erişim sınırı değildir. İmleçler AES-GCM ile korunur,
veri kümesine, şemaya ve sorguya bağlıdır; 15 dakikada sona erer. Kaynak verisi
eşzamanlı değişebileceğinden tarihsel snapshot garantisi verilmez. Güvenli
benzersiz anahtarı olmayan nesnelerde kayıt sayfalaması kapalıdır; izinli
alanlar üzerinden sayım ve gruplama yapılabilir.

Serbest SQL, ifade, fonksiyon, JOIN veya sıralama ifadesi kabul edilmez.
SQL adları yalnız sunucunun metadata kataloğundan seçilir; filtre değerleri
tür denetiminden sonra parametre olarak bağlanır.
Kayıt sonuçlarında seçilmemiş birim/döviz alanları da aynı SELECT ile okunup
`rowContexts` içinde kaynak anahtarıyla döner. Belge sonuçlarında başlık ve satır
bağlamları ayrıdır; bulunmayan birim/döviz değeri tahmin edilmez.
Para/ondalık/büyük tamsayı
sonuçları hassasiyeti korumak için metindir. `sum/min/max` yalnız alanda
belirtilmişse açıktır; gerekli döviz/birim grubu yoksa reddedilir. Eksik değeri
olan bir tutar grubunun toplamı kesin sıfıra dönüştürülmez, `null` döner.

Kişisel iletişim alanları varsayılan seçime dahil değildir. Açık alan seçimi,
`includePersonalData=true`, gerekçe ve bütün anahtar alanlarında eşitlik
gerektirir. Parola/özet/anahtar/oturum alanları, serbest notlar, opak payload'lar
ve ikili veriler kapalıdır. Eşlemesi bilinmeyen tablolar yalnız gözden geçirilmiş
güvenli ortak alanlarını açar; bunların ticari anlamı doğrulanmış sayılmaz.

## Kaynak ve ticari anlam

Vega kaynağı `VEGA2026`; firmalar F0102 Melisa Bebe, F0103 Melisa Muhasebe,
F0104 Fatura. Genel `TBLDONEM` D0001–D0007 için 2020–2026 eşlemesini verir.
F0102 D0008/2027 kaydı var, ancak bu döneme ait nesne görünürlüğü doğrulanmadı.
Firma içindeki eski dönem tanımları kopya/eski kayıtlar içerir; genel firma/dönem
tanımı esas alınır. Gerçek hareket tarihleri bazı dönemlerde yıl dışına taşar.
Bu nedenle dönem yılı tarih filtresi değildir; farklı firma/dönemler sessizce
birleştirilmez.

Melisa kaynağı `MELISA_ERP_V2` ve yerel türetilmiş veridir; Vega canlı kartı ile
aynı kabul edilmez. Hesap yalnız products, product_barcodes, product_images,
suppliers nesnelerini görebilmektedir. Diğer ticari nesneler için
`commercial-select-grants.REVIEW-ONLY.sql` hazırlanmıştır; uygulanmamıştır.
Görünmezlik, tablonun olmadığına kanıt değildir. Yönetici incelemesi ve gerekli
SELECT izni olmadan bu nesneler açılamaz; yeni kullanıcı, geniş rol veya
yönetici havuzu kullanılmaz.

Vega'daki ham tablolar yanında açık firma/dönemli ERP hesap veri kümeleri vardır:

- `vega.erp.F0102D0007_erp_stock_quantity`: ERP hareket toplamı; hareket yoksa
  kart bakiyesi. Tarihsel kart geri dönüşü tarihsel kapanış stoğu değildir.
- `vega.erp.F0102D0007_erp_account_ledger`: 30/31 dışındaki cari hareketler,
  kayıtlı kura bölünen borç/alacak etkisi. Kart raporuyla karşılaştırmada
  `card_currency_matches=true` ve aynı kart/döviz filtreleri kullanılır.
- `vega.erp.F0102D0007_erp_sales_comparison_basis`: mevcut ERP karşılaştırma
  raporunun 33 kodlu pozitif borç/kuru esas alan hesabı. Genel net satış değildir.
- `vega.erp.F0102D0007_erp_posted_sales_basis`: ERP kârlılık servisindeki 33/34,
  iade ve pozitif miktar/tutar kuralları; başlık kimliği ve iptal durumu ayrıca
  doğrulanır. Eşleşmeyen/belirsiz/iptal kaydın parasal sonucu `null` olur.
  Devir ve diğer stok çıkışları satışa dahil edilmez. Maliyet/kâr hesaplanmaz.

F0102'nin satış/iade hesapları diğer firmalara otomatik genellenmez. Belge
başlığı/satır ilişkisi başka belge ailelerinde doğrulanmamışsa `get_document`
kapalıdır; izinli ham başlık/satır tabloları genel sorguyla yine okunabilir.
Fiyat alanının adı, fiyatın güncel teklif ya da doğru birimde olduğu anlamına gelmez.

## Örnek yapılandırılmış çağrılar

```json
{"name":"list_datasets","arguments":{"source":"vega","company":"F0102","period":"D0007","limit":50}}
```

```json
{"name":"aggregate_dataset","arguments":{"dataset":"vega.dbo.F0102TBLSTOKLAR","groupBy":["STATUS","DELETED"],"metrics":[{"op":"count","as":"cards"}]}}
```

```json
{"name":"query_dataset","arguments":{"dataset":"vega.dbo.F0102D0007TBLSTOKHAREKETLERI","fields":["IND","STOKNO","TARIH","GIREN","CIKAN","IZAHAT","IADE","BIRIMEX"],"limit":50}}
```

## Doğrulama ve geri dönüş

`apps/api` içinde `npm run test:mcp-commercial` yapısal/güvenlik testlerini çalıştırır.
`commercial.sql.test.js` yalnız `MCP_READ_ONLY_SQL_TESTS=true` ve özel read-only
ortam değişkenleriyle açılır. SQL motorundaki bu test sadece literal `VALUES`
kümelerine SELECT yapar; tablo oluşturmaz ve ticari kayda dokunmaz.

Canlı kabul testleri initialize, 10 araç listesi, eski araçların gerçek stok
okumaları, 100 farklı kaydın iki sayfada okunması, alan/izin/girdi hataları,
her veri ailesinden sınırlı okumalar, alış/satış fatura satırları, dönem tarihleri
ve ERP raporlarıyla karşılaştırmayı kapsar. Boş örnek sonucu o ailenin bütün
geçmişinin boş olduğu anlamına gelmez. Tam net satış toplamı `null` ise teknik
çağrı başarılı olsa da ticari toplam doğrulanmış kabul edilmez.

Geri dönüş: yalnız 4113 MCP prosesinin sahipliği doğrulanarak durdurulur ve
korunan eski `run-secure-mcp-pr8.ps1` çalıştırılır. 4100/4111/4112 ve OpenAI
tünel yönetimi aynı kalır. Bu çalışma main'e merge edilmez, üretim veritabanı
şeması veya izinleri değiştirilmez. ChatGPT'deki önbelleğe alınmış araç listesinin
yenilenmesi ve gerçek sohbetten yeni araç çağrısı ayrıca doğrulanmalıdır.
