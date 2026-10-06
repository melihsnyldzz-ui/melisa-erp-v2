# Goal3 ödeme fixture sözleşmesi — 6 Ekim 2026

Bu belge yalnız yeni kaynak sözleşmesini tarif eder. SQL kurulumu, gerçek API denemesi veya kullanıcı kabulü yapılmış sayılmaz. Operatör root bu kaynakları bağımsız inceleme ve hedef TEST kimliği doğrulamasından sonra kurar. Kaynak tabanı TEST58 `93365d0baf002e93010a2759bd45af2af11040e7`; eski gece, inbound, C03/C09 ve ödeme kayıtları korunur.

Hedef yalnız `Semih\MELISADEV` / `MELISA_ERP_SIRKET_TEST_20260929_01`. Kaynak `scripts/canonical/enable-test-work-finops-fixture.mjs`; üretilen SQL ve bağımsız API hash sabitleri aynı generator çıktısıdır. Generator SQL bağlantısı açmaz. Kurulum sysadmin operatörün mevcut **SERIALIZABLE dış transaction**'ını zorunlu tutar; kendi COMMIT'i yoktur. ValidateOnly ve kurulum kararını operatör verir.

## Dar fixture

| Para | Tedarikçi | Hesap | Borç kaynağı |
|---|---|---|---|
| TRY | Yeni `TEST-V70-FINOPS-S` | Yeni `TEST-V70-PAY-FINOPS`, cash, açık deneme açılışı1000 | Yeni kabul → finalized alış300 |
| USD | Mevcut13371 `TEST-V70-PAY-USD` | Mevcut33, bank, açılış1000 | Gerçek native deneme açılış defteri300 |
| EUR | Mevcut13372 `TEST-V70-PAY-EUR` | Mevcut34, bank, açılış1000 | Gerçek native deneme açılış defteri300 |

Bank türü, deneme ERP hesabının türüdür; gerçek banka bağlantısı, IBAN veya ekstresi doğrulanmış değildir. TRY kasa açılışı bilinen ve açıkça yetkilendirilmiş sentetik1000'dır; ticari kaynaktan veya bilinmeyen NULL'dan türetilmez. USD/EUR defterlerindeki opening hareket300 zaten cari bakiyeye dahildir; bir kez daha eklenmez. Tedarikçi13370 mevcut−100, eski kasa32 mevcut900 ve eski faturalar25074/25091/25092 yeniden kullanılmaz veya sıfırlanmaz.

Yeni ürün `TEST-DAILY-FINOPS-20261006`, `ADET × 1`, bilinen sentetik birim maliyet60, başlangıç stok0. `work_finops_receipts` tek kayıt5.000 adet fiziksel kabulü açık `explicit-synthetic-test` snapshot'ıyla kaydeder. Native `stock_movements` tek `goods_receipt` hareketi+5.000 ve300TRY maliyet oluşturur; ürün stok5 olur. Bu yeni metadata kaydı eski C01 `test_goods_receipts` kaydı gibi gösterilmez. Native source_id yeni `work_finops_receipts.id`'ye bağlanır; fixture manifest ve owner okuyucu bu bağın tipini doğrular.

`TDAY-FINOPS-20261006` alış önce draft, tek satır5×60, sonra finalized olur. Satır `goods_receipt_already_posted` snapshot'ını taşır; alış ikinci stok etkisi yaratmaz. Tek native supplier `purchase_invoice` hareketi+300TRY borç oluşturur. Yeni iki audit kaydı fiziksel kabul ve finalized alışın yeni run/receipt bağını saklar. Bu fazda ürün, fiziksel kabul, stok hareketi ve finalized fatura immutable kalır. İptal, **ödeme iptali** anlamındadır; yeni alış faturasının iptali bu fazın parçası değildir.

Yeni supplier/account/product kimlikleri sabit tahmin edilmez. Operatör transaction'ında ortak `MELISA-TEST-V70-SALES` exclusive applock ve native tablolarda `TABLOCKX,HOLDLOCK` altında bir sonraki identity değeri rezerv edilir, mevcut id/kod çakışması reddedilir, native INSERT sonrası SCOPE_IDENTITY bire bir kontrol edilir. ValidateOnly rollback bile SQL Server identity sayacında boşluk bırakabilir; operatör bunu kaydeder, identity reset/DBCC yapmaz. Apply yeniden güncel identity'leri rezerv eder; ValidateOnly kimlikleri hardcode edilmez.

Yeni receipt tablosunun identity seed'i aynı transaction ve kilitler altında mevcut `test_goods_receipts.id`, `test_daily_drafts.id` ve native `goods_receipt` source_id değerlerinin en büyüğünden bir fazladır; yalnız yeni tablonun CREATE IDENTITY seed'idir, eski sayaçlar değiştirilmez. Fatura ve ödeme DTO'sunda `receiptKind: work-finops-physical-receipt` açıkça taşınır. Owner receipt/product/source bağını ve bu source_id ile global native goods_receipt hareket sayısının tam1 olduğunu denetler; eski C01 kaydına yanlış JOIN yapılmaz. Gelecekte başka eski akış aynı source_id'yi üretirse doğrulama fail closed olur, eski kaydı yeniden adlandırmaz veya silmez.

## Mevcut korumaların kullanımı

Hiçbir eski trigger/procedure gövdesi, accepted manifest veya rol kaydı değiştirilmez. C01 batch'in13370'e bağlı scope'u genişletilmez. Var olan generic `test_daily_scope` native koruma dalına yalnız yeni `finops-20261006` flow'u ve exact yeni product/supplier/source invoice kimlikleri eklenir. Diğer flow satırlarının tam JSON byte digest'i kurulum öncesi/sonrası aynıdır. Yeni flow'a ek companion trigger postsetup INSERT/UPDATE/DELETE'i engeller.

Eski payment supplier/account üyelik tablolarına yalnız yeni TRY supplier/account, invoice üyeliğine yalnız yeni finalized invoice eklenir. Eski satırlar byte düzeyinde korunur. Yeni `work_finops_scope`, receipt ve manifest owner metadata'sı immutable'dır. Companion native guards yeni TRY ürün/fatura/items/stock'u immutable tutar; yeni supplier/account kimlik alanlarını ve bakiye sınırlarını korur. Yeni payment journal'a bağlanan supplier/finance hareketleri değiştirilemez. Yeni isimler önceden mevcutsa veya yarım kurulum varsa otomatik onarım yapılmaz.

Hazır olma owner'ı offline pinli `work_trade_assert_ready` üzerinden37 quarantine,15 batch,17 FX,22 night mühürlerini doğrular; ayrıca ödeme core guardlarının exact önceden kabul edilen hashlerini, yeni bütün guard/owner gövdelerini, enabled durumunu ve yeni schema/check/index/FK fingerprint'ini doğrular. API kendi offline expected3owner hashini herhangi owner EXEC'inden **önce** bağımsız SQL metadata SELECT ile kontrol eder; dönen selfproof tek başına yeterli değildir.

## API / SQL bağları

- `dbo.usp_work_supplier_payment_ready`: salt okunur readiness assertion.
- `dbo.usp_work_supplier_payment_context @actor_id bigint`: tek satır `context_json,readyHash,contextHash,effectsHash`; yalnız aktif16/`isolated_test_ilker`, gerçek `finance.view` ve `supplier.view`.
- `dbo.usp_work_supplier_payment_effects @request_id uniqueidentifier`: journal/native etkileri denetler; tek satır `valid,readyHash,contextHash,effectsHash`.

Context üç ayrı para birimini toplamaz. TRY tek receipt-linked finalized invoice içerir; USD/EUR invoices[] ve debtKind `opening` içerir. Native exact4 bakiye/tutarlar ve exact8 kur değerleri string'dir. Normal `currency_rates` içinden işlem tarihi2026-10-06'dan geç olmayan en yeni USD/EUR kur satırı kullanılır; C03 sentetik40/45 kuruna bağlanılmaz. Banka hassas alanları okunmaz.

USD/EUR eski payment journal'ındaki özgün ve ters hareketler de tarihçede görünür: `ownership: legacy`, `canCancel: false`. Yeni journal kayıtları `ownership: work`; yalnız yeni özgün ve henüz ters çevrilmemiş payment `canCancel: true` olabilir. Yeni API, cancel etkisinden önce yeni immutable journal üyeliğini ayrıca denetler. Eski legacy ödeme endpoint'i yalnız yeni TRY supplier/invoice'u reddeder ve eski context'e bu fixture'ı eklemez; var olan USD/EUR davranışı korunur. Owner herhangi scoped native payment için yeni journal veya USD/EUR legacy journal kanıtı ister; kayıt dışı native hareketi açılış borcu gibi gizlemez.

`work_supplier_payment_requests` yeni kalıcı UUID journal'ıdır. JSON, backend'in canonical tam flat payload'ıdır: bütün input alanları + `actorId` + `operation`; `payload_hash` SHA-256 UTF16LE uppercase'dır. Replay, aynı actor/operation/tam JSON/hash ile CAS'tan önce eşleşir; başka payload409 verir. Yeni ödeme sayısı en çok30'dur; iptal sayısı bu kapasiteyi tüketmez. Her özgün ödeme için yalnız bir inverse journal satırı olabilir. Eski15/30 test_payment_requests sayacı tüketilmez.

Native ödeme, explicit scope account ve özgün same-currency FX snapshot'ıyla mevcut core'da yürür. Ödeme sıfırdan büyük/en çok500 ve dört ondalıktır; güncel pozitif cari borç, TRY invoice kalan account-currency borcu ve kasa/banka bakiyesini aşamaz. Beklenen revision ve previewHash backend'de aynı SERIALIZABLE transaction/global applock altında doğrulanır. Native etkiler + audit + journal aynı transaction'dadır; journal AFTER INSERT owner effects assertion'ı unsafe doğrudan INSERT'i de geri alır. Ödeme iptali yeni kurdan hesaplanmaz: özgün document/account/TRY tutar ve kur snapshot'ı bire bir kopyalanır, özgün account'a inverse finans hareketi yazılır.

Service principal yalnız mevcut `melisa_sirket_sales_test_20260929_01` olur. Yeni journal'a SELECT/INSERT, üç yeni owner'a EXECUTE ve VIEW DEFINITION verilir. Scope/receipt/manifest'e SELECT/INSERT/UPDATE/DELETE, journal'a UPDATE/DELETE DENY vardır. Exact22 permission row ve hiçbir column grant hazır olma assertion'ıyla kontrol edilir. Core/native tablolara yeni genel grant, role change, schema control veya LIVE erişimi verilmez.

## Operatör kanıtı ve geri dönüş

Root bağımsız28 ticari tablo/old object/rol/grant baseline'ını korur. Installer ayrıca13 native tablonun tam eski satır hashlerini karşılaştırır; yalnız kendi exact oluşturduğu supplier/account/product/invoice/items/stock/suppliermovement/audit id'leri sonrası hesaptan çıkarılır. Bütün eski SQL module gövdeleri ve enabled trigger durumunun hash'i, eski scope byte'ları, tüm app role permissions ve eski database permissions değişmemelidir. Output kurulan exact kimlikleri ve before/after protected hashleri verir; hiçbir eski satırın ham içeriğini yazdırmaz.

Kurulumun beklenen native deltası: supplier+1, finance account+1, product+1, purchase invoice+1, invoice item+1, stock movement+1, supplier movement+1, audit+2. Mevcut13371/13372/33/34 yalnız sonraki yetkili normal ödeme/iptal denemelerinde bakiye+updated_at ve native hareket etkisi taşır; fixture kurulumu bunları değiştirmez. Güncel TRY stok5 zincirin bütün ödeme/iptal adımlarında aynı kalır.

Commit öncesi başarısızlıkta root dış transaction'ı ROLLBACK eder. Commit sonrası geri dönüş veri silme/reset değildir: root yalnız TEST uygulamasını önceki paket/route kapsamına döndürür ve bu yeni journal SELECT/INSERT ile üç owner EXECUTE/VIEW DEFINITION grant'ini dar olarak geri alır. Yeni fixture, audit, journal, kabul ve native kayıtlar korunur; yeni immutable trigger'lar kapatılmaz, eski guard/pin/rol değiştirilmez. Üç yeni owner'ın dar grant geri alma prosedürü/readiness doğal olarak API'yi fail closed yapar. Bu işlemleri alt ajan yürütmez.
