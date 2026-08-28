# Proforma Hazırlama

## Amaç

`Satış > Proforma Hazırlama` ekranı, Vega 2026 satış fişlerini kaynak alarak düzenlenebilir proforma çıktısı üretir.

## Veri sınırı

- Fiş başlığı, müşteri ve ürün satırları Vega'dan salt okunur alınır.
- GTİP bilgisi varsa Melisa ERP'deki `vega_product_customs` eşleştirmesinden okunur.
- Yerel eşleştirmede kod yoksa API, ürün adı ve açık malzeme işaretlerinden açıklanabilir bir **otomatik GTİP taslağı** üretir. Bu işlem Vega'ya veya Melisa ERP SQL'e kayıt yazmaz.
- Vega stok kartındaki `4-ÖK` alanı teknik olarak `F0102TBLSTOKLAR.KOD4` kolonudur. Proforma satırına `specialCode4/category` olarak taşınır ve otomatik GTİP taslağında ürün türü işareti olarak değerlendirilir.
- Kayıtlı `verified` GTİP her zaman otomatik kuralın önündedir ve ezilmez. Kayıtlı `draft` kod da korunur; otomasyon yalnızca kodu boş satırda çalışır.
- Proforma düzenlemek Vega satış fişini, stok miktarını, cari bakiyeyi veya muhasebe kaydını değiştirmez.
- Taslak kaydı yalnızca kullanılan tarayıcının yerel saklama alanındadır; resmi ERP belgesi veya e-Fatura değildir.
- Kaynak fiş, cari veya satır bilgileri taslak kaydedildikten sonra değişirse eski taslak canlı verinin üzerine uygulanmaz. Ekran güncel Vega fişini yükler ve eski taslağın kullanılmadığını açıkça bildirir.

## Kullanım

1. Satış Fişleri ekranında bir fiş seçip `Seçili Fişten Proforma` düğmesine basın veya Proforma Hazırlama ekranında fişi arayın.
2. Cari karttan gelen unvan, adres ve iletişim bilgilerini kontrol edin.
3. Proforma numarası, geçerlilik tarihi, teslim şekli, ödeme koşulu, koli ve ağırlıkları girin.
4. Ürün açıklamalarını, miktarları, fiyatları ve otomatik/kayıtlı GTİP kodlarını kontrol edin. İstenmeyen satırların `Dahil` seçimini kaldırın.
5. `Taslağı Kaydet` ile bu cihazda saklayın.
6. `PDF Kaydet` ile yazdırma ekranını açın ve hedef olarak `PDF olarak kaydet` seçeneğini kullanın.

## Kontroller

- Proforma numarası ve alıcı unvanı zorunludur.
- GTİP bulunmayan satırlar hem ekranda hem çıktıda uyarı olarak görünür.
- Otomatik üretilen kodlar `Otomatik taslak` ve güven seviyesiyle gösterilir. Ürün etiketi, kumaş içeriği, örme/dokuma yapısı ve bebek ölçü sınıfı doğrulanmadan `verified` sayılmaz.
- Kullanıcı GTİP alanını elle değiştirirse kaynak `manual`, durum `draft` olur ve yeniden teyit gerekir.
- Teslim şekli seçilmediyse çıktıda `TEYİT EDİLECEK` yazılır.
- Çıktıda `TİCARİ FATURA DEĞİLDİR / NOT A TAX INVOICE` ibaresi bulunur.
- Karayolu gönderilerinde FOB gibi taşıma türüyle uyumsuz Incoterm seçimi ihracatçı ve nakliyeci tarafından ayrıca doğrulanmalıdır.

## Kurumsal çıktı standardı

- PDF/print görünümü Melisa Baby logosunu, tam satıcı unvanını, adresi, telefon/faks, vergi dairesi, VKN, MERSİS ve ticaret sicil numarasını gösterir.
- Kuveyt Türk Katılım Bankası TRY, USD ve EUR IBAN hesapları ile SWIFT kodu çıktıda ayrı satırlarda yer alır.
- Alıcı, proforma kimliği, geçerlilik, ürün/GTİP, Incoterm, teslim yeri, taşıma, koli, net/brüt ağırlık, menşe, tutarlar ve banka bilgileri A4 kurumsal düzende gruplanır.
- Nakliye bedeli proforma para birimiyle kullanıcı tarafından girilir; mal toplamından ayrı gösterilir ve ödenecek tutara eklenir.
- `PDF Kaydet` işlemi tarayıcının güvenli yazdırma penceresini açar. Kullanıcı `PDF olarak kaydet` hedefini seçer; önerilen dosya adı proforma numarasından üretilir.
- Referans e-Faturadaki e-Fatura ibaresi, ETTN ve QR kodu proformaya taşınmaz; proforma resmî vergi belgesi değildir.
- Banka ve satıcı bilgileri proforma şablonunun sabit kurumsal değerleridir. Vega veya Melisa ERP ticari tablolarına yazılmaz.

## Yetki

Ekran ve canlı fiş okumaları `sales.view` yetkisini kullanır. Proforma hazırlamak Vega veya Melisa ERP ticari tablolarına yazma yetkisi vermez.

## Otomatik GTİP taslak kuralları

Kurallar `apps/api/src/services/productCustomsClassifier.js` içinde merkezi ve test edilebilir tutulur:

- `velsoft`, `polar`, `polyester`, `sentetik`, `akrilik` veya eşdeğer açık işaret: sentetik bebek giyim taslağı,
- `battaniye`: malzeme işaretine göre pamuklu veya sentetik battaniye taslağı,
- `keten/linen`: diğer dokumaya elverişli maddelerden dokuma bebek giyim taslağı,
- `triko/knit/hırka/cardigan`: pamuk varsayımlı örme bebek giyim taslağı,
- `dokuma/bornoz/elbise/dress`: pamuk varsayımlı dokuma bebek giyim taslağı,
- açık işaret bulunmayan diğer ürün: karar defterindeki pamuk varsayımıyla düşük güvenli örme bebek giyim taslağı.

Bu kurallar resmî gümrük sınıflandırması değildir. Nihai ticari fatura ve beyan öncesinde ürün etiketi/teknik föy ve yetkili gümrük müşaviri kontrolü gerekir.
