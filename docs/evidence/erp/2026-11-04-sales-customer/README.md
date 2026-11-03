# Satış ve müşteri kartı — 4 Kasım kaynak teslimi

Mevcut ERP49 içindeki B04/C04 satış ve B03/C06 müşteri kartı kapsamıdır. Özgün kabul ID'leri ve kapanış sayıları değişmez. ERP-DEC-087 ile aynı konuşmada aktif native hedef kaydedildi; yeni tracker veya finish ağacı yok.

## Kanıtlanan kaynak davranışı

- Satış taslağı, native hesap alanları kesinleştirmeye kadar NULL iken doğrulanmış oluşturma kaydı ve seçili hesaptan okunur. Kesinleşmiş fişte native hesap/cari damgaları zorunludur. Owner begin denetimi de taslak ve kesinleşmiş fiş iptalini aynı kuralla ayırır. Eski hold, actor, kaynak ve hareket korumaları kaldırılmadı.
- Müşteri kartında kaybolan yanıt sonrası açık tekrar denemesinin 400/409 ile reddedilmesi özgün UUID/body ve bekleyen kayıt işaretini temizlemez.
- Güncel satış kaynak zinciri ile önceki kurulu paket ayrı sabit hash'lerle test edilir. Güncel kaynak testleri her ortamda zorunludur; eski paketin bulunmaması güncel kod yerine tarihsel kod yüklemez.
- Müşteri master işlem çerçevesi görünürlük, kolonlar, kısıtlar, UTC audit varsayılanı ve etkin minimum izinleri doğrular; UNKNOWN izin/şema uygunluk sayılmaz. Salt okunur kart için INSERT/UPDATE izni aranmaz.
- Mevcut 5244 normal oturumunda müşteri master context, düzenleme ve özgün UUID kurtarma yolları için dar taşıma hazırlanmıştır. Genel yazma yolu açılmaz; API/native işlem kontrolleri ayrıca zorunludur.

Kaynaklar mevcut feature dalı ve PR54'tedir. Hedefli offline testler ve bağımsız kaynak incelemesi gerçek SQL/kurulum/GUI kabulü değildir. Yeni startup, paket ve API sınırı incelemeleri bitmeden çalışan teslim iddiası yoktur.

## Çalışan TEST sınırı

Bu kaynak diliminde SQL, servis, görev, config, rol, parola, stok/cari/kasa veya ticari kayıt yazması yapılmadı. Mevcut kurulu ERP/CRM ve kullanıcı WIP'i korundu. Önceki normal-session metadata gözleminde müşteri nesnesi PARTIAL, üç yerel metadata nesnesi UNKNOWN idi; nesneler yok sayılmaz ve writer bu gözlemle etkinleştirilemez.

Normal ekran kontrolü için yerel tarayıcı kullanımı son araç gözleminde Work ayarlarında kapalıydı. Kullanıcıya bunu açması için tek istek iletildi; açıldığı doğrulanmadan GUI sonucu üretilmez. İnsan kabulü BEKLİYOR.

## Sonraki mevcut adım

Yeni startup/route bağlantısını, paket bağımlılıklarını ve exact CI'yi tamamla. Ardından taze tek-yazar/target/before-image/geri dönüş kanıtıyla izinli TEST bakımını somutlaştır. Müşteri master şeması/izinleri ve satış owner yordam/hash uyumu gerçek native kanıtla tamamlanmadan kurulum veya satış/kart kabulü PASS sayılmaz. Güvenlik erişimi genişletme, yeni kalıcı senaryo, LIVE/Vega/T1 ve insan kabulü sınırları ERP-DEC-087'deki gibi sürer.
