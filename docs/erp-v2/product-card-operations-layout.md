# Product Card Operations Layout

The product card prioritizes stock movement review for existing products.

## Reading Order

1. Product 360 summary
2. Open stock movement history
3. Collapsible product information and image
4. Barcode management

The stock movement table shows the operational columns needed for quick review: date, movement type, document, customer or supplier, quantity, TRY amount, and navigation. Document and party links continue to open the related ERP records.

The separate stock summary card was removed because its values already exist in Product 360. Product editing, image upload, barcode operations, permissions, and API behavior are unchanged.

When creating a new product, selecting an existing main supplier applies the currency stored on that supplier card to the product currency. The operator may still change the value before saving. Changing the supplier on an existing product does not silently replace its currency.
# Kart Açılış Tarihi

Ürün kartının açılış tarihi `products.created_at` alanıdır. Veritabanı bu değeri kart oluşturulurken UTC olarak otomatik üretir. API değeri `cardOpenedAt` adıyla yalnızca okuma amacıyla döndürür.

Kart açılış tarihi ürün kartında Türkiye saatine göre tarih ve saat olarak gösterilir. Kullanıcı tarafından düzenlenemez; tekil veya toplu kart oluşturma payload'ına dahil edilmez ve güncelleme işleminde değiştirilemez.
