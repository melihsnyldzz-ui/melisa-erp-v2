# Toplu Ürün Düzenleme

## Amaç

Stok Listesi ekranında seçilen en fazla 500 ürünün kategori, marka, ana tedarikçi ve ürün adı içeriğini tek kontrollü işlemle güncellemek.

## Kullanım

1. `Stok > Stok Listesi` ekranını açın.
2. Ürün satırlarındaki seçim kutularını kullanın. Üst kutu, o anda görünen ürünlerin tümünü seçer.
3. `Toplu Düzenle` düğmesine basın.
4. Yalnızca değiştirmek istediğiniz alanları işaretleyin.
5. Ürün adı için `bul/değiştir`, `başına ekle` veya `sonuna ekle` işlemlerinden birini seçin.
6. `Önizle` ile etkilenecek ürünleri ve alanları kontrol edin.
7. Ekrandaki onay kodunu yazıp `Değişiklikleri uygula` düğmesine basın.

## Güvenlik Kuralları

- İşlem için `product.edit` yetkisi gerekir.
- En fazla 500 ürün tek işlemde seçilebilir.
- Stok miktarı, barkod, satış fiyatı, alış fiyatı ve para birimi değiştirilmez.
- Önizleme veritabanına yazmaz.
- Uygulama tek transaction içinde çalışır; bir ürün veya tedarikçi geçersizse tüm işlem geri alınır.
- Uygulanan değişiklikler `products_bulk_updated` audit kaydıyla izlenir.
- API yazma koruması kapalıysa uygulama yapılmaz.
