# ERP + CRM kısa eğitim hazırlığı — ERP-CRM-LEARN01

10 Ekim 2026. Karar ERP-DEC-042 / CRM-DEC-010; insan kabulü ERP-UA31 / CRM-UA09 **bekliyor**. Genel finish **49 / 9 yeşil / 39 sarı / 1 kırmızı** değişmedi.

Normal yeşil ERP ekranlarının başlıkları, ana düğmeleri ve açıklamaları sadeleştirildi; görev devri personel → İlker'in mevcut yetkisiyle kontrol/onay → muhasebenin belge/tutar/döviz kontrolü olarak anlatıldı. Muhasebeye yeni işlem yetkisi verilmedi. CRM katalog/mesaj taslağı/sipariş ayrımı korundu. Sekiz statik ders: mal kabul, satış, alış faturası, tahsilat, tedarikçi ödemesi, iade, stok sayımı ve CRM siparişi. `/kullanim-egitimi.html` saf yerel ders ilerlemesi kullanır; API/SQL, aktör veya ticari oturum yaratmaz. PR27 f5ca38b'nin yalnız saf kısa-adım/soru yaklaşımı yeniden kullanıldı; session/controller/SQLite/rol birleşimi taşınmadı ve PR27 değiştirilmedi.

| Kontrol | Güncel sonuç |
| --- | --- |
| ERP kaynak / paket | b5a8ce1 / CANONICAL-LEARN-TEST-20261010-b5a8ce1; tam build PASS |
| Web / veritabanı | 5234 / DB02 etkin |
| API/native | 4184 / 4186; a51b117 korunur |
| Eğitim ve görev devri testleri | Ana ajanın 10 eğitim + 2 görev devri kontrolü PASS; toplam 12. Örtüşen diğer hedefli sonuçlar eklenmedi |
| Bağımsız kaynak incelemesi | AST incelemesi handler, rol/yetki, hesaplama veya API değişikliği bulmadı |
| Paket/görsel hash kontrolü | 1.713 dosya PASS; sekiz gerçek ekranın kırpılmış PNG'si dahildir. Ham görseller repo dışında |
| Gerçek tarayıcı | Sekiz dersin görselleri yüklendi; 1.422 piksel genişlikte yatay taşma yok. Yanlış cevap ilerlemeyi engelledi; doğru cevap yalnız ders ilerlemesini tamamladı |
| Fiziksel TC21 | Wi-Fi üzerinden LAN 5234 mal kabul yeni başlıkları ve kullanılabilir eğitim ekranı görüldü |
| CRM kaynak / ortak hedef | 222a95f9a63763c39cb18630373a1f27a55c6f65 / 62700 / DB02; bu görevin 944535 sunum değişiklikleri içindedir. Eşzamanlı yeni sürüm korundu; 50 ürün ve 3.830 görsel kapsamı gerçek ekranda görüldü |
| CRM paket manifesti | 53f5260aef322024da42f29dce4d6766a58ed191c9a1ad8494bbcd947f2daa0e |
| TEST125 | edb3c891 kaynağı ve aynı süreç kimlikleri korundu |
| Ticari/finans etkisi | Yeni işlem yapılmadı. Auth/audit dışındaki 169 iş tablosunun SQL önce/sonra satır sayısı ve checksum karşılaştırmasında 0 fark; byte hash eşitliği iddiası değildir |
| PR23 / CI | Yeni head CI sonucu push sonrası doğrulama bekliyor; CI PASS yok |
| İnsan kabulü | ERP-UA31 ve CRM-UA09 bekliyor |

Ham ekranlar, cihaz görüntüleri, kısa eğitim videosu, görsel manifest ve veri karşılaştırmaları repo dışı özel kanıtta kalır: `ERP-LEARN01-20261010`. Bu kayıt yalnız anonim teslim özeti içerir. Dersler finans tutarını veya gerçek açılışı onaylamaz; önceki işletme/kişi/kasa kararları ve geniş dövizli günlük kullanımın kabulü açık kalır. Ürün fotoğrafları ve ticari ekranlar GitHub'a yüklenmez.

[Kısa eğitim](http://127.0.0.1:5234/kullanim-egitimi.html) için [ERP-UA31 insan incelemesi](../../../../USER_ACCEPTANCE.md) bekliyor. Ders ilerlemesi, quiz, otomatik ekran kontrolü, fiziksel cihazın teknik ekran kontrolü veya build insan PASS değildir.

Son gerçek ekran kontrolü: güncel CRM222a95f kataloğunda 50 / 3.830 kapsamı ve sipariş penceresinin üç adımı görüldü. Bu tarayıcı sekmesinde mevcut ERP hesabıyla giriş gerekiyor; yeni taslak kaydedilmedi, kimlik/parola tahmin edilmedi. Giriş sonrası insan kullanımı bekler. TC21 rehberinin Sonraki düğmesi adım1→2 olarak çalıştı; fiziksel cihazın bu teknik sonucu barkod/personel/insan PASS değildir. Özel alanda 40 saniyelik görünüm ve 20 saniyelik adım ilerletme videosu bulunur.
