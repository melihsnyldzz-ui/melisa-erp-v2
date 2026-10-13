# ERP09 / OPS01 — değişmeyen kaynak profilinin tekrar hesabı

13 Ekim 2026. Ortak sıra **1**, ana ID **ERP09**; yalnız performans alt teslimi. Genel ERP09/OPS01, insan kabulü ve bütün teslim kapanmadı.

## Değişiklik ve sınır

Uygulama source `2bf27620b1884742b509328969b90bca90c2972c`: seçili satış için kayıtlı, derin dondurulmuş düz veri profilinin canonical hash değeri yalnız aynı nesne kimliğiyle tekrar kullanılır. Kayıt yetkisi her çağrıda doğrulanır. Değişebilir iç değeri olan Date gibi yapılar eski önbelleksiz yoldan hesaplanır. Güncel SQL/stok/fiyat/bakiye/hold/rol kontrolü veya owner READY sonucu önbelleğe alınmaz. Kaynak seçimi ve fiyat/kullanıcı kapsamı aynı kalır.

İki API kaynak/test dosyası; startup225 ve CSS9 dosyası aynı. 10 hedefli offline test, bağımsız High GO, build ve commit secret scan temiz. Offline gerçek profilin dört seçimlik CPU alt hesabı ortancası tek üründe109,97→0,76ms;200üründe167,35→62,45ms. Çıktılar exact aynı. Bu ölçümler toplam ekran hızı değildir.

## Çalışan TEST ve gerçek ölçüm

Paket `CANONICAL-COMPLETE-TEST-20261011-2bf2762`,1880dosya; manifest SHA256 `f31caf92b91400caf1f4a40997223fd480900a0317a832ff7fb7a05dc1a3559a`. Web5234/API4184/native4186; DB02/copye16b70f0,actualT1=false. Altı exact süreç, dört health, CRM heartbeat doğrulandı; TEST125 edb3 aynı. CRM09ca/native60e korunur; CRM sahibinin bağımsız devam yetkisi ERP-DEC-054 ile açık, ortak runtime tek koordinatördedir.

Normal aktör15, dört mevcut GET×üç ölçüm; önce c3a84d0, sonra2bf2762. Her ölçümde payload SHA ve meta birebir aynı;12/12 HTTP200, kendi oturum çıkışı doğrulandı. Yeni ticari/SQL yazma0.

| Okuma | Önce ortanca | Sonra ortanca | Sonra aralık |
| --- | ---: | ---: | ---: |
| 200satırlı fiş detayı | 11,436s | 4,179s | 3,854–11,490s |
| Fiş listesi | 5,958s | 4,763s | 4,619–5,543s |
| Koli detayı | 4,897s | 4,971s | 4,912–10,291s |
| Koli listesi | 5,557s | 4,599s | 4,192–11,155s |

Üç örnek küçük ve dalgalıdır; bütün fark bu değişikliğe atfedilmez. Owner/native SQL doğrulaması ana gecikme olmaya devam eder. Koli detayı hızlandı denmez; genel hız hedefi kapanmadı. Kabul edilmiş migration/provalar tekrarlanmadı.

Normal Chrome yeşil Satış fişleri ekranında mevcut200satırlı fiş açıldı; **Fişi yeniden oku** sonrasında aynı satır/tutar/döviz/durum ve ayrı bakiye/fiş kalanı gösterildi. Mevcut normal personel15 oturumu kullanıldı; yeni satış veya tahsilat yok. Ekran kanıtı private `receipt-screen.jpg`, tarayıcı metin kanıtı `browser-proof.json`; cihaz/insan kabulü değildir.

## Kanıt ve teslim sınırı

Özel kanıt `C:/Sirket/ERP/evidence/ERP-COMPLETE01-20261013/private/ops01-profile-hash`: before/after-read-api.json, offline-benchmark-final.json, delivery/running-proof.json, preparation/projection, activation ve stop makbuzları. Ham kayıtlar, configler ve sırlar repoya alınmaz.

Çalışan yeşil ekran: http://192.168.1.46:5234/ornek-akis.html#receipts . Kaynak push/PR#23 doğrulandı; GitHub source head üzerindeki6hosted kontrol ödeme/harcama engeli nedeniyle başlamadı. Vercel sonucu bu kontrollerin yerine geçmez. Belge teslim commit'i PR head'den ayrıca izlenir; main merge yok.

Bu alt teslim DB verisi değiştirmez. Kurulum öncesi mevcut task/config/projection görüntüleri korumalı private alanda saklandı; eski paket tutulur. Yeni DB yedeği/restore yapılmadı; eski iki restore kanıtı yeni yedek güncelliği veya ayrı cihaz kopyası kanıtı sayılmaz. Bu alt teslimde son DB yedek tarihi ve ayrı konum kopyası yeniden doğrulanmadı; final kurtarma kapsamı açık kalır.

Kalan: owner/native doğrulama gecikmesini güvenlik sınırlarını koruyarak azaltmak, genel satış/vade ve ERP04 desteklenen DB02 fiyat sürümü/yazıcısı; teknik eksik kullanıcıya parola veya genel onay engeli olarak aktarılmaz. UA26/32 ve diğer insan kabulleri bekler.
