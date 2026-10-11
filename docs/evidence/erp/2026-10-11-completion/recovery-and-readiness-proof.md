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

Yalnız yeni güncel prova kopyası geçici DDL için READ_WRITE oldu. Ayrı proof login yalnız bu kopyada db_owner; sysadmin, shared DB02, TEST125 ve LIVE erişimi sıfır. Mevcut uygulama kullanıcıları veya rolleri değişmedi. Bu login, normal personel okuyucusunun yetki kabulü yerine geçmez.

Native rollback-only DDL gözlemi, SQL Server'ın `ALTER PROCEDURE` yürütmesinden sonra OBJECT_DEFINITION içinde `CREATE PROCEDURE` başlığı sakladığını doğruladı; kalan metin byte karşılığı eşitti. Exact yürütme SQL'i ile beklenen saklanan metin ayrı sabitlenir. Beklenen saklanan metnin ham UTF-16LE SHA256 değeri native geri okumayla registry kaydından önce eşleşmek zorundadır; global hash normalizasyonu veya alternatif hash kabulü yoktur. Baseline ve aday aynı kimlik/append-only guard overlay'ini taşır. Aday yalnız mevcut dört sorgu değişikliğini içerir; historical guard ve kaynak katkısı kaldırılmaz.

İlk gerçek keşif, adapter'in yalnız dbo/erp_migration şemalarını kabul etmesi nedeniyle transaction başlamadan durdu. Düzeltme tüm sys.tables şema/tablo çiftlerini ayrı ve güvenli tırnaklar; zorunlu 62 tablo alt sınırı korunur. Güncel kopya 10 şema ve 751 tablo içerir. Native probe/EXEC pin kapsamı genişletilmedi. İlk başarısız makbuz ayrı tutulur.

Ölçüm ve iki yeni registry negatifi ayrı transaction/SPID'de çalışır; her işlem tam rollback, transaction sonu ve tüm satır/şema/izin snapshot eşitliği gerektirir. Dokuz ek native fixture/actor/effects bağı henüz tamamlanmadığından bu çalışma **OBSERVATION_ONLY** kapsamıdır. Tam 11 negatif kabulü veya shared aktivasyona hazır olma sonucu üretmez.

## Kaynak doğrulama ve kalan

13 hedefli test dosyasında root tarafından **120/120 offline PASS**, 0 fail/skip. Bunlar native SQL kanıtına veya insan PASS'e eklenmez. v6 consumer güncel SQL pinleri, immutable registry/trigger ve v1–v5 parent zincirini her işlem/reload'da taze doğrular. Yeni modül immutable terminal paketi kapalı import/hash listesine eklendi.

Sıradaki teknik iş gerçek sorgu ölçümünün ve rollback makbuzunun tamamlanması, ardından kalan native actor/effects/kaynak negatiflerinin mevcut guardlarla doğrulanmasıdır. Çalışan a51b117 API/native, TEST125, Hub5234 ve sabit başlangıç checkpoint'i değiştirilmedi. ERP-UA32 ve finish **49/9/39/1** korunur. Yeni Vega okuması/aktarım, LIVE/T1, main merge veya dış mesaj yoktur.
