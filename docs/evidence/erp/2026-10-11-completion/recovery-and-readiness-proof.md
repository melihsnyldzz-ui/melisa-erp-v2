# Güncel DB02 kurtarma ve hazırlık sorgusu provası — 11 Ekim 2026

Bu kayıt ERP-COMPLETE01 teknik çalışmasıdır. İnsan kabulü, shared API aktivasyonu, fiziksel mağaza sayımı veya gerçek T1 değildir. Ham kaynak verileri, plan XML'i, SQL kullanıcı ayarları ve yedekler yalnız private alandadır.

## Gerçek geri yükleme

Kabul edilmiş DB02 tabanı ve TEST125 korunarak iki yeni, ayrı prova veritabanı oluşturuldu. Aktif hedefe `RESTORE`, `REPLACE`, reset veya otomatik telafi uygulanmadı.

| Prova | Kaynak | Doğrulanan sonuç |
| --- | --- | --- |
| Önceki yedeğin kurtarılması | 10 Ekim tarihli, 9.204.334.592 byte DB02 yedeği | Exact SHA256, HEADERONLY, CHECKSUM/VERIFYONLY, yeni hedefe gerçek RESTORE, READ_ONLY ve CHECKDB temiz; 748 kullanıcı tablosu |
| Güncel DB02 kopyası | 11 Ekim 10:13:13–10:14:18 yerel saatte alınan COPY_ONLY/CHECKSUM yedeği; 9.217.900.544 byte | Exact SHA256, HEADERONLY, VERIFYONLY, yeni hedefe gerçek RESTORE 205.835 ms, READ_ONLY ve CHECKDB temiz; 751 kullanıcı tablosu |

Güncel yedek SHA256: `77D1A1F36345559C3B6DD2DE9DCA70E0605C4EAE5C1CDB01C9AB980766990240`. Kaynak kopya kimliği `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, `actualT1=false`. Korunan dört veritabanının kimliği/dosya hedefleri ve çevrimiçi durumu karşılaştırıldı. Bu metadata sonucu bütün aktif iş satırlarının yeniden mutabakatı değildir.

Önceki kurtarma çalışmasının rapor sonundaki `status` kolon varsayımı hatası, yalnız gerçek şemaya uygun salt okunur ek kontrolle tamamlandı; ilk makbuz korunur. Prova login kurulumu sonrası bağlantı kurucusu hatası da salt okunur izolasyon kontrolüyle tamamlandı. Tekrar restore veya login/parola yenileme yapılmadı.

## İzole sorgu provası

**11 Ekim 11:05 TR güncellemesi:** Aynı kayıtlı native süreç tamamlandı; sonuç `OBSERVATION_ONLY_COMPLETE`. Baseline üç gerçek ready yürütmesi 1.907/1.560/1.573 ms; aday 1.484/1.338/1.203 ms. Ortanca 1.573 → 1.338 ms yalnız bu native kontrol içindir; katalog/HTTP/Android toplam açılış süresi değildir. Mantıksal okumalar baseline 128.222/126.556/126.535, aday 118.687/118.734/118.693. Her varyantta registry hash drift ve disabled query-plan trigger reddi gözlemlendi. Tüm 751 tablonun satır/şema/izin snapshot eşitliği ve tam rollback son kontrolde doğrulandı; protected writes ve commits sıfır. Dokuz ek negatif bu çalıştırmanın desteklenmeyen kapsamıdır; tam 11 kabulü ve shared activation false kalır. Private makbuz `native-query-plan-observation-only.json`; sonraki kaynak factory'lerinin hazırlanması bu eski çalıştırmaya native PASS eklemez.

Yalnız yeni güncel prova kopyası geçici DDL için READ_WRITE oldu. Ayrı proof login yalnız bu kopyada db_owner; sysadmin, shared DB02, TEST125 ve LIVE erişimi sıfır. Mevcut uygulama kullanıcıları veya rolleri değişmedi. Bu login, normal personel okuyucusunun yetki kabulü yerine geçmez.

Native rollback-only DDL gözlemi, SQL Server'ın `ALTER PROCEDURE` yürütmesinden sonra OBJECT_DEFINITION içinde `CREATE PROCEDURE` başlığı sakladığını doğruladı; kalan metin byte karşılığı eşitti. Exact yürütme SQL'i ile beklenen saklanan metin ayrı sabitlenir. Beklenen saklanan metnin ham UTF-16LE SHA256 değeri native geri okumayla registry kaydından önce eşleşmek zorundadır; global hash normalizasyonu veya alternatif hash kabulü yoktur. Baseline ve aday aynı kimlik/append-only guard overlay'ini taşır. Aday yalnız mevcut dört sorgu değişikliğini içerir; historical guard ve kaynak katkısı kaldırılmaz.

İlk gerçek keşif, adapter'in yalnız dbo/erp_migration şemalarını kabul etmesi nedeniyle transaction başlamadan durdu. Düzeltme tüm sys.tables şema/tablo çiftlerini ayrı ve güvenli tırnaklar; zorunlu 62 tablo alt sınırı korunur. Güncel kopya 10 şema ve 751 tablo içerir. Native probe/EXEC pin kapsamı genişletilmedi. İlk başarısız makbuz ayrı tutulur.

Sonraki baseline denemesinde gerçek registry/hash kurulumu geçti, historical `BUSINESS_READY_PERFORMANCE_REVISION_DRIFT` reddi oluştu ve transaction geri alındı. Neden proof baseline dönüştürücüsünün aynı `@@PROCID` ifadesini içeren replacement'ı yeniden taramasıydı. Altı özgün anchor artık tek geçişte değiştirilir; iki tarihsel gate ayrı bir kez örtülür ve kesin konumlardan ters dönüş özgün predicate metnine byte karşılığı eşit olmalıdır. Shared adayın kaynak/revision hash'i değişmedi. Üç helper suite'inde41/41 offline regresyon ve bağımsız35/35 alt kontrol geçti; yeni gerçek deneme ayrı makbuzla sürer.

Ölçüm ve iki yeni registry negatifi ayrı transaction/SPID'de çalışır; her işlem tam rollback, transaction sonu ve tüm satır/şema/izin snapshot eşitliği gerektirir. Dokuz ek native fixture/actor/effects bağı henüz tamamlanmadığından bu çalışma **OBSERVATION_ONLY** kapsamıdır. Tam 11 negatif kabulü veya shared aktivasyona hazır olma sonucu üretmez.

## Güncel v5 üzerinde kaynak okuması ve iki ek bağ

Mevcut DB02 v6 config/registry/trigger içermez. Güncel consumer'ın optional v6 parametresi açıkça undefined geçirilerek normal İlker16 rolüyle ready/context ve HOME gerçek SQL okuması geçti; ticari POST/kalıcı SQL DML/servis değişikliği0. Çalışan API a51 kaynağında kalır. Private makbuz `current-source-v6-absent-home-readonly-proof-20261011T074326.json`, SHA256 `6673c6e1574adaea98de53553f5dde545c8fd53cc580f78284764e4a37340135`.

İki yeni source-witness binding kaynakta hazırlanmıştır: exact kaynak hesabını kaldırma ve aynı exact payload'da UNKNOWN/NULL bakiye. Factory bağlantı açmaz veya satır keşfetmez; reviewed data-only fixture, sealed profil ve tüm kayıt hash'i gerektirir. Doğrulama/mutasyon sonrası kontrol hatası negatif PASS değildir. UNKNOWN ret sonucu yalnız composite_source_witness olarak etiketlenir; balance-only koşulun tek başına yürüdüğü iddia edilmez. Baseline/candidate installed CREATE metni ve raw hash'i bağımsız doğrulanır. Üç helper suite'inde46/46 offline test ve bağımsız kaynak incelemesi geçti. Bu iki binding için native sonuç henüz yok; yedi diğer bağ açık, toplam11 gereklilik korunur.

v6 aktivasyonu bu bütün kabulü bekler. Mevcut v4/v5 üzerinde HOME/terminal kaynak teslimi buna bağlı değildir; protected shared servisleri değiştirmeyen geçici USB/loopback paket yolu ayrı ilerler.

## Kaynak doğrulama ve kalan

13 hedefli test dosyasında root tarafından **120/120 offline PASS**, 0 fail/skip. Bunlar native SQL kanıtına veya insan PASS'e eklenmez. v6 consumer güncel SQL pinleri, immutable registry/trigger ve v1–v5 parent zincirini her işlem/reload'da taze doğrular. Yeni modül immutable terminal paketi kapalı import/hash listesine eklendi.

Gerçek sorgu ölçümü ve tam rollback makbuzu artık tamamdır; tam v6 aktivasyonu için kalan native actor/effects/kaynak negatifleri ayrı açıktır. Mevcut v5 normal HOME/terminal teslimi bu optimizasyonun aktivasyonuna bağlanmaz. Çalışan a51b117 API/native, TEST125, Hub5234 ve sabit başlangıç checkpoint'i değiştirilmedi. ERP-UA32 ve finish **49/9/39/1** korunur. Yeni Vega okuması/aktarım, LIVE/T1, main merge veya dış mesaj yoktur.
