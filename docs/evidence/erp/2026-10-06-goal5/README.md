# Goal5 — personel terminali teknik kanıtı

6 Ekim 2026. Fiziksel Zebra bağlı değildir; insan ve cihaz kabulü **bekliyor**. Normal ERP aktör15 ve mevcut CRM personel3/agent3 ile gerçek ortak TEST servisleri kullanıldı. Kaynak, paket ve belge HEAD'i ayrı kimliklerdir. Kanıt: [runtime](runtime.json), [ERP hız](performance-final.json), [CRM hız](crm-performance.json), [negatifler](api-negatives.json), [tarayıcı](browser-completion.json), [ticari etki](sql-comparison.json).

## Tek çalışma yüzü

[Personel terminali](http://127.0.0.1:5194/terminal.html): **Mal Kabul / Satış / Müşterilerim / Ürünler / Sayım / İade**. Mevcut normal ornek-akis, Android/Expo ve Goal3/4 hizmetleri korunur; yeni ticari DB yoktur. ERP5194/4144/4146 ve CRM62400/62401/native62404 aynı TEST zinciridir. CRM terminal prova oturumu yalnız loopback, süreç içi kısa süreli mevcut aktöre bağlıdır; kalıcı kullanıcı/parola/rol değişmedi. Normal personnelCanSend=false korunur. Bu kısa prova mekanizmasını fiziksel LAN personel kabulü saymayın.

| Akış | Gerçek sonuç | Sınır |
| --- | --- | --- |
| Mal Kabul | TEST-V70-GOODS-P, hızlı barkod/Enter/çift Enter: tek satır/1adet/not; ortak sayım7 kayıt ve refresh. | Fiziksel kabul/stok onayı yok. |
| Satış | TEST müşteri30598, 0000061010001 leading-zero/çift Enter: tek satır/1adet/100TRY fiyat kontrolü. | Sentetik TEST fiyatıdır; satış finalize edilmedi. |
| CRM | Atanmış liste, başka personele753 için403; Ana→Ürünler→Ana→Müşterilerim aynı55/composer ve taze izin kontrolü. | Yalnız7733; kontrollü atama prova sonrası eski agent2'ye geri alındı ve ayrı GET ile doğrulandı. |
| Çeviri | Açık/Kapalı/orijinal/ikisi; gerçek İngilizce mesajdan Türkçe çeviri, orijinal korunur; OFF sessiz çeviri yapmaz. | Telefon/insan dil kabulü değildir; AI otomatik göndermez. |
| Ürün | 0161MOLLY34765 fotoğraf/14ADET/9,66USD; 8023CONCEPT36724 fotoğraf/0ADET/15,78USD; 3344CONCEPT30226 fotoğraf yok/4ADET/8,55USD. | 30Eylül açılışı; güncel Vega taahhüdü yok. 0161 gerçek marka/türNULL, tahmin yok. |
| Native taslak | 0161×1 +8023×1: **9 /25,4400USD**, ayrı ERP GET/aynı UUID refresh/replay, farklı gövde409; son CRM paketinden aynı belge geri okundu. | Müşteri595 gerekçeli TEST seçimi; exact7733 telefon bağı yok. Kur1 TEST değeri; stok/cari/tahsilat/rezervasyon etkisi yok. |
| Sayım | Ortak43: sistem3/fiziksel1/fark−2/gerekçe/yetkili kontrolünde; uygulama/reddetme kapalı, API403. | Stok onayı yok. |
| İade | Alış25075/satır93173/ürün301986:1adet/gerekçe → ortak44/pending, kalan izinli miktar5→4. | Personel onay/ters kayıt/finans yapamaz; native stok/finans etkisi yok, kaynak alış korunur. |

Personel sayım/iade DTO'sunda kaynak kimliği/adet/gerekçe korunurken maliyet/fiyat/tutar/borç/kasa/iç finans planı taşınmaz. Ofis DTO'su ve native plan/journal değişmez. Fixture301986'da hold yok; karantinadaki4620LEYLEK40451 ayrı ve değişmemiştir.

## Negatifler ve kesintiler

Finans/ödeme/onay403, CRM oturumsuz401, başka atama403, bilinmeyen barkod0, karantina seçilemez, fotoğraf yok temiz durum. 0205NAYİNOM TRY var/USD-EUR tuple yok; eksik fiyat sıfıra çevrilmez. Salt okunur SQL açılış kataloğunda sale/price_exact NULL satırı **0**; literalNULL gerçek ürün örneği uydurulmadı. NULL DTO/model ve eksik döviz fiyatı sınırı korunur; gerçek katalogda literalNULL bulunan ürünü açma kanıtı değildir.

Geçici tarayıcı ağ simülasyonunda offline yazma **“Bağlantı yok — bu işlem çevrimiçi tamamlanmalıdır.”** ile engellendi; AI arızasında taslak/geçmiş, ERP arızasında CRM geçmişi, CRM arızasında ERP fotoğraf/stok/fiyat korunur. Simülasyon kuralları kaldırıldı; servisler kapatılmadı. Offline ticari yazma/sync kuyruğu yok.

Son CRM4ead paketinde gerçek personel yüzünden yalnız7733 için **8023CONCEPT /15,78USD +960×1220 gerçek fotoğraf** elle gönderildi: HTTP201/CONFIRMED, ayrı GET200 **Chatwoot12281/image**, providerAccepted/chatwootRecorded=true; delivered/read=false. Son fotoğraf görüntüleyicide gerçekten decode oldu. Fiyat gönderimden hemen önce ERP GET ile doğrulandı. Gönderim öncesi ERP kesintisi ayrıca **0 messages POST** ile engellendi, taslak/fotoğraf korundu. Önceki503 denemesi REJECTED_BEFORE_TRANSPORT; tam aynı aktör/konuşma/UUID/gövde/fotoğraf salt okunur status200 ile güvenli açıldı; eksik fotoğraf409 ile kilitli kaldı. Otomatik ikinci gönderim yok; belirsiz gerçek transport kilitli kalır. [Tarayıcı kaydı](browser-completion.json), [paylaşım](share-final-390.png), [büyük fotoğraf](share-photo-open-390.png), [güvenli kurtarma](share-recovered-final-390.png), [ERP kesinti engeli](erp-down-presend-390.png).

## Ölçümler ve etki sınırı

ERP71→74 üç HTTP örneği medyan ms: first50 **888→784**, next50 **593→664**, kod **611→461**, barkod **353→343**, kart **200→172**, HOME **18→21**, satış context **158→37**, sayım **78→59**, mal kabul context **249→259**, iade context **461→388**. HTTP süresi fiziksel scanner/ekran boyama/cihaz garantisi değildir.

CRM9c62702 fazı medyan ms: atanmış23 liste **25.709→650**, metadata poll500, sohbet184, ERP50seçici765, kart332, native9GET276. Bütün774 sohbet yerine gerçek agent/inbox filtresi; yanıt öncesi ikinci bağımsız taze atama kontrolü; cache veya başka in-flight sonuç yok. Liste geçmiş yüklemez; seçili sohbet ayrıca okunur. Gerçek çeviri1957ms ve native oluşturma5914ms/ayrıGET667ms ebe8CRM/ERP73 fazındadır; son pakette yeni oluşturma diye sunulmaz. Native62404 paketi değişmedi. Son **CRM4ead** doğrulama medyanları: atanmış liste **684ms** (605/684/1180), metadata poll463, sohbet208, ERP50seçici759, kart409, native9GET256. 9c62702 yukarıdaki ara fazdır; son paket sayıları JSON'da ayrıdır.

**10 iş tablosunun tam satır SHA256/kayıt sayısı ve43 guard tanımı aynı.** Snapshot atomik değildir; bütün DB veya ayrıca hashlenmemiş finance_account_movements için tam digest iddiası yok. Sayım/iade/native taslak metadata beklenen TEST değişiklikleridir. LIVE/Vega/main merge/ticari satış/ödeme yok.

## Ekran ve fiziksel kabul

Ana ekran gerçek CSS360/390/1024/1440 taşmasız, işlem düğmeleri≥46px. CRM dokunma alanları/ürün/modal ölçümleri tarayıcı JSON'unda; viewport finalde sıfırlanır.

- [360](home-final-360.png), [390](home-final-390.png), [1024](home-final-1024.png), [1440](home-final-1440.png)
- [Mal kabul](receiving-saved.png), [barkod/sepet](sales-barcode-cart.png)
- [Gerçek fotoğraflı kart](product-0161-final-390.png), [karantina](hold-390.png), [fotoğraf yok](no-photo-390.png)
- [Native geri okuma](native-final-readback-390.png), [sayım](count-pending-390.png), [iade](return-pending-390.png)
- [Offline](offline-390.png), [AI arızası](ai-down-390.png), [ERP arızasında CRM](erp-down-history-390.png), [CRM arızasında ERP](crm-down-erp-catalog-390.png)

Kaynak testleri/CI insan PASS değildir. ERP-UA18/CRM-UA05 ve önceki kabuller bekler. Fiziksel13 adım [terminal planında](../../../erp-v2/canonical-20261006/goal5-personnel-terminal.md): Wi-Fi/scanner/Enter/kamera/uyku/vardiya/personel/performans. C12🟡/C11🟡/M01🟡. Goal5 sonunda dur; Goal6/7 başlatılmaz.


## Oturum sonu

Gerçek parent Çıkış normal personel girişine döndü; gizli CRM iframe eski konuşmayı göstermedi. Mevcut diğer ERP aktörü16 İlker kendi eski iptal edilmiş NIGHT fişini gördü; aktör15 yeni sepeti taşınmadı. Müşterilerim tekrar CRM girişini istedi, eski55/geçmiş/composer görünmedi. Yeni kullanıcı/rol/izin eklenmedi. [Çıkış kanıtı](logout-context.json).
