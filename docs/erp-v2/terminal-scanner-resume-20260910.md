# Barkod odağı ve uygulamaya dönüş

NewSaleScreen yalnız barkod modunda useScannerResumeFocus kullanır. Uygulama arka plana geçerken gerçekten odaklı olan barkod alanı bırakılır; geri dönüşte 150ms sonra showSoftInputOnFocus=false politikasıyla yeniden odaklanır. Başka alan odaklıysa veya stok kodu modundaysa bu davranış uygulanmaz. Bekleyen odak işlemi ekran kapanınca iptal edilir. Ortak KeyboardSafeTextInput bileşeni ve satış/gönderim kodu değişmedi.

İlk doğrudan TextInput denemesi emülatörde başarısız oldu: dönüşte Android mInputShown=true. Bu deneme geri alındı. Son odak yaşam döngüsü düzeltmesiyle emülatörde mInputShown=false, mIsInputViewShown=false ve barkod focused=true doğrulandı. Dönüş sonrası 8690000000001 + Enter girişi TEST-001 ürününü getirdi. Stok kodu modunda mInputShown=true ve stok kodu alanı focused=true: elle yazma akışı korunur. Gerçek lazer okuyucu değil, ADB tuş girişi kullanıldı.

2 VM yaşam döngüsü testi ve mevcut terminal ticaret paketi geçti. Terminal38 kaynak kökü typecheck sıfır tanı; değişen ürün dosyaları ESLint temiz. İlk son-aday packageRelease denemesi44sn'de hatalandı; ayrıntılı stacktrace yeniden denemesi1m5sn'de geçti (293 görev/18 çalıştırıldı). Kesin ilk hata nedeni doğrulanmadı; kaynak veya build cache silinmedi.

APK 61.188.326 bayt; SHA256 8b19349bdcbe85ad7602597f5ed69f52edba676f176fc855861f236a57f9b9da. Install-r başarı; cihazdan geri alınan APK hash'i aynı. Başlangıç/son bekleyen1, hatalı1, gönderilen0, cache2ürün/1cari. Yeni fiş/satır oluşturulmadı. Fixture ve Commerce_20260908 emülatörü kapatıldı, AVD verileri korundu. Gerçek veri veya mesajlaşma çağrısı yok; deployment/merge yapılmadı.

Sınırlar: Android37.1 test AVD ve ADB klavye girdisi; gerçek terminal/başka Android sürümü kabulü değildir. Fotoğraf kontrolünde yavaş toplu yanıtların yaş sınırı ayrı açık iştir. Genel hedef IN_PROGRESS.
