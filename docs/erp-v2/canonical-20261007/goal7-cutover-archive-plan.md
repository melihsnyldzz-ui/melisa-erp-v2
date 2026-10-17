# Goal7 — T0/T1 ve Vega arşiv prosedürü

**ERP-DEC-025 sonrası güncel ortak prosedür:** [Final stok/fiyat/cari T0/T1 cutover](final-cutover-procedure.md). Aşağıdaki Goal7 kaydı tarihsel dayanak olarak korunur. Önceden uygulanmış kaynak etkileri T1'de ikinci kez yazılmaz; güncel prosedür son kabul edilmiş sürüme göre kalan farkı ve yazmasız hazırlık/gerçek çalıştırıcı ayrımını kesinleştirir.

7 Ekim 2026. Karar: ERP-DEC-020. **Bu belge uygulanacak prosedürdür; gerçek cutover veya Vega yetki değişikliği yapılmadı.** Güncel T0, SELECT-only ve projeksiyon başına iki geçişli okumadır. Ortak atomik snapshot değildir; açılış kabulü veya gerçek T1 yerine geçmez.

## Kesimden önce hazırlanacaklar

| Sorumlu / teslim | Zorunlu kanıt |
| --- | --- |
| İşletme sahibi | Private müşteri/tedarikçi/ürün/barkod/birim/özel kart/döviz kararları; çözülmeyenleri ticari kapsamdan ayıran açık kabul. |
| Vega işletmecisi ve ağ yöneticisi | Vega masaüstü, servis, zamanlanmış görev, muhasebe entegrasyonu, dış aktarım, mağaza/şube ve mobil/offline terminallerin gerçek writer envanteri. Mevcut envanter henüz doğrulanmadı. |
| ERP işletmecisi | Hedef SQL server/DB, kaynak/paket hash, roller, guard ve kaynak sahipliği; aynı source key için tek ticari hedef. |
| Yedek sorumlusu | Kesimden hemen önce COPY_ONLY/CHECKSUM backup, dosya SHA256/backup set kimliği ve ayrı restore DB'de başarılı gerçek geri yükleme/okuma. Aktif TEST veya LIVE üzerine restore yapılmaz. |
| Bağımsız reviewer | TRY/USD/EUR ayrı hesaplar, işaret/rate kanıtı, stok/source base + yerel Melisa etkileri, fiyat/birim/barkod/cost provenance. |

## Gerçek geçiş günü sırası

1. **T0 hazırlık kaydı:** Kaynak kimliği, as-of zamanı, per-projection SQL/hash, içerik hash ve manifest; farklı tablo zamanlarını açıkça belirt. Bu Goal7 T0'ının gelecekteki kesim günü T0'ı olduğu iddia edilmez.
2. **Writer envanterini kapat:** Her Vega writer'ın sahibi kesim saatini onaylar. Bekleyen işler, entegrasyon kuyrukları ve offline terminal senkronları belirlenir. Gecikmiş terminalin T1 sonrasında Vega'ya yazmasına izin verilmez; fiziksel senkron kuyruğu kontrolü gerekir.
3. **İşletme yazım kesimini ilan eder:** Satış, alış, mal kabul, stok, cari/muhasebe ve ödeme yazımının son zamanı kaydedilir. Cutoff yalnız ekrandaki saat veya timestamp filtresiyle kanıtlanmaz.
4. **T1 kaynak kesimi:** Tercihen ortak tutarlı snapshot/izole yedekten okuma kullanılır. Mümkün değilse tüm writer'ların durduğunun kanıtı ve tam capture öncesi/sonrası değişmezlik ölçümü gerekir. Tablo bazında iki geçiş eşitliği tek başına atomik kesim kanıtı değildir. Drift varsa apply başlamaz.
5. **T0→T1 delta:** Immutable kaynak anahtarı + canonical payload hash; NEW/CHANGED/MISSING/aktiflik, fiyat/barkod/birim/stok ve ayrı cari hesap atomları. Kaybolan kart silinmez veya başka karta otomatik eşlenmez.
6. **Planı mühürle:** Yeni run/source capture/plan hash; native before-image ve mevcut kaynak base; yerel Melisa hareketleri ayrı. Sarı/kırmızı kayıtlar dışarıda kalır. NULL maliyet bilinmeyen, negatif veya temsil edilemeyen kaynak stok bloke, tanınmayan döviz çevrilmez.
7. **Yetkili hedefe apply:** Kesin hedef kimliği ve taze backup yeniden kontrol edilir; plan drift, yetki/karantina ve kaynak sahipliği işlem başlamadan durdurur. Fiyat/sınıflandırma için mevcut RUN06 mühürleri değiştirilmez; doğrulanmış yeni immutable sürüm/okuyucu olmadan o alan uygulanmaz.
8. **Bağımsız mutabakat:** Importer staging sayımı yeterli değildir. Ayrı Vega SELECT → native SELECT ile kimlik, stok, barkod, satış/alış fiyatı, kanıtlı maliyet ve her müşteri/tedarikçi currency hesabı karşılaştırılır. Güvenli kapsamda fark0; hariç tutulanlar açık liste. Scalar stok/bakiye ile etkin native defter de mutabık olmalı.
9. **Replay:** Aynı run + aynı hash ikinci kez0 ticari yazma. Aynı run + farklı payload/hash reddedilir. Uygulanan etki kaydı tekrar okunur; yalnız run satırının varlığı replay kanıtı değildir.
10. **İşletme kabulü:** Normal ERP ekranından fiziksel stok, ayrı döviz cari kartları, satış/alış/tahsilat/ödeme ve rol davranışı işletme tarafından kabul edilir. Teknik test, CI veya bu prosedür insan PASS değildir.
11. **Melisa tek writer:** İşletme sahibi ayrı LIVE geçiş onayı verir. Sonraki yeni ticari işlem yalnız Melisa'ya yazılır. Vega–Melisa dual-write kurulmaz. Geç kalan kaynak işlem keşfedilirse otomatik iki sisteme yazmak yerine ayrı düzeltme kararı alınır.

## Geri dönüş sınırı

- TEST provasındaki committed rollback, uygulanmış migration etkisini tersleyen yeni telafi hareketidir. Eski scaların geri yazılması veya aktif DB restore, daha sonra oluşan Melisa hareketlerini ezeceğinden kabul değildir.
- Her etki immutable before-image, signed delta, source key/hash ve oluşan hareket kimliğini taşır. Telafi ikinci kez uygulanmaz; yeni yerel hareketler korunarak native defter ve scalar tekrar karşılaştırılır.
- Yeni master/fiyat/barkod/döviz hesabı alanları ayrı geri dönüş sözleşmesi gerektirir. Stock-only prova bunların rollback kabulü sayılamaz.
- Gerçek LIVE kesimden sonra yeni Melisa işlemleri oluştuysa geri dönüş ayrı işletme kararıdır. Otomatik Vega writer açma, aktif LIVE restore veya yeni işlemleri silme yoktur.

## Vega READ ONLY arşivine geçiş planı

**Şu anda Vega'nın gerçek kullanıcı/rol/yetkileri değişmedi.** Gelecek LIVE kabulünden sonra:

1. Writer/entegrasyon/offline terminal envanteri ve son senkron kesim kanıtı muhafaza edilir.
2. Tam kaynak backup ve restore provası; kaynak DB kimliği, dosya hash ve tarih manifesti arşive eklenir.
3. Eski uygulamanın belge görüntüleme yeteneği salt okunur bağlantıyla prova edilir. Yazmaya bağlı rapor veya bakım işleri ayrı incelenir; tablo write gereksinimi gizlenmez.
4. Ağ/SQL işletmecisi writer hesaplarını kapatma ve arşiv okuma hesaplarını en az yetkiyle açma planını hazırlar. Gerçek revocation veya `ALTER DATABASE READ_ONLY` ancak ayrı işletme/ağ onayı ve bağımlılık testiyle yapılır.
5. Arşiv erişimi yalnız eski belge/görüntüleme/araştırma içindir. Yeni satış, alış, cari, stok veya muhasebe işlemi Melisa'da yapılır.
6. Arşiv ve Melisa yedek/erişim/retention sorumluları kaydedilir. Credential, ham kişi listesi ve bakiyeler public GitHub'a çıkmaz.

## Tarihsel raporlama kaynağı

Eski resmi Vega faturaları toplu olarak Melisa günlük ticari defterine alınmaz. İleride dönem/marka/tür analizi için ayrı SELECT-only rapor adaptörü planlanır:

- Kaynak kimliği ve dönem tabloları açık allowlist; iptal/iade/iskonto/net tutar ve transaction currency kanıtı. TRY/USD/EUR birleştirilmez.
- Ürün bağlantısı exact source IND veya kanıtlanmış tekil kaynak bağıyla kurulur; tarihsel stok kodu veya marka değişikliğinde bugünkü KOD1/KOD4 geçmişe otomatik taşınmaz.
- Bağ doğrulanmamışsa “Sınıflandırma doğrulanmadı”; kaydı bugünkü ürüne tahminle bağlama yoktur.
- Cache/snapshot erişim kontrollüdür; rapor API'si stok/cari/native ticari kayıt oluşturmaz. Ham müşteri/tedarikçi veya fiyat/cost verisi public katalog ya da GitHub'a konmaz.
- Rapor sonucun kaynak/as-of ve eksik kapsamı görünür olur. Ayrı kullanıcı talimatı gelmeden adaptör kurulmaz.
