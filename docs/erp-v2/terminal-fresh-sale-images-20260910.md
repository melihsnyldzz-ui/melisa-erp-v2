# Satış fotoğrafı için güncel onay kontrolü

NewSaleScreen fotoğrafları artık taslak/cache imageUrl alanından çizmez. Ayrı useFreshSaleImages görünüm durumu, mevcut yetkili GET /terminal/products/barcode/:barcode üzerinden kaydı yeniden okur. ID, sourceId, stok kodu, barkod, aktiflik, VERIFIED durumu ve hash-bağlı URL eşleşmesi zorunludur. Hata/eksik kanıtta fotoğraf yoktur. Güncel fiyat ve diğer yanıt alanları satış taslağına yazılmaz; satış, kuyruk ve paylaşım payloadları değişmedi.

İlk açılışta, ürün kimlikleri/oturum/API değiştiğinde ve uygulama yeniden aktif olduğunda kontrol yapılır. En fazla dört eşzamanlı istek vardır; fotoğraf kontrolü auth yenilemesini tetiklemez. Arka plana geçiş fotoğrafları temizler. Başarılı veya başarısız tur tamamlandıktan 30 saniye sonra yeni tur başlar ve önceki fotoğraflar istekten önce gizlenir. Bu süre boyunca son doğrulama kullanılır; anlık sunucu iptal bildirimi değildir. Yavaş çok ürünlü bir turda ilk okunan ürünün onayı, turun kalan süresi kadar da yaşlanabilir. Bu sınır ayrıca geliştirilmelidir.

Büyütülmüş fotoğraf da geçerli görünüm haritasında bulunmadığında gizlenir. Aynı URL tekrar onaylandığında mevcut büyütme seçimi yeniden görünebilir. ProductLookup paylaşım paneli kapsam dışında kaldı; bu panelde onay tazeliği düzeltilmiş sayılmaz. Önceki ham detay zenginleştirme verisi korunur fakat satış fotoğrafı için kullanılmaz.

Doğrulama: 4 güncel kimlik testi ve 1 VM hook yaşam döngüsü testi geçti. Mevcut terminal ticaret paketi (fiyat, oturum, fiş, taslak, kuyruk, satış güvenliği) geçti. Terminal 37 kaynak kökü typecheck sıfır tanı; üç değişen ürün dosyasında ESLint sıfır hata. Android offline assembleRelease 1m6s başarılı, 293 görev/14 çalıştırıldı. Gradle deprecated özellik ve Node VM/module-type uyarıları mevcut.

Yeni paket için native kabul henüz yoktur. Önceki APK'nin native kanıtı bu pakete aktarılmaz. Kalıcı cache/iş verisi, gerçek API, mesajlaşma, production deploy veya merge işlemi yapılmadı. Yeni API kontratı eklenmedi; mevcut terminal okuması yalnız görünüm için tekrar kullanıldı. Genel hedef IN_PROGRESS.
