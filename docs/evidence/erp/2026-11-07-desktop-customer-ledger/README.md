# ERP-C05 / ERP09 — müşteri hesabı ekstresi

Müşteri kartında seçilen hesabın hareketleri belge tutarı, hesaba ait tutar ve işaretli bakiye etkisiyle ayrı gösterilir. Satış ve iptal satırları fişe bağlanır; güncel hesap bakiyesi ayrı tutulur. Farklı dövizler toplanmaz ve sayfalı geçmişten hareketli bakiye uydurulmaz. Hesaba bağlanmamış eski müşteri hareketleri varsa bu durum görünür; kayıtlar tahminle bir hesaba bağlanmaz.

Okuma yalnız açık V5 profilinde, normal oturumda hem customer.view hem sales.view ile mümkündür. Güncel rol kontrolü ve tüm sorgular aynı SERIALIZABLE işlemde kalır; çıkış devam eden okumanın bitmesini bekler. Hesabın bütün hareketleri, görünmeyen sayfalar dahil, müşteri/cari kimlik/döviz ve fatura bağlantısı için denetlenir. Yalnız mevcut satış geçmişi okuyucusunun dar TRY/eski çift NULL fatura istisnası korunur.

Bu Desktop şeması balance_effect decimal(18,4) NOT NULL kabul eder; değer kayıpsız sekiz haneye genişletilir. Daha farklı native balance_effect_exact/affects_balance şeması bu adaptörde kapalıdır. Ekran eksi işaretini ve sekiz haneyi korur; müşteri/hesap/sayfa/döviz değişiminde eski yanıtlar atılır. Fişe geçiş/yenileme/kapanış kaynakları temizler; bekleyen satış iptal isteğine dokunulmaz.

## Kaynak doğrulaması

84 dosyada456 çevrimdışı test PASS,0FAIL/skip. API, web, son hesap kapsamı koruması, paketleme, CI ve dar log sözlüğü için bağımsız kaynak incelemeleri tamamlandı. İlk toplu kontroldeki yeni statik tanı kodu reddi, yalnız iki tam kod eklenerek giderildi; parola/özel son ek/bilinmeyen metin gizleme testleri korunur.

Yerel yeşil build, paylaşılan esbuild'in çalışma ağacı dışındaki yolu nedeniyle mevcut offline guard tarafından durduruldu. Ardından yerel bağımlılık bağlantısını kaldırıp çevrimdışı npm kurmaya hazırlanan komut, otomatik incelemede **çalıştırılmadan** reddedildi; ayrıntılı gerekçe verilmedi. Bağlantı değişmedi, kurulum veya başka yerel dolanma denenmedi. Bu sonuçlar yerel build başarısı değildir.

Var olan GitHub temiz checkout/locked-install/çevrimdışı build akışına sabit yeşil giriş derlemesi eklendi. Dört checkout kaynak head'ine bağlıdır; resmi SHA ile sabit upload-artifact yalnız yeşil HTML/JS/CSS çıktısını bir gün saklar. Artifact indirildiğinde HTML, referans verilen tek JS ve CSS ayrı ayrı doğrulanmalıdır; if-no-files-found tek başına bütün girişleri kanıtlamaz. Korumalar, izinler, testler ve süreler gevşetilmedi. Yerel paket adayı, hosted çıktı geldikten sonra yalnız kaynak-cari kökünden ayrı dosyaya hazırlanır.

## Açık sınır

Bu kaynak değişikliği henüz gerçek SQL'de okunmadı, ekran derlenip kurulmadı ve kullanıcı kabulü yapılmadı. Yeni şema/SQL hakkı veya cari/stok yazması yoktur. İlk gerçek okuma ve normal ekran kabulünde aynı V5 kimliği, seçili hesap/para, negatif iptal satırı, fiş bağlantısı ve tüm iş tablolarının değişmediği bağımsız olarak doğrulanmalıdır. Bu kayıt bütün ERP'nin veya nihai boş işletme kurulumunun tamamlandığı anlamına gelmez.
