# Günlük işlere göre menü düzeni — 9 Eylül 2026

Kullanıcı tercihi: Günlük satış, alış, stok, cari ve kasa işleri önde; diğer araçlar ikinci seviyede.

Üst menü 11 başlıktan 9'a indirildi. Müşteri ve tedarikçi ekranları **Cariler**, tanım ve ayarlar **Yönetim** altında toplandı. Finans başlığı günlük giriş ekranına uygun olarak **Kasa** oldu. Satış ve Alış başlıkları fiş listelerini açıyor. Operasyon sağlığı, muhasebe kontrol, aktarım, çıktı ve FedEx Demo menü girdileri Yönetim'e taşındı. Stok değerleme Raporlar altında.

Günlük 11 giriş: Operasyon Masası, Stok Listesi, Müşteri Cari Listesi, Tedarikçi Cari Listesi, Yeni Satış Fişi, Satış Fişleri, Yeni Alış Fişi, Alış Fişleri, Tahsilat ve ödeme, Günlük Kasa, Kasa/Banka Defteri. Diğer ticari ekranlar ilgili bölümde **Diğer araçlar** altında. Yardımcı ekran açıldığında bulunduğu bölüm açık kalır. Menü araması kapalı yardımcı ekranları da bulur.

Gerçek bir risk filtresi uygulamayan ikinci müşteri listesi menü girdisi kaldırıldı. Hızlı aramadaki aynı ticari ekranı tekrar eden sonuçlar ekran kimliğiyle tekilleştirildi; müşteri ve tedarikçi ayrı arama girişleri oldu. Rol görünümünde modülün varsayılan ekranı yoksa görünümde bulunan ilk ekran açılır. Bunlar çalışma görünümü tercihleridir; sunucu izinleri değiştirilmedi.

1600 piksel altında başlıkları gizleyen eski stil geçersiz kılındı. 1200 piksel ve altında ana modüller ikinci satırda adlarıyla gösterilir; yatay kaydırma korunur.

## Doğrulama

- 54 kayıtlı ekran/rota korundu. 51 yan menü girdisi tekil hedeflere gider. Mesajlaşma menü metadata'sı önceki değerleriyle aynı; mesajlaşma işleyicileri değiştirilmedi ve çalıştırılmadı.
- 3 yeni davranış testi: tüm ticari çalışma görünümleri için geçerli giriş ekranı, yalnız ikincil ekrana izin verilen görünüm/boş görünüm, menü hedeflerinin tekilliği ve bölüm sahipliği.
- 102 API testi, 229 ticari web kontrolü ve 29 statik navigasyon kontrolü geçti. Web typecheck: 184 kök, 0 tanı. Lint ve web build geçti. Önceden var olan büyük çıktı paketi ve lucide direktif uyarıları devam ediyor.
- İzole SQL test ortamındaki gerçek tarayıcı kontrolleri: müşteri/tedarikçi aynı bölüm, yardımcı bölüm aç/kapat, ekstre araması, yardımcı ekranda bölümün açık olması, hızlı aramada tek müşteri listesi, Depo→Cariler'in tedarikçi listesini açması, günlük Stok/Satış/Alış/Kasa girişleri.
- 1440×900 ve 1024×768 görselleri incelendi; menü adları ve yardımcı bölüm erişilebilir. Ticari stok/bakiye kontrolü değişmedi. Tarayıcı JavaScript hatası yok. Ticari yazma ve mesajlaşma isteği yok; yalnız izole test oturumu açıldı.

## Sınırlar

Bu kabul menü düzeniyle sınırlıdır. Fiş tablolarının sade modda arama/reset görünürlüğü ve filtre/özet/sekme yerleşimi açık konudur; tüm ekranların responsive veya işlevsel kabulü değildir. Vega test ortamına bağlı olmadığından canlı Vega başarısı iddia edilmez. İşlevsel modüller silinmedi. FedEx ekranı ve gerçek entegrasyon eylemleri çalıştırılmadı.

Değişiklik yalnız C:/do-wt/commerce-erp-20260908 adayındadır. Çalışan ERP ve korunan kaynaklara aktarılmadı; push, PR, merge veya deploy yapılmadı. Kaynak uzlaştırması ve beş proje hedefi devam eder.
