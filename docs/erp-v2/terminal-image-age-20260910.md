# Terminal satış fotoğrafı: ürün başına onay yaşı

Önceki toplu sorgu bütün ürünleri bekliyor, erken gelen yanıtları tur bittikten sonra 30 saniye daha gösteriyordu. Çok ürün veya gecikmiş yanıt bu süreyi uzatabiliyordu.

Fotoğraf şimdi kendi isteğinin başlangıcından itibaren en fazla 30 saniyelik görünüm izni alır. Süre monoton saatle hesaplanır. Geçerli yanıt bekleyen diğer ürünlerden bağımsız yayımlanır; her fotoğrafın ayrı silme zamanlayıcısı vardır. Süresi bitmiş yanıt gösterilmez ve toplu sorgunun tamamlanması eski fotoğrafı geri getirmez. Dört eşzamanlı okuma sınırı korunur. Yeni tur, önceki turun başlangıcına göre planlanır; uzun turlardan sonra en az bir saniye ara verilir.

Arka plana geçiş, ürün/oturum/API bağlamı değişimi ve bileşenin kapanması önceki turu geçersizleştirir. Satış taslağı, fiyat, miktar, kuyruk ve paylaşım paneli değişmez. Yeni sunucu kontratı veya ticari yazma yoktur.

Doğrulama: beş salt görsel okuma testi, iki görünüm yaşam döngüsü testi ve mesajlaşma yollarını dışlayan terminal regresyon paketi PASS. Yavaş turda erken onayın silinmesi, geç yanıtın reddi, ilerlemeli sonuç ve eski turun iptali kapsanır. Typecheck 38 kaynak kökü/0 hata; değişen dosyalarda lint PASS.

Sınır: Bu süre sunucudaki onayın anlık iptal bildirimi değildir. JavaScript zamanlayıcıları çalıştırılabildiğinde görüntü kaldırılır; donmuş uygulama için gerçek zaman garantisi verilmez. Yeni paketin emülatörde yavaş tur kabulü ayrı yapılmalıdır. Gerçek ERP/PB veya üretim kurulumu bu testlerin parçası değildir.

Son kaynakla çevrimdışı Android assembleRelease: PASS (40 saniye). APK bu aşamada kurulmadı; native kabul açık.
