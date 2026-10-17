# Katalog — güncel bütünlük kontrolünün kaynak kapsamı provası

11 Ekim 2026, ERP-COMPLETE01 / ERP-DEC-044. Bu teslim, mevcut katalogdaki SQL beklemesine yönelik kaynak adayı ve gerçek izole native provadır. Ortak DB02'ye kurulmadı; katalog/UI hız kazanımı veya insan kabulü değildir.

## Ölçülen sorun ve değişiklik

Önceki normal rol/HTTP faz ölçümünde katalog procedure süresi 1414–2345 ms idi; ilk50 HTTP medyanı 2021 ms. Katalogda tek READY çağrısı vardır. Güncel READY'nin bağımsız TIME/IO ölçümünde üç örnek 1162/1282/1263 ms ve yaklaşık124636 logical read görüldü. Cached plan tahminleri süre kanıtı sayılmadı.

Mevcut dört değişiklikli hazırlık korunur: aynı çağrının seal scalar değeri yeniden kullanılır ve iki varlık kontrolü aynı predicate ile RECOMPILE edilir. Ayrı, açıkça seçilen aday üç adım ekler:

- Opening run/entity evreninin JSON geçerliliği her çağrıda yeniden kontrol edilir; NULL eski UNKNOWN davranışını korur. Kapsam dışı bozuk satır sessizce atlanmaz. Yeni açık hata kodu bilinçli olarak daha katıdır.
- Hesaplar, hash/JSON materializasyonundan önce **tam profile kapsamındaki** witness hash'leriyle EXISTS üzerinden seçilir. Materialized char(64)/Turkish_CI_AS eşitliği korunur. Duplicate satırlar silinmez veya çoğaltılmaz.
- Cari kaynak bağlantıları yalnız tam kapsamın rol/ID adaylarıyla seçilir. Karşı taraf NULL, şirket, LL, para birimi ve kaynak anahtar koşulları son kontrol içinde aynen kalır.

Tam profile375 müşteri +406 tedarikçi hesabı içerir; kaynak910 hesap ve932 bağlantıdır. Günlük iki ürün/37 cari kapsamına indirilmedi. Güncel UTF-8 payload hash'i, mevcut stok/fiyat tanıkları, karantina, aktör, modül/registry hash'leri, SERIALIZABLE ve transaction-owned Shared lock korunur. TTL, veri/rol cache'i, NOLOCK veya guard kaldırma yoktur.

## Gerçek native önce / sonra

Mevcut, erişimi yalnız `MELISA_ERP_READINESS_PROOF_TEST_20261011_01` ile sınırlı login kullanıldı; sysadmin/DB02/TEST125/LIVE erişimi0. Yeni DB/restore/yedek oluşturulmadı. Baseline ve candidate aynı proof identity/hash overlay'leriyle, ayrı rollback-only transaction'larda çalıştı.

| Varyant | READY örnekleri, ms | Medyan, ms | Logical read örnekleri |
|---|---|---|---|
| Baseline | 1883 /1206 /1211 |1211|128284 /124676 /124676|
| Candidate |1286 /969 /1021|1021|119228 /119220 /119229|

Medyan190 ms /%15,7 azaldı; medyan logical read124676→119228. Her örnekte gerçek runtime XML/TIME/IO kaydedildi. Bunlar **READY süreleridir**; katalog kartı, HTTP veya ekran açılış süreleri değildir.

İki varyantın her birinde altı gerçek native negatif çalıştı: eksik kaynak hesabı, UNKNOWN bakiye, stored hash değişmeden payload değişimi, kapsam dışı malformed JSON, registry definition hash drift ve devre dışı immutable trigger. Toplam12 observation tamamlandı. İlk üç kaynak senaryosu composite witness reddidir; hash veya balance branch'inin tek başına izole edildiği iddia edilmez. Malformed JSON'da baseline native13609, candidate `READINESS_SOURCE_ACCOUNT_JSON_INVALID`/51904 verdi; farklı kodlar eşit hata gibi sunulmadı. Diğer beş türde kod ve actual_ready katmanı iki varyantta aynıydı.

Malformed JSON sırasında SQL'in otomatik rollback olayı kaydedildi; driver EABORT yalnız gözlenen rollback olayı, fresh original module hash ve registry/trigger yokluğu doğrulanınca kabul edildi. Diğer senaryolarda explicit full rollback yapıldı. Sonunda751 tablonun tüm satırları, şema/FK ve izin/history izleri başlangıçla birebir eşit; ayrıca exit doğrulaması geçti. Commit, kalıcı SQL, ticariPOST, rol ve protected write0. Başarısız iki hazırlık koşumu başarılı kanıta eklenmedi; private makbuzlar korunur.

## Kaynak ve kanıt pinleri

Kaynak READY raw stored SHA256 `7EF11EF1D5410689F6838E6D1233EA565D08E2461B3B0F7F483D8E1814B75166`. Yedi değişiklikli raw aday `41C5308D105D2870B67E1B020C34C2C14559B30F6E27C9A44F6582D8591689C6`; append-only v6 guard ile hazırlanmış ortak hedef adayı `5861011F14F594E18BB6C1CDF6940F45712FE7240C0FE688AF6909FD8A318866`. Bu hash'ler proof clone identity rebind hash'lerinden ayrıdır.

Private `ERP-COMPLETION01-20261011/private/recovery-proof` kanıtları:

- `readiness-source-scope-native-2026-10-11T094730501Z.json`, SHA256 **b7980e98d744d3b3abdf8804744722f39dfe536263adfb78c54f9da6dc4cc356**; complete/full751 equality/rollbackVerifiedOnExit=true, recovery error yok, process exit0.
- `readiness-source-scope-preparation-2026-10-11T094730501Z.json`, SHA256 **6d65d42ad094d36ddc307b1fa2a52156590ec67b1dd87fb042d428b158b8c039**. Eski dört değişiklikli private artifact byte eşitliğinde doğrulandı ve ezilmedi.
- `prove-readiness-source-scope.mjs`, SHA256 **bd7e5da8e13dcfcfd824bef960f43804314df3883ce4039c3dd60d38d936d4ef**; private ölçüm/rollback driver'ıdır, bir deployment aracı değildir.
- `source-scope-root-tests-20261011.txt`, SHA256 **5d655b811b4f58c811be85e63020506dd3270a51e94841e3ae6e701ec539d122**; dondurulmuş dört hedefli suite53/53 PASS. Offline model testleri native veya insan kabulü sayılmaz. Bağımsız kaynak/runner review GO.
- `source-scope-final-protected-ports-20261011.json`:16 protected kayıt/PID/adres0fark. TEST125/DB02 API-native/Hub/CRM/sabit boot aynı.

Ham rowlar, tutarlar, login özel ayarları, XML planları ve finans bilgileri GitHub'a alınmadı.

## Teslim sınırı ve sıradaki iş

`executeAllowed=false`, `installAllowed=false`, `fullAcceptance=false`, `readyForSharedActivation=false`, `catalogMeasured=false`. Altı negatif türü tüm11 v6 aktivasyon gereksinimini karşılamaz. Bu revision ortak DB02'ye kurulmadı; mevcut config/185-module manifest/historical registry'ler değiştirilmedi. Yeni çalışan paket üretilmedi; geçici application source181de5ac / immutable181de5a /5264 ve shared API-native sourcea51b117 korunur.

Hazırlık/kaynak teslimi `e562f4b206a9459dbafcf0396b099518815837ff`, `codex/erp-finish-20261004`, PR23'e push edildi. Exact commit CI38130252094/38130249351 required üç job0steps; annotation114442902588 hesap ödemesi/harcama limiti nedeniyle başlamadığını doğruladı. CI PASS değil; preview başarısı bu required kontrollerin yerine geçmez. Belge teslimi bu source commit'ini izler.

**Sıradaki tek teknik iş:** bağlı katalog okuyucusuyla aynı izole kopyada ilk50/sonraki50/tamkod/başta sıfırlı barkod/kart-fiyat sonuç eşitliği ve hız provası; eksik aktivasyon negatiflerini ilgili native katmanda kapatmadan ortak etkinleştirme yok. Bir saniyelik HOME, geniş günlük işletme kapsamı ve diğer completion gereksinimleri açık. ERP-UA32/insan kabulü bekler;49/9/39/1 aynı. Vega/LIVE/T1/main/CRM/gerçek mesaj/ücretliAI yok.
