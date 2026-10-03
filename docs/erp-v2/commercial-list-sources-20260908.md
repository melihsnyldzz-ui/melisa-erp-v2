# Ticari listelerde açık kaynak seçimi

Cari, tedarikçi, satış ve alış listelerinde Vega — salt okunur / Melisa ERP seçimi vardır. Önceki varsayılan Vega korunur; bağlantı hatası otomatik kaynak değiştirmez. Kaynak değişince alt ekran yeniden oluşturulur: önceki satır, seçim, detay ve filtre durumu taşınmaz. Kaynak seçimi tek ekran kabuğu içinde ayrı, dar bir satırdır.

Mevcut Melisa satış/alış liste bileşenleri menüden erişilebilir hale geldi; endpoint veya SQL yazma kontratı değiştirilmedi. Cari ve tedarikçi listeleri seçilen kaynağın kendi okuyucusunu kullanır. Melisa satırları yerel kimlikle karta, Vega satırları sourceId ile salt okunur hareket ekranına gider. Satış listesindeki eski Vega peşin cari kısayolları açıkça Vega hareketleri olarak etiketlendi. Yetki kapıları korunur.

Gerçek tarayıcı / ayrı test SQL kabulü:

- Melisa cari listesinde 5 kayıt; TEST-WEB-C1 araması ve karta geçiş, 40 TRY bakiye.
- Melisa tedarikçi listesinde TEST-WEB-S1 araması ve karta geçiş, 110 TRY bakiye.
- Melisa satış ve alış listelerinde önceki taslaklar ve kesinleşmiş belgeler; seçili SDR-20018 ve PDR-16 doğru fişe açılır.
- Kesinleşmiş filtrelerinde 4 satış ve 1 alış; diğer taslaklar görünmez.
- Dört listede Vega'ya dönüşte önceki Melisa satırları kaybolur. Testte Vega yapılandırması bulunmadığı için hata görünür; gerçek Vega başarı kabulü çıkarılmaz. Cari yeni kayıt ve seçili Vega hareket düğmeleri kapalıdır.
- Son kaynak seçim satırı görsel olarak yeniden doğrulandı. Son SQL stok 8, müşteri 40, tedarikçi 110, kasa 10 TRY değişmedi. Ticari write isteği ve mesajlaşma 0.
- 226 mevcut web kontrolü, 183 kök / 0 tanı typecheck, lint ve web build PASS; büyük bundle uyarısı sürer.

Test servisleri kapalı; gerçek ERP/Vega verisine müdahale ve push/deploy yok. Kanıt: Development OS `audit/commerce-no-messaging-20260908/commercial-list-sources/acceptance.json`.

Tam ERP kabulü değildir. Ürün/cari kartından fiş listesine kapsam/başlangıç filtresi aktarımı, rapor/kasa/çoklu döviz, dar ekranlarda tablo/özet yerleşimi ve kaynak/main uzlaştırması açık. Kaynak seçiminin kullanılabilir olması bu konuları tamamlanmış saydırmaz.
