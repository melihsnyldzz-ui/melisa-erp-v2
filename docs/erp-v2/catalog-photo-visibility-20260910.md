# Katalogda fotoğraf ve fiyat seçenekleri

PDF ayarındaki fiyat seçeneği artık “ERP fiyat satırını göster” olarak adlandırılır. Fotoğrafa basılmış bir fiyatın bu seçenekle silinemediği, fotoğraflar açık ve ERP fiyatları kapalıyken açıklanır.

Yeni “Ürün fotoğraflarını göster” seçeneği varsayılan olarak açıktır. Kapatılınca PDF belgesine görsel etiketi veya URL eklenmez; fotoğraf alanında “Fotoğraf gizlendi” yazılır. ERP fiyatı, stok ve ürün sırası bağımsız kalır. Seçenek değişikliği eski önizlemeyi geçersizleştirir. Fotoğraf dosyaları düzenlenmez; fiyat içermeyen görsel üretildiği ya da OCR ile fiyat temizlendiği iddia edilmez.

Doğrulama: 16 PDF testi PASS; dört düzen ve iki fiyat durumunda fotoğrafsız çıktı kontrolü. Web typecheck187kök/0hata, değişen dosyalar lintPASS, webbuildPASS4.84sn. Tarayıcıda seçim→fotoğrafları kapat→önizleme:1ürün/0görsel/0fiyat. Tekrar açınca eski önizleme kaldırılır.390pxgenişlik/390pxbelge, taşma yok; açıklama görünür.

Sentetik10ürünlü klasik düzen, A4/3sayfa PDF üretildi. DOM0görsel/0fiyat/10ürün/0taşma; üç sayfa Poppler ile render edilip incelendi. Stok ve kodlar korunur. Bu dosya test çıktısıdır. Üretim deploy yok; gerçek yazdırma penceresinde kaydetme kabulü ayrı kalır. Public site için fotoğrafa basılı fiyat yayın kuralı bu değişiklikle kapanmaz.
