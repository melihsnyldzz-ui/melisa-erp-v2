# Ürün kapsamlı stok hareketleri

Ürün kartındaki Stok Hareketleri düğmesi ürün kimliğini gönderiyordu; Workspace bu değeri ekrana aktarmadığı için başlığı ürün adı olan sekme bütün ürünlerin hareketlerini gösteriyordu.

Workspace artık ürün kimliğini ve stok kodunu aktarır. Liste mevcut `/api/stock-movements` kontratının `productId` filtresini kullanır. Ekranın başlığı kapsamı belirtir. Temizle ve Tüm Hareketler yalnız ek filtreleri sıfırlar; ürün kapsamı korunur. Ürün kimliği değiştiğinde ekran yeniden açılır. Genel menüden açılan liste bütün ürünleri göstermeye devam eder. API, Vega ve ticari yazma kodu değiştirilmedi.

2026-09-08 ayrı commerce SQL laboratuvarı ve gerçek tarayıcı/API kabulü:

- TEST-WEB-P1 kartından açılış: yalnız bu ürünün iki hareketi, giriş 10 / çıkış 2 / net 8.
- Çıkışlar: tek satış satırı; Temizle: aynı ürünün iki satırı.
- Başka ürün kodu araması: sonuç yok; Tüm Hareketler: aynı ürünün iki satırı.
- Genel menü: üç test ürününün sekiz hareketi; ürün sekmesine dönüş: tekrar yalnız iki satır.
- Son SQL kontrolü: stok 8, müşteri 40 TRY, tedarikçi 110 TRY, kasa 10 TRY korunuyor.
- 226 mevcut web kontrolü, 182 kök / 0 tanı typecheck, lint ve build PASS; büyük bundle uyarısı sürüyor.

Test servisleri durduruldu. Yeni ticari kayıt, gerçek iş verisi yazma ve mesajlaşma yok. Kanıtlar Development OS `audit/commerce-no-messaging-20260908/stock-movement-scope/acceptance.json` altında. Tam ERP kabulü, diğer liste kaynakları, belge numarası ve rapor/kasa senaryoları açık.
