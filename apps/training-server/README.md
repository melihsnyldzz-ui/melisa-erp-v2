# Melisa ERP eğitim sunucusu

Bu sunucu yalnız ilk mal kabulü dersine aittir. ERP API'sini, SQL Server'ı, dotenv dosyalarını veya başka bir servis adresini kullanmaz. Node.js 24 ile çalışır. Yeni kayıtlar yalnız kendi SQLite dosyasına yazılır.

```powershell
node apps/training-server/server.mjs --port 5214 --data-dir C:/Sirket/ERP/training-mode/data --seed-file C:/Sirket/ERP/training-mode/seed.json
```

Önce `apps/sites-workflow` derlemesi hazırlanır. Eğitim adresi `http://127.0.0.1:5214/egitim.html` olur. Sunucu yalnız loopback üzerinde dinler; 5194 ve 5204 portlarını kabul etmez. Normal ERP HTML girişlerini sunmaz. Harici adres, farklı Host/Origin veya başka satış/ödeme API'si kabul edilmez.

Veritabanı adı `erp-training.sqlite` sabittir. Yeni dosya yalnız exclusive create ile açılır. Mevcut dosya önce salt okunur açılır ve `MELISA_ERP_TRAINING_ONLY`, application_id, sürüm, bütün şema tanımları ve SQLite bütünlüğü doğrulanır. Eğitim kimliği taşımayan dosyaya şema kurulmaz ve dosya değiştirilmez.

Özel seed dosyası repoya eklenmez. Biçimi:

```json
{
  "source": "approved-card-copy",
  "supplier": {"id":"1","code":"EGITIM-TEDARIKCI","name":"Eğitim tedarikçisi (örnek)"},
  "products": [
    {"id":"101","stockCode":"ÖRNEK-1","name":"Ürün kartından kopyalanan ad","barcode":null,"purchasePriceExact8":"100.00000000","baselineQuantity":"10.000","expectedQuantity":"2.000"},
    {"id":"102","stockCode":"ÖRNEK-2","name":"Ürün kartından kopyalanan ad","barcode":null,"purchasePriceExact8":"100.00000000","baselineQuantity":"10.000","expectedQuantity":"3.000"}
  ]
}
```

Fotoğraf için ürüne `photoBase64`, `photoMime` (`image/jpeg`, `image/png` veya `image/webp`) ve doğrulanmış `photoSha256` eklenir. Sunucu fotoğrafı veritabanındaki kart kopyasından sunar; uzak fotoğraf adresine gitmez. Kart kimliği gerçek olsa da adet, fiyat, depo ve ticari hareketler eğitim alıştırmasıdır. Seed verilmezse açıkça örnek olan iki kurgu kart kullanılır.

`GET /api/training/session`, HttpOnly/SameSite=Strict cookie ile eğitim oturumu kurar ve `data.csrfToken` döndürür. Yazılar `X-Training-CSRF`, geçerli `exerciseId` değerini taşıyan `X-Training-Exercise`, JSON ve UUID `requestId` ister. İstek gövdesi tamamen alındıktan sonra güncel oturum yeniden okunur; tekrar başlatılmadan önce açık kalmış sekmeler eski alıştırma kimliğiyle yazamaz. Aynı kimlik/istek tekrarında önceki sonuç döner; farklı gövde veya farklı alıştırma aynı kimlikle reddedilir. Önizleme ticari kayıt üretmediğinden `requestId` istemez.

Her cookie ayrı alıştırma taşır. `GET /api/training/state` ilerlemeyi verir. `POST /api/training/progress`, gerçek alıştırma sonuçları ve doğru sınav cevapları olmadan ders tamamlanmasını kabul etmez. `POST /api/training/repeat` yeni alıştırma kurar; geçmişi silmez. Sunucu yeniden açıldığında aynı cookie kaldığı alıştırmayı bulur.

Mal kabulü stok artışını bir transaction içinde bir kez uygular. Alış taslağı stok ve borç yazmaz. Kesinleşme tedarikçi borcunu bir kez ekler; stok artışını tekrarlamaz. Para ve adet hesapları sabit ondalık BigInt kullanır.

Kontroller:

```powershell
node --test apps/training-server/test/*.test.mjs
```

Testler yalnız yeni geçici dosyalar ve rastgele loopback portu kullanır. TEST125, gerçek SQL Server veya mevcut eğitim runtime veritabanını kullanmaz.
