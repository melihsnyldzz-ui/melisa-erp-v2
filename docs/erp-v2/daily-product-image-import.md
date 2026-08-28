# Günlük Ürün Görseli Aktarımı

Bu akış yeni gelen ürün fotoğraflarını PaddleOCR ile model kodu ve marka bazında ayırır, aktif Vega stok kartlarıyla salt okunur eşleştirir ve yalnızca kesin eşleşmeleri Melisa ERP'nin yerel görsel tablosuna kaydeder.

## Klasörler

- `01_GELEN`: Her gün yeni fotoğrafların bırakılacağı tek giriş klasörü.
- `02_AYRILAN`: OCR sonrasında marka/tedarikçi ve model koduna göre ayrılan fotoğraflar.
- `03_KONTROL_GEREKEN`: Sonraki aşamada insan onayı gerektiren belirsiz eşleşmeler için ayrılmış alan.
- `04_AKTARILAN`: Sonraki aşamada başarıyla aktarılanların günlük paketleri için ayrılmış alan.
- `05_ARSIV`: Kaynak fotoğrafların tarih bazlı arşivi için ayrılmış alan.
- `RAPORLAR`: Her önizleme ve aktarımın JSON/CSV kanıtı.

Kök klasör: `C:\Users\Xaser\Desktop\MELISA_GUNLUK_URUN_FOTOGRAFLARI`

## Güvenlik kuralları

- Vega SQL yalnızca aktif stok eşleştirme listesini okumak için kullanılır; Vega'ya yazılmaz.
- Model kodu tek başına yeterli değildir. Marka/tedarikçi de stok kodu veya marka alanıyla doğrulanmalıdır.
- Birden fazla aday, marka uyuşmazlığı veya bulunamayan model `review_required` durumunda kalır.
- Mevcut görseli olan stok kartı varsayılan olarak değiştirilmez.
- `--apply` olmadan komut yalnızca önizleme raporu üretir.
- Her gerçek kayıt `daily-photo-import` aktörüyle Melisa ERP audit kaydına yazılır.

## Günlük kullanım

1. Yeni fotoğrafları `01_GELEN` klasörüne kopyalayın.
2. `MODEL_UYGULAMA.cmd` dosyasını açıp **Tara ve Ayır** düğmesine basın.
3. **ERP Eşleştir** ile önizleme üretin ve `RAPORLAR` klasöründeki CSV'yi kontrol edin.
4. Yalnızca sonuç doğruysa **Kesinleri ERP'ye Aktar** düğmesine basıp onay verin.
5. Belirsiz kayıtlar otomatik yüklenmez.

## Stok listesinde görsel filtresi

`Stok Listesi > Ayrıntılı filtreler > Görsel durumu` alanı üç seçenek sunar:

- `Tüm ürünler`
- `Sadece görseli olanlar`
- `Görseli olmayanlar`

Filtre Vega stok kartlarını değiştirmez. Görsel durumu Melisa ERP'deki aktif Vega ürün görseli eşleştirmesinden okunur ve Vega listesi sayfalanmadan önce uygulanır.

CLI önizleme örneği:

```powershell
npm.cmd run vega:daily-image-preview -- --source "C:\Users\Xaser\Desktop\MELISA_GUNLUK_URUN_FOTOGRAFLARI\02_AYRILAN" --reports "C:\Users\Xaser\Desktop\MELISA_GUNLUK_URUN_FOTOGRAFLARI\RAPORLAR"
```
