# Satış ve müşteri kartı — 4 Kasım kaynak teslimi

Mevcut ERP49 içindeki B04/C04 satış ve B03/C06 müşteri kartı kapsamıdır. Özgün kabul ID'leri ve kapanış sayıları değişmez. ERP-DEC-087 ile aynı konuşmada aktif native hedef kaydedildi; yeni tracker veya finish ağacı yok.

## Kanıtlanan kaynak davranışı

- Satış taslağı, native hesap alanları kesinleştirmeye kadar NULL iken doğrulanmış oluşturma kaydı ve seçili hesaptan okunur. Kesinleşmiş fişte native hesap/cari damgaları zorunludur. Owner begin denetimi de taslak ve kesinleşmiş fiş iptalini aynı kuralla ayırır. Eski hold, actor, kaynak ve hareket korumaları kaldırılmadı.
- Müşteri kartında kaybolan yanıt sonrası açık tekrar denemesinin 400/409 ile reddedilmesi özgün UUID/body ve bekleyen kayıt işaretini temizlemez.
- Güncel satış kaynak zinciri ile önceki kurulu paket ayrı sabit hash'lerle test edilir. Güncel kaynak testleri her ortamda zorunludur; eski paketin bulunmaması güncel kod yerine tarihsel kod yüklemez.
- Müşteri master işlem çerçevesi görünürlük, kolonlar, kısıtlar, UTC audit varsayılanı ve etkin minimum izinleri doğrular; UNKNOWN izin/şema uygunluk sayılmaz. Salt okunur kart için INSERT/UPDATE izni aranmaz.
- Mevcut 5244 normal oturumunda müşteri master context, düzenleme ve özgün UUID kurtarma yolları için dar taşıma hazırlanmıştır. Genel yazma yolu açılmaz; API/native işlem kontrolleri ayrıca zorunludur.

Kaynaklar mevcut feature dalı ve PR54'tedir. Hedefli offline testler ve bağımsız kaynak incelemesi gerçek SQL/kurulum/GUI kabulü değildir. Yeni startup, paket ve API sınırı incelemeleri bitmeden çalışan teslim iddiası yoktur.

`13faa388` GitHub secret-scan, eski TEST API manifestinin kamuya açık SHA256 özetini API anahtarı olarak işaretledi. Kullanıcı ERP-DEC-087 ekindeki tek commit/dosya/kural/değer AND istisnasını açıkça onayladı; farklı commit/dosya/değer/kural için beş izole kontrol geçti, varsayılan taramalar korundu. Yeni kaynak için GitHub CI sonucu ayrıca doğrulanır; önceki başarısız sonuç silinmez.

`1d7ba840f867f0b0a007c1a7dadefb0283821c4e` için PR `41736225082` ve push `41736216554` koşularındaki üç işin tüm adımları başarılı tamamlandı. Bu exact üretici ve `fce4d7aa21d2828c32576a8e5a51adb84fb000fe` uygulama kaynağıyla ayrı pasif API/WEB çifti üretildi; iki manifest ve paket içeriği geri okunarak doğrulandı. Kayıt `C:\Sirket\ERP\evidence\ERP-C06-METADATA-ROUTE-RUNTIME-20261102-2254\c06-passive-1d7ba840f867f0b0a007c1a7dadefb0283821c4e-receipt.json` yolundadır. Adayın satış SQL uyumu `NOT_APPLIED_NOT_VERIFIED`; müşteri şeması, normal aktör izinleri ve data koruma kurulum önkontrolleri `UNVERIFIED`. Aday kurulmadı, çalışan TEST değiştirilmedi ve insan kabulü verilmedi.

## Çalışan TEST sınırı

Bu kaynak diliminde SQL, servis, görev, config, rol, parola, stok/cari/kasa veya ticari kayıt yazması yapılmadı. Mevcut kurulu ERP/CRM ve kullanıcı WIP'i korundu. Önceki normal-session metadata gözleminde müşteri nesnesi PARTIAL, üç yerel metadata nesnesi UNKNOWN idi; nesneler yok sayılmaz ve writer bu gözlemle etkinleştirilemez.

Normal ekran kontrolü için yerel tarayıcı kullanımı önce Work ayarlarında kapalı gözlendi. Daha sonra mevcut Chrome bağlantısı açıldı ve 5244 normal Satış ekranı Semih oturumuyla gerçekten açıldı: müşteri listesi okundu; ekran satış kaydetmenin henüz açık olmadığını gösterdi. Bu gözlem kurulu önceki uygulamaya aittir; yeni fce4d7aa adayının kurulum veya satış kabulü değildir. İnsan kabulü BEKLİYOR.

## Sonraki mevcut adım

Yeni startup/route bağlantısını, paket bağımlılıklarını ve exact CI'yi tamamla. Ardından taze tek-yazar/target/before-image/geri dönüş kanıtıyla izinli TEST bakımını somutlaştır. Müşteri master şeması/izinleri ve satış owner yordam/hash uyumu gerçek native kanıtla tamamlanmadan kurulum veya satış/kart kabulü PASS sayılmaz. Güvenlik erişimi genişletme, yeni kalıcı senaryo, LIVE/Vega/T1 ve insan kabulü sınırları ERP-DEC-087'deki gibi sürer.

4 Kasım: Kullanıcının eski hedefi kaldırmasından sonra `01a107ef-f13e-73c0-9e08-fd5c4545325e` ana konuşmasında yeni hedef oluşturuldu ve desteklenen hedef okumasıyla `active` doğrulandı. Öncelik ERP → Native Android terminal → CRM; küçük bağımsız işler için derleme, güvenlik ve ilgili testler, son TEST teslimi için tam kontroller ve ayrı insan kabulü esas. Bu kayıt hedefin tamamlandığı anlamına gelmez.

CI kapsam değişikliği `47e607b97748baf607731ce3dcd6c7f64c0ec356` için PR koşusu `41741611601` ve push koşusu `41741604288` dört işin tamamını başarılı çalıştırdı; CI değişikliği olduğundan her iki olayda Windows kapsamı FULL idi. Sonraki yalnız doküman güncellemesinin dar kapsam sonucu ayrıca gözlemlenecek; atlanmış Windows sonucu kurulum için tam CI kabul edilmez.
