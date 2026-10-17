# ERP-STAGE0501 — tek insan kontrol turu

9 Ekim 2026 · **18 dakika / sekiz durak** · ERP-UA28 **bekliyor**.

Çalışan TEST125 korunur. [Normal ERP](http://127.0.0.1:5194/ornek-akis.html) kaynak kayıtlarını gösterir. [Günlük prova kopyası](http://127.0.0.1:5204/ornek-akis.html) gerçek kaynak kartlarının güvenli TEST kopyasında önceden kaydedilmiş işlemleri gösterir; yalnız bu bilgisayarda açılır. Kopya işlemleri gerçek şirket açılışı veya bugünkü Vega bakiyesi değildir.

Yeni satış, ödeme, tahsilat, sayım, iade veya taslak oluşturulmaz. Mevcut oturum ve kaydedilmemiş taslak korunur. Taslak kaybına yol açacak ekran/rol geçişi o durakta ertelenir; taslak silinmez. Satış personeli ve İlker mevcut rollerini kullanır, yeni izin verilmez.

| Süre | Ekran / mevcut rol | Kontrol edilecek sonuç |
|---|---|---|
| 2 dk | Kopya [İş sırası](http://127.0.0.1:5204/ornek-akis.html#home), İlker | Kayıtlı iş günü 8 Ekim; dövizler ayrı; deneme kasa tutarı gerçek şirket açılışı sayılmaz. |
| 2 dk | Normal [Ürün & stok](http://127.0.0.1:5194/ornek-akis.html#stock), mevcut rol | Baştaki sıfırlı kod/barkod doğru ürünü bulur; fotoğraf, marka/tür, stok/birim ve fiyat/döviz okunur. Sonraki 50 açılır. |
| 3 dk | Kopya [Gelen mal](http://127.0.0.1:5204/ornek-akis.html#goods) → [Alış](http://127.0.0.1:5204/ornek-akis.html#purchases), İlker | Kaydedilmiş iki satırlı kabul ile alış faturasının bağı ve tedarikçi borcu anlaşılır; ikinci stok girişi gibi gösterilmez. |
| 3 dk | Kopya [Satış terminali](http://127.0.0.1:5204/ornek-akis.html#sales) → [Satış fişleri](http://127.0.0.1:5204/ornek-akis.html#receipts) → [Tahsilat](http://127.0.0.1:5204/ornek-akis.html#collections), mevcut yetkili rol | Terminalin müşteri/barkod/sepet alanları yalnız okunur; ürün eklenmez. Mevcut fişte aynı müşterinin satış/tahsilat bağı, miktar, fiyat, ayrı döviz ve kalan borç okunur. Yenileme yeni fiş yaratmaz. |
| 2 dk | Normal [Ödeme geçmişi](http://127.0.0.1:5194/ornek-akis.html#supplier-payments), ardından kopya aynı ekran; İlker | Eski geçmiş açılır. Kopyada ödeme, ters kayıt ve sonraki ayrı ödeme korunur; tarih/döviz/borç yönü anlaşılır. |
| 2 dk | Kopya [Sayım](http://127.0.0.1:5204/ornek-akis.html#count) → [İadeler](http://127.0.0.1:5204/ornek-akis.html#returns), mevcut roller | Kayıtlı personel farkı, yetkili gerekçe, iade ve ters kayıt okunur. Personelin tek başına stok/finans onayı yapamaması ve özgün alış geçmişi korunur. |
| 1 dk | Kopya [Raporlar](http://127.0.0.1:5204/ornek-akis.html#reports), İlker | 8–9 Ekim özel aralığında aynı zincir görülür. TRY/USD/EUR toplanmaz; ödeme/ters kayıt ayrı görünür. |
| 3 dk | Zebra, erişimi doğrulanmış mevcut TEST terminali | Yalnız katalog aramasında başı sıfırlı barkod okutulur; tek doğru kart, stok/fiyat/fotoğraf ve tek elle okunabilirlik kontrol edilir. Satış terminalinin sepete ekleyen barkod alanında prova yapılmaz. Yeni sepet/işlem yok. Cihaz erişilemiyorsa **Denenmedi** yazılır. Masaüstü gösterim fiziksel kabul değildir. |

Her durakta tek soru: **“Bu kaydı ve işlemin sonucunu ekrandan açıkça anlayabiliyor musunuz?”** Yanıt `Uygun / Sorun / Denenmedi`, kişi ve tarih ile kaydedilir. Somut sorun varsa ekran ve gözlenen davranış yazılır; teknik test insan sonucu yerine konmaz.

Yanlış ürün/cari/döviz, kayıp geçmiş, taslak kaybı, yetkisiz onay veya yeni kayıt oluşması halinde ilgili durak durdurulur. Bir ekranın beğenilmesi bütün ERP/LIVE kabulü değildir. ERP-UA27 ve önceki bekleyen kabuller değişmez.

## Turdan ayrı kalan cihaz kabulü

Güncel salt okunur Windows/ADB gözleminde fiziksel erişim doğrulanamadı; cihazın kesinlikle bulunmadığı iddia edilmez. Yeni cihaz/ADB bağlantısı, kurulum veya ayar yapılmadı. Üç dakikalık durak yalnız hızlı scanner/ekran kontrolüdür. Wi-Fi kopması, uyku/uyanma, mevcut personel oturumu, vardiya çıkışı ve gerçek cihaz hızı ayrıca kabul edilmelidir; ERP-UA18 bekliyor.

## Sonuç kaydı

| Durak | İnsan sonucu | Kişi / tarih | Somut gözlem |
|---|---|---|---|
| İş sırası | Bekliyor | — | — |
| Ürün / barkod | Bekliyor | — | — |
| Mal kabul / alış | Bekliyor | — | — |
| Satış / tahsilat | Bekliyor | — | — |
| Ödeme geçmişi | Bekliyor | — | — |
| Sayım / iade | Bekliyor | — | — |
| Rapor | Bekliyor | — | — |
| Zebra fiziksel | Erişim doğrulanamadı / bekliyor | — | — |
