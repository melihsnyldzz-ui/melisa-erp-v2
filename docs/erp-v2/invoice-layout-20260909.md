# Satış / alış listesi yerleşimi — 9 Eylül 2026

Sade görünümde Filtre paneli seçili olduğu halde arama ve Temizle gizleniyordu. Sabit dört satırlı yerleşim, detaylı filtre ve kolon paneli eklendiğinde tablo/özet alanlarını yanlış yerleştiriyordu. Melisa satış ve alış listelerine özel commerce-invoice-list kapsamı bu sorunları giderir; sorgu, kaynak kimliği, fiş yazma ve izin mantığı değiştirilmez.

- Liste dikey esnek yerleşim kullanır; araç çubuğu, arama, detaylı filtre, kolon paneli ve özet kendi yüksekliklerini alır. Yer yetmezse çalışma alanı kaydırılır.
- Sade modda arama ve Temizle görünür. Kullanıcı Filtre panelini kapatırsa temel ve detaylı filtre birlikte gizlenir. Detaylı Arama aç/kapat mevcut filtre değerlerini korur.
- Çalışma alanı 1000 piksel veya altındaysa önizleme tablonun altında; daha geniş alanda yanında. Tablo kendi yatay/dikey kaydırmasını korur; önizleme ve işlem düğmeleri erişilebilir kalır.
- 600 piksel veya daha dar içerikte arama alanları alt alta geçer. Eski sütun yönü ve 260/340px flex-basis birleşiminin araç çubuğunu 628px yükseltmesi giderildi.
- Sabit yüksekliğe sahip ERP kabuğu açıkken body üzerindeki eski 1024×720 minimum kaldırıldı; küçük pencerede belge kaydırmasının menüyü ekran dışına sürüklemesi önlendi. Bu ortak kabuk stilidir; diğer ekranların tümü için responsive kabul anlamına gelmez.
- Etkin sekme değişince veya sekme çubuğu yeniden boyutlanınca sekme görünür alana kaydırılır. Kapatma kontrolü Enter/Space ile çalışır; mevcut kirli sekme uyarısı ve kapanma kararı AppShell'de kalır.

## Kabul kanıtı

İzole SQL test ortamında Melisa listeleriyle: 15 satış ve 16 alış fişi; sonuçsuz aramada 0, Temizle ile 15/16 kayıt geri geldi. Ticari kayıt oluşturulmadı/düzenlenmedi. Filtre paneli gizle/göster, detaylı filtre kapatma, kolon paneli, liste özeti, önizleme düğmelerine kaydırma ve açık sekmeler arasında geri dönüş kontrol edildi. Günlük Kasa sekmesi klavyeyle kapatıldı; kasa işlemi yapılmadı.

800×600, 1024×768, 1280×800 ve 1600×900 pencerelerde görseller incelendi. Ekran alanlarını ölçen salt okunur tarayıcı denetimi üst üste binme, genişlik taşması, tablo/önizleme çakışması ve etkin sekmenin kırpılması için kontrol yapar. Son küçük pencere denetimi dış belgenin kaymadığını da doğrular. Önceki geniş filtreli ve son dar/geniş durumlar ayrı kanıtlardır; tüm ekranlar/mobil cihazlar kabul edilmiş sayılmaz.

Tekrar çalıştırma: izole test ortamında ilgili Melisa listesi açıkken scripts/quality/invoice-layout-browser-check.js içeriğini agent-browser eval --stdin ile çalıştırın. Betik yalnız görünür DOM ölçülerini okur; iş verisi veya uygulama durumuna yazmaz. Oturum/SQL sırları kanıt dosyalarına eklenmez.

102 API testi, 229 ticari web kontrolü, 29 statik navigasyon kontrolü, lint, web typecheck (184 kök / 0 tanı) ve web build geçti. Yeni CSS için uygulamayı tekrar eden metin testi yerine gerçek tarayıcı geometrisi ve görsel kontrol kullanıldı. Büyük çıktı paketi ve lucide direktif uyarıları sürüyor.

Vega lab ortamında bağlı değil; canlı Vega kabulü iddia edilmez. Vega liste bileşenleri, API sorguları, mesajlaşma ekran/işleyicileri değiştirilmedi ve mesajlaşma çağrısı yapılmadı. Kaynak koruma doğrulandı; test servisleri kapatıldı, SQL diski korundu. Yalnız izole aday değişti; çalışan ERP'ye aktarım, push/PR/merge/deploy yok. Kaynak uzlaştırması, rapor/kasa kabulü ve beş proje hedefi devam ediyor.
