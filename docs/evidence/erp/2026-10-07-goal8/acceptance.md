# Goal8 — tek insan kabul turu

Bu liste teknik hazırlık içindir; kullanıcı sonucu üretmez. USER_ACCEPTANCE.md ve ERP-UA24 bekleyen kayıtları değiştirilmedi. Başlangıç çalışan sürüm TEST86/source769031c; son paket kimliği teknik README'de ayrıca kaydedilir. Normal yeşil ekran, gerçek katalog/cari okuması ve ayrılmış deneme operasyonları farklı veri kapsamlarıdır. Deneme kayıtlarını gerçek ticari kayıt sanmayın.

Toplam 15–20 dakika; eski UA testlerini tek tek yeniden yapma gereği yok. Alış/satış/ödeme işlemleri yalnız ayrılmış deneme kartlarında yapılır. Gerçek müşteri, tedarikçi veya kaynak kartta işlem kaydedilmez.

| Süre | Ekran | Neye bakılacak | Beklenen |
| --- | --- | --- | --- |
| 2 dk | [İş sırası](http://127.0.0.1:5194/ornek-akis.html#home) | Günün işleri, boş bölüm dili, altı hızlı işlem | Mevcut kayıtlar ve boş durum ayrıdır; TRY/USD/EUR toplanmaz; kısa yollar çalışır. |
| 3 dk | [Ürün & stok](http://127.0.0.1:5194/ornek-akis.html#stock) | 0161 MOLLY, barkod, fotoğraf, marka/tür, sonraki50, kart | Başındaki sıfır korunur, gerçek fiyat/döviz görünür; karantinada işlem açılmaz. |
| 3 dk | [Mal kabul](http://127.0.0.1:5194/ornek-akis.html#goods) → [Alış](http://127.0.0.1:5194/ornek-akis.html#purchases) | Ayrılmış deneme kayıtlarında kabul/fatura bağlantısı, kaydı yenileme | Kalıcı kabul ve fatura geri okunur; gerçek kaynağa işlem yapılmaz. |
| 3 dk | [Satış](http://127.0.0.1:5194/ornek-akis.html#sales) → [Tahsilat](http://127.0.0.1:5194/ornek-akis.html#collections) | Ayrılmış müşteri fişi ve kalan tutar | Fiş toplamı, tahsilat ve kendi dövizi doğru; refresh ikinci kayıt oluşturmaz. |
| 3 dk | [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers) → [Ödeme](http://127.0.0.1:5194/ornek-akis.html#supplier-payments) | Ayrı döviz hesapları/B-A; deneme ödeme kapsamı | Kaynak tarihi ve sonraki kaynak drift ayrıdır; TRY/USD/EUR bağımsız. Goal7.3 hatası diye eski rakamı güncel rakama eşitlemeyin. |
| 2 dk | [Sayım](http://127.0.0.1:5194/ornek-akis.html#count) → [İade](http://127.0.0.1:5194/ornek-akis.html#returns) | Kalıcı taslak ve kaynak belge; personel/onay ayrımı | Yerel örnek veriye düşmez; personel tek başına stok/finans onayı vermez. |
| 2 dk | [Raporlar](http://127.0.0.1:5194/ornek-akis.html#reports) → [Ayarlar](http://127.0.0.1:5194/ornek-akis.html#settings) | Bugünkü dövizli toplamlar ve hizmet durumu | Aynı kapsam ve ayrı döviz; hizmet/fiziksel başlangıç kabulü birbirine karışmaz. |
| 2 dk | [CRM](http://127.0.0.1:62400/) / mevcut personel terminali | Atanmış konuşma, çeviri, ortak ürün/fotoğraf/fiyat ve mevcut taslak geri okuma | Yeni gerçek mesaj gönderilmez; ikinci ticari katalog oluşturulmaz; fiziksel Zebra ayrıca denenir. |

Tam iş günü teknik zinciri ve cutover okuyucu engelleri kapanmadan bu kısa tur tek başına LIVE izni veya Goal8 tamam sonucu değildir. Kullanıcı açıkça verdiğinde sadece ilgili insan sonucu kaydedilir; teknik kontroller otomatik PASS yapmaz.

## Fiziksel terminalin kalan tek listesi

Wi-Fi, scanner trigger, Enter suffix, kamera izni/okuma, uyku/uyanma, mevcut personel login ve bir vardiya boyunca kullanım. Fiziksel Zebra bağlı değilse önceki tarayıcı terminal kanıtı korunur; cihaz kabulü yapılmış sayılmaz.
