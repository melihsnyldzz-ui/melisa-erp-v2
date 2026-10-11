# Katalog — gerçek çağrı parametreleriyle izole sonuç ve hız kanıtı

11 Ekim 2026, ERP-COMPLETE01 / ERP-DEC-044. Önceki READY kaynak kapsamı adayı, artık yalnız READY çağrısıyla değil mevcut katalog procedure'ünün gerçek normal kullanıcı parametreleriyle ölçüldü. Bu izole native kanıttır; ortak DB02'ye kurulum, HTTP/UI hız sonucu veya insan kabulü değildir.

## Kapsam ve sonuç

Normal İlker TEST aktörü16 için mevcut uygulamanın sınıflandırma okuyucusu ve katalog adapteri kullanılarak beş çağrının 14 açık, SQL tipli parametresi kaydedildi: ilk50, sonraki50, tam stok kodu, başında sıfır bulunan barkod, ürün kartı/satış fiyatları. Parametreler elle hazırlanmış fixture değildir. Sınıflandırma doğrulamasının ayrı çağrısında16 parametre vardır; normal katalog çağrısıyla karıştırılmaz. Kaynak okumasının altı transaction'ı rollback ile kapandı; ticari POST/commit0.

Mevcut izole `MELISA_ERP_READINESS_PROOF_TEST_20261011_01` hedefi ve erişimi yalnız bu DB ile sınırlı teknik login kullanıldı. Yeni DB, restore veya yedek oluşturulmadı. Login sysadmin değildir ve DB02/TEST125/LIVE erişimi0'dır; clone içindeki geçici DDL için mevcut db_owner yetkisi vardır. Katalogda normal aktörün gerçek permission kontrolü aynen yürütüldü.

| Çağrı | Baseline üç örnek, ms | Aday üç örnek, ms | Önce medyan | Sonra medyan |
|---|---|---|---|---|
| İlk50 |4076 /2022 /2251|3013 /1664 /1660|2251|1664|
| Sonraki50 |2480 /1898 /1961|1778 /1773 /1740|1961|1773|
| Tam stok kodu |1825 /2054 /1924|1577 /1583 /1647|1924|1583|
| Başında sıfır bulunan barkod |1632 /1821 /1894|1519 /1694 /1626|1821|1626|
| Kart ve satış fiyatları |1715 /1392 /1479|1383 /1313 /1347|1479|1347|

Toplam30 native ölçümde kaynak yakalaması, izole baseline ve aday sonuçları eşit. Yalnız `readAt` ve birebir pinlenmiş okuyucunun clone kimliğine bağlı definition hash'i normalize edildi; diğer tüm alanlar ve `rowsJson` metni korunarak karşılaştırıldı. İlk/sonraki sayfa50, kod/barkod/kart sonucu1 satırdır. Kart satış fiyatı dizisi doludur. Liste/search gerçek kaynak binding kapsamı16.793; kart kapsamı1'dir. Bunlar ürün aktarımı veya bütün işletme günlük yazma kapsamı değildir.

Gerçek STATISTICS XML/TIME/IO her örnekte ayrı kaydedildi ve hash ile bağlandı. Baseline önce, aday sonra çalıştı; ilk örneklerdeki compile/cache etkisi dahil tüm süreler gösterilir. Üç örnek medyanı evrensel soğuk açılış garantisi değildir. **İlk50 yaklaşık%26 hızlandı, ancak hiçbir medyan1 saniyenin altına inmedi.** Liste sayfa boyutu50 aynı. HTTP, thumbnail indirme, görsel filtre veya tarayıcı render ölçülmedi. `image=all` için mevcut adapterin normal `media_bindings=[]` davranışı korundu; fotoğraf metadata'sının sonraki DTO katmanından eklenmesi bu native kanıtın kapsamı dışındadır.

## Negatifler ve geri alma

Her varyantta iki actual native negatif çalıştı; toplam4:

- Önce gerçek pozitif katalog çalıştırıldı, sonra okuyucu definition drift'i oluşturuldu: actual READY `BOUND_CATALOG_PROOF_READER_DRIFT` /51904 ile reddetti.
- Önce gerçek pozitif katalog çalıştırıldı, sonra aktör NULL bırakıldı: katalog `STOCK_PRODUCT_READ_FORBIDDEN` /51101 ile reddetti.

Hazırlık hatası negatif PASS sayılmadı. Ölçüm/negatif transaction'larının her birinden sonra ve final exit'te751 tablonun tüm veri/şema/FK, izin ve registry geçmişi başlangıçla birebir karşılaştırıldı:7 snapshot recovery eşit. Exit0; `complete=true`, `catalogMeasured=true`, `rollbackVerifiedOnExit=true`; failure/recoveryFailure yok. Kalıcı SQL yazması, ticari POST, commit ve protected write0.

SERIALIZABLE, aynı bağlantı, transaction-owned Shared lock, fresh identity, tam kaynak witness kapsamı, güncel hash/JSON/birim/döviz/karantina/rol kontrolleri korunur. Proof rebind yalnız bir DB_NAME literalidir; mevcut185 manifest satırı ve gerçek okuyucu stored hash'i overlay öncesinde doğrulanır. Eski immutable v4/v5 registry satırları değiştirilmedi.

## Kanıt pinleri ve çalışan sistem

Private `ERP-COMPLETION01-20261011/private/recovery-proof`:

- `bound-catalog-source-scope-native-2026-10-11T101927584Z.json`: SHA256 `0e8ddde50d58eac6940cddb8095ec3c3f700534104218d2e3a4bde6e209a1870`.
- `bound-catalog-source-params-2026-10-11T101217967Z.json`: SHA256 `53051a7bf4da1c33545e279a9c3f8512bf4407398a66c2429941f1bd26e1c5c4`; ham parametre/ürün sonuçları private kalır.
- `prove-bound-catalog-source-scope.mjs`: SHA256 `15466711c1a1fd8e351bc30d1c906ac779397d1aa2d1d87946874e42b0f79697`.
- `capture-bound-catalog-source-params.mjs`: SHA256 `4e0da8f36bbd5cdcb8a193f4b93a9722f30b947a8718a72411789857b80995af`.
- `bound-catalog-protected-after-20261011.json`: SHA256 `60de19b74a87ebbf50bcb91dc31acd2a05ec83fce213f75809a7669deca616ac`;16 listener/PID/adres0fark, dört API/native health doğru DB/source ile sağlıklı.

Kaynak READY ve kaynak/proof okuyucu pinleri önceki [READY kanıtı](catalog-readiness-source-scope.md) ve private receipt içinde tutulur. Bağımsız kaynak ve final native review GO:30 bağlı XML hash/runtime counters/TIME-IO, raw sonuç eşitliği, normalized hash ve medyanlar yeniden hesaplanarak doğrulandı. Receipt tekil751tablo map'leri yerine dört aggregate snapshot hash'i saklar; runner kaynağı bunların tüm sys.table verisi/şema/izin/history kapsamını ve tam karşılaştırmayı doğrular. Hazırlık-only receipt başarılı native sonuç yerine kullanılmaz. Ham ticari veriler, login ayarları ve plan XML'leri GitHub'a alınmadı.

Yeni paket oluşturulmadı ve aday ortak DB02'ye kurulmadı. Application source `181de5ac4102904104c056c9c270b9c6a7ef990d`, immutable `CANONICAL-COMPLETE-TEST-20261011-181de5a` /geçici5264; shared API/native `a51b117`, TEST125 `edb3c891` ve Hub/CRM/sabit boot aynı. Kaynak aday teslimi `e562f4b`, önceki belge HEAD `d7b40a9`; bu belge teslimi application source değildir. Son exact teslim CI sonucu STATUS/PR makbuzuna bağlanır; hesap/harcama nedeniyle başlamayan required job yeşil sayılmaz.

## Devam

Bağlı katalog sonuç/hız/rollback kanıtı tamamlandı; 1sn katalog/HOME hedefi ve genel günlük işletme kapsamı açıktır. v6/full11 yalnız o isteğe bağlı hız revizyonunun aktivasyon şartıdır; asıl dört teslim için yeni genel kapı değildir.

Sıradaki tek teknik iş: mevcut tam doğrulanmış profile'dan seçilen müşteri/döviz/ürün için ayrı bound satış context/preview bağlantısı. Mevcut runtime'ın seçili günlük scope'u1 ürün, sözleşme üst sınırı2 kalemdir; genel profilin varlığı genel günlük satışın çalıştığını kanıtlamaz. Satış için kasa hesabı veya alış quote'u gereksiz önkoşul olmayacak; native fiyat/stok/maliyet/kur/rol ve ayrı yazma/replay korumaları korunacak. Preview teslimi tek başına genel satış/finans zincirini tamamlamaz.

ERP-UA32 ve49/9/39/1 aynı; ana hedef tamam değil. Vega/LIVE/main/T1/CRM/gerçek mesaj/ücretliAI değişikliği yok.
