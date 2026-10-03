# Birleşik ana ekran teması

Ana dalın beyaz araç çubuğu, eski beyaz metin kurallarıyla birleşince başlık ve düğmeler okunmuyordu. Mobilde masaüstü flex-basis değerleri araç çubuğunu yaklaşık600px uzatıyor, sol menü390px ekranda içeriği daraltıyordu.

commerce-dashboard.css aktif dashboard ile sınırlıdır. Koyu metin ve açık düğmeler, mobilde otomatik yükseklik ve iki sütun kartlar uygulanır. AppShell aktif ekran kimliğini data-active-screen ile bildirir; yalnız dashboard700pxaltında tek Operasyon Masası öğesini tekrar eden yan menü gizlenir. Üst modül menüsü korunur; diğer ekranlara bu gizleme uygulanmaz.

Gerçek AppShell/Dashboard ve main.jsxstil sırası, sentetik boş ticari özetle tarayıcıda çalıştırıldı.1440/1024/390px için belge genişliği aynı; araç çubuğu100/140/174.94px; başlık rgb(23,36,58).1440ve390görüntüler görsel incelendi. Tarayıcı JS hatası yok. API çağrıları yalnız dashboard summary/alerts GET; gerçekSQL ve messaging isteği yok. Testfixture veVite/browserkapalı.

Web ticari paketPASS, type187kök/0hata, değişenJSXlintPASS, buildPASS4.51sn. Bu ekranın görsel kabulüdür; tüm ERP modülleri mobil kabulü değildir.

Açık bulgu: boş özet verisinde bazı ticari sayaçlar ve kâr oranı0gösteriyor. SmartInsightsPanel içinde stok durumu hakkında veriye dayanmayan sabit metinler de var. Bu doğruluk konusu ayrıca giderilmeli; görsel kabul ile kapanmış sayılmaz. WhatsApp göstergeleri değiştirilmedi/testedilmedi.
