# ERP-COMPLETE01 — kaynak bağlı satış önizlemesi

11 Ekim 2026. ERP-DEC-044/045 kapsamında bir ara teknik teslimdir. Genel satış yazıcısı, yeni çalışan paket, insan kabulü veya LIVE hazırlığının bütünü tamamlanmış değildir.

## Değişen davranış

Seçilen müşteri ve döviz hesabı ile seçilen ürünler, kabul edilmiş tam DB02 kaynak profilinden okunur. Satış önizlemesi için tedarikçi, alış fiyatı veya kasa hesabı aranmaz. Ürün/birim, kaynak fiyat kademesi, güncel stok, maliyet, kur, müşteri hesap kimliği ve mevcut roller her çağrının aynı SERIALIZABLE/Shared işleminde yeniden doğrulanır. Kaynak SQL metni önbelleğe alınabilir; ticari doğrulama sonucu önbelleğe alınmaz.

Yeni normal API yolları `POST /work-sales/selected-context` ve `POST /work-sales/selected-preview` yalnız okuma yapar; `sales.view` ve `sales.create` birlikte gerekir. Başarı ve hata sonunda transaction rollback yapılır. Mevcut sekiz satış yolu, eski TRY yazıcısı, replay davranışı ve yetkileri korunur. Okuyucu/store/yollar ortak çalışan API'ye henüz kurulmadı; route testi gerçek Express ve permission middleware ile sentetik auth/store kullanır.

Önizleme kamu DTO'sundan özel maliyet kaldırılır. Fiyat8 → birim fiyat4 → satır4 ve tarihli kur8 hesaplaması korunur. `20000.0000`, kaynakta doğrulanan belge dövizindeki **önizleme sınırıdır**; mevcut TRY/500 yazıcısına yetki veya limit değişikliği değildir. Bu ara seçim halen en çok iki ürün ve satır başına beş miktarla sınırlıdır; genel günlük işletme kapsamı olarak sunulmaz.

## Gerçek native sonuç

Exact yayımlanacak CREATE metni önce mevcut izole SQL kopyasında derlendi, kaydedilmiş tanımı karşılaştırıldı ve rollback yapıldı. Sonra aynı okuyucu, denetlenen prova kimliği bağlarıyla gerçekten yürütüldü. Ortak DB02 veya TEST125 üzerinde kurulum/yazma yoktur.

| Kontrol | Gerçek sonuç |
|---|---|
| Mevcut yetkili satış aktörü15, iki kaynak ürün, TRY | Native okuma doğrulandı; 2203 ms |
| Aynı satış aktörü15, iki kaynak ürün, USD | Native okuma doğrulandı; 1344 ms |
| İlker16, `sales.create` yok | `SELECTED_SALE_FORBIDDEN` |
| Yetkisiz aktör14 | `SELECTED_SALE_ACTOR` |
| Dışlanan LL müşteri hesabı | `SELECTED_SALE_SELECTION` |
| Aynı ürün kimliği iki kez | `SELECTED_SALE_ITEMS` |
| Mevcut negatif kaynak stok örneği | `SELECTED_SALE_NATIVE_PRODUCT_DRIFT` |

Her negatiften önce aynı transaction'da geçerli pozitif okuma doğrulandı. Olumsuz durumlar gerçek native SQL 51904 reddidir. TRY/USD süreleri iki ayrı reader gözlemidir; HTTP, kart, UI veya medyan performans ölçümü değildir. Bir saniye performans hedefi karşılandı denmez.

Yedi rollback kaydı vardır. Altı ara rollback'te kimlik, eski READY tanımı, yeni okuyucunun yokluğu ve tam şema/SQL izin/registry **metadata** eşitliği doğrulandı. Son rollback'te başlangıç ve çıkışın tam **751 tablo verisi/şeması/rolleri/registry geçmişi** bağımsız karşılaştırıldı ve aynı bulundu. Ara kontrollere tam veri eşitliği sonucu atfedilmez. Ticari DML, commit ve ortak veritabanı yazması sıfırdır.

Prova için yalnız denetlenen DB_NAME/login literal bağları, READY'nin izole baseline pin'i ve önceki denetlenmiş READY prova overlay'i kullanıldı. Koşullar/roller/fiyatlar/stoklar değiştirilmedi. Normal application store yürütüldü veya HTTP/native uygulama etkinleşti iddiası yoktur.

İlk iki başarısız prova da özel kanıt alanında tutulur: ilk pozitif fixture gerçekte negatif stoklu olduğu için reddedildi; ikinci fixture İlker'in satış oluşturabildiğini yanlış varsaydığı için reddedildi. Son çalışmada pozitif ürünler mevcut yeterli stoktan seçildi; İlker yetki reddi ayrı negatif olarak sınandı. Hiçbir stok/yetki düzeltmesi yapılmadı.

## Test, pin ve çalışan sürüm

23/23 hedefli source/model/store/Express-route/SQL builder/hazırlama testi yerel offline guard ile geçti. SQL builder testi canonical CI listesine eklendi; API testleri mevcut recursive offline listede yer alır. Native derleme ayrıca gerçek SQL'de yapıldı. Sentetik testler gerçek native kanıtın veya insan kabulünün yerine sayılmaz.

| Özel makbuz / tanım | SHA256 |
|---|---|
| `selected-sale-current-preparation-2026-10-11T110721342Z.json` | `ce0fe39d2cc9c78e46f783f574deda7b3c2b10d728a72bffaf825f7319c48e8e` |
| Native CREATE compilation makbuzu | `a138d90df559136c599fde390b97ac95ac2c4c99167f9f17a591b2fa5070d020` |
| SOURCE okuyucu tanımı | `DF687F2E14946FD1BC7685767CD0963B81B836CB2875ED56CE28530E8849657C` |
| Denetlenen izole okuyucu tanımı | `39775B6C8647B62059A75401D840E10D45A05103B0F3311470C38818E0B80498` |
| `selected-sale-native-context-2026-10-11T112104142Z.json` | `1230a7eaa44dd20c44ca72e00a3cc466ad57ade605120d029f0c1009a90027cc` |
| `selected-sale-protected-after-20261011.json` | `3E4FB689BEB48F358F6833D570D121545341CD533327D7DC5A38E8D9E1CD0DCA` |

Makbuzlar repo dışındaki `ERP-COMPLETION01-20261011/private/recovery-proof` alanındadır; ham ticari satırlar/hesaplar GitHub'a eklenmedi. 16 korunan listener kaydı ve dört health DB/source/package kimliği değişmedi; geçici5264/PID35248 ayrıca aynı kaldı.

TEST125 uygulama kaynağı `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`; ortak DB02 API/native kaynağı `a51b1170ade29494b3b446a44a8a62974eef687b`; geçici uygulama kaynağı `181de5ac4102904104c056c9c270b9c6a7ef990d`, immutable paket `CANONICAL-COMPLETE-TEST-20261011-181de5a`. Bu source teslimi yeni paket veya etkinleşmiş okuyucu değildir. GitHub head/CI push sonrası STATUS/PR makbuzunda ayrıca verilir; önceki billing engeli yeşil sayılmaz.

## Sıradaki uygulama

Mevcut SALE engine'ine server-owned selected intent ve journal/replay bağlantısı eklenecek. Finalize/cancel kapsamı doğrulanmış creation journal'ı ve fiş satırlarından türetilmeli; caller DTO/preview yazma yetkisi olamaz. Seçili döviz hesabı bir kez etkilenmeli, ana kart yalnız kendi döviziyle eşleşirse değişmeli; kur/profit hassasiyeti, eski TRY500 yolu ve immutable v4/v5 kayıtları korunmalı. Native successor pin doğrulaması ve izole gerçek işlem/ters kayıt/replay/normal ekran kanıtı olmadan genel satış tamam sayılmaz.

ERP-UA32 bekliyor; finish **49 / 9 tamam / 39 kısmi / 1 açık** değişmedi. Dört görevli terminal, dört video ve kurtarma kanıtları korunur; bütün hedef hâlâ aktiftir.
