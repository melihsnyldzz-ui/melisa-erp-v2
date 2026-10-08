# Belge/giriş öncelikli son net alış — ERP-MIGUNIFIED01 eki

8 Ekim 2026 / ERP-DEC-029 / [PR23 talimatı](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6057616427).

Bu dar uygulama, immutable kart alış kanıtının üzerine ayrı sürümlü referans metadata ekler. Kaynak önceliği geçerli alış belgesi → kanıtlı ticari giriş → mevcut kart alış bilgisi → bilinmiyor. Eski 16.668 kart kaydı ve SQL modülleri değişmez. Native maliyet, stok, satış fiyatı, cari/finans, roller ve karantina yazılmaz.

Kaynak F0102 kart/birim ve mevcut F0103 D0001–D0007 alış belgesi kapsamı, 9 Ekim öncesi tarihlerle SELECT-only iki geçişte okunur. Ürün bağı yalnız kesin tam stok kodu veya mevcut tam model + tedarikçi kodu + aynı kaynak marka kuralıyla kurulur. Kısa model tek başına net alış sağlayamaz. Çelişkili bağlantı adayları uyarı olarak korunur.

Belge sınıfı20, iptal/iade dışı durum, pozitif aynı-birim miktarı, çarpan1, açık satır TL/KUR1, KDV oranı0/masraf0 ve başlık–satır toplamı–tek muhasebe yansıması tam mutabakatı birlikte zorunludur. Net satır tutarı miktara bölünür; kart iskontosu yeniden uygulanmaz. Başlık USD etiketi satır TRY tutarına taşınmaz; doğrulanmamış FX dönüşümü yapılmaz. NULL vergi/masraf tutarları sıfır varsayılmaz. Tam rasyonel pay/payda saklanır; tekrar eden bölümün 18 basamaklı sunumu ayrıca işaretlenir.

Aynı gün çelişen fiyatlar en yüksek ID veya saatle çözülmez. Eski geçerli belge seçilirse tarih ve daha yeni/aynı-gün belirsizlik uyarısı görünür. Ticari giriş belgesi kesin kanıtlanmadığı için bu kaynakla tutar doldurulmaz.

Uygulama öncesinde yeni COPY_ONLY/CHECKSUM/VERIFYONLY yedek, mevcut immutable parent hashleri, bütün eski SQL modülleri, native/binding/hold/manual CAS ve her ürüne bağlı bütün adayların güncel hashleri doğrulanır. Drift yaşayan ürün tekil atlanır. Batch SERIALIZABLE/applock işlemi, metadata readback ve sıfır etkili replay kullanır. Uygulama sonuçları bu dosyaya son teslimde eklenecek; hazırlık teknik tamamlandı veya insan kabulü değildir.

Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) ürün kartındaki izinli ayrı alış düğmesi seçilen net tutarı/dövizi/birimi/tarihi/kaynağı ve değişmeyen kart bilgisini gösterir. Üç mevcut izin product.view + purchase.view + finance.view korunur; satış/CRM kataloğu bu bilgiyi alamaz. Liste veya ilk kart açılışında belge taraması yapılmaz. Ham belgeler, gerçek örnek tutarlar, source kimlikleri ve ekran görüntüleri repo dışı private kanıttadır.

Önceki bütün migration tamamlandı sayılmaz. ERP-UA24/25 bekliyor; bu ekten sonra yeni finans uygulaması veya başka goal başlamaz.
