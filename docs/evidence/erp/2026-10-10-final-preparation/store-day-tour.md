# Tek mağaza günü kontrol turu — 15–20 dakika

ERP-DEC-041 / CRM-DEC-009 / ERP-CRM-FINAL01. Bu belge turu hazırlar; geniş insan TEST'ini başlatmaz ve insan kabulü vermez. ERP-UA30 / CRM-UA08 **bekliyor**.

## Ortam ve kapsam

- ERP: http://127.0.0.1:5234/ornek-akis.html
- CRM: http://127.0.0.1:62700/
- Zebra: http://192.168.1.46:5234/terminal.html#products
- Ortak hedef yalnız izole DB02. TEST125, LIVE, Vega ve Eğitim PR27 korunur.
- Günlük finans provası yalnız imzalı seçimdeki TRY ürün/müşteri/tedarikçi ve mevcut sentetik deneme kasasıdır. Bu kasa gerçek işletme açılışı değildir. TRY/USD/EUR katalog, cari ve mevcut sipariş okuması ayrı kontrol edilir; dövizler toplanmaz.
- Tam ürün, barkod, kişi, hesap, belge ve beklenen tutarlar özel kanıt dosyasından seçilir. İsim benzerliğiyle yeni eşleme yapılmaz. Mevcut taslaklar değiştirilmez.

## Tek tur

| Süre | Durak | Gözle kontrol edilecek sonuç | İşlem sınırı |
|---|---|---|---|
| 2 dk | Ürün & Stok / Zebra | Fiziksel okutulan barkod doğru kod, marka, fotoğraf, stok ve kendi döviz fiyatını getirir. Sıfırlı barkod varsa sıfırlar korunur. | Fiziksel okuyucuyla kullanıcı okutur; ADB metni optik test sayılmaz. Satış/stok oluşmaz. |
| 2 dk | CRM katalog ve sipariş | Aynı ERP ürünü, fiyatı, dövizi ve onaylı görsel okunur. Mevcut TRY/USD/EUR taslakları ERP'den tekrar okunur; başka aktörün taslağı erişime açılmaz. | Mevcut kayıtlar okunur. Yeni taslak ancak ayrıca onaylanan tur kapsamında; WhatsApp/AI/dış gönderim kapalı. |
| 3 dk | Mal kabul → İlker onayı → alış | Personel sayımı/gönderimi görünür; onay tek stok etkisi verir; alış faturası ilgili dövizde tedarikçi borcuna bağlanır. Yenileme aynı belgeyi getirir. | Teknik prova kayıtları önce okunur. İnsan işlem turu ayrı onaydan sonra yalnız imzalı TEST seçiminde yapılır. |
| 2 dk | Tedarikçi ödemesi | Ödeme geçmişi açılır, fatura bağlantısı, tarih, döviz, borç ve kasa etkisi birlikte görünür; yenileme çoğaltmaz. | Bilinmeyen açılış borcuna ödeme yok. Yalnız aynı TEST faturası. |
| 3 dk | Satış → müşteri borcu → tahsilat | Müşteri adı/kodu doğru; barkod ve miktar okunur; fiş, ayrı döviz borcu ve tahsilat geçmişi yenilemeden sonra korunur. | Gerçek müşteri mesajı, belge gönderimi veya gerçek ödeme yok. |
| 3 dk | Sayım / iade | Personel farkı tek başına stoğa işleyemez. Yetkili onay tek etki verir. İade orijinal belgeyi korur; stok ve ilgili borç etkisi birlikte okunur. | Desteklenmeyen ters kayıt kapısı zorlanmaz. Sayım iptali bağımsız kanıtlanmadıysa açık kalır. |
| 2 dk | Raporlar / gün sonu | Satış, alış, tahsilat, ödeme, sayım ve iade kayıtları doğru tarih/para biriminde görünür. Kaynak açılış, yerel ve sentetik deneme etkileri karıştırılmaz. | TRY/USD/EUR ayrı; sahte genel toplam yok. |
| 1 dk | Wi-Fi / uyku / oturum | Zebra uyanınca aynı yetkili personel oturumu ve bağlantı çalışır; yenileme ikinci işlem oluşturmaz. | Fiziksel kişi gözlemi kaydedilir; otomatik kontrol insan kabulü değildir. |

## İnsan sonuç kaydı

Her durak için kişi, tarih, **UYGUN / SORUN / DENENMEDİ** ve kısa gözlem yazılır. Sorun varsa belge/istek kimliği korunur; yeni UUID ile aynı ticari işlem tekrarlanmaz. Kullanıcı/İlker açık sonuç vermedikçe hiçbir kabul PASS olmaz.

Gerçek kasa/banka açılışları, kökeni bilinmeyen belgeler ve eksik kişi-cari eşlemeleri bu turda tahminle tamamlanmaz. Son teknik rapor, tur kapsamındaki hazır bağlantıları ve kapsam dışında kalan engelleri ayrı gösterir. Final T1/LIVE için ayrıca sayısal kapsam, kaynak kesimi, kurtarma doğrulaması ve kullanıcı onayı gerekir.
