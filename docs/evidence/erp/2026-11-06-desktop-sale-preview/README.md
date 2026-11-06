# K05-04: TRY satış önizlemesi

Kaynak, kurulum, normal ekran ve insan kabulü ayrı tutulur. İlk kaynak tesliminde SQL/GUI sonucu henüz yoktur.

- PR54 `normalizeSalesPayload` aynen kullanılır. Bağımsız BigInt hesabı miktar3 × fiyat4, ham ara toplam ve fiş geneli yüzde4 iskonto için native/Tedious decimal4 sonucu ile karşılaştırılır. Uyuşmazlıkta önizleme reddedilir; farklı bir yuvarlama sonucu üretilmez.
- Güncel iki ürün/fiyat/stok ve müşteri seçimi aynı serializable transaction içinden gelir. SERİ, ortak seçim yordamıyla güncel faktörden ADET'e çevrilir; eski liste faktörüne güvenilmez.
- İskonto tavanı istemciden alınmaz. Aynı actor/transaction için doğrulanmış normal oturumun kilitli rolü kullanılır. Yalnız mevcut `desktop_first_sale_operator` %3; diğer roller %0. Admin/manager/owner yetkisi varsayılmaz, grant/rol değişmez. DES-06 müdür %5 ve patron onayı entegrasyonu açık kalır.
- DES-06 maliyet altı uyarısı vardır, maliyet tutarı istemciye gönderilmez. İskontolu yazma kapalıdır. Taslak kaydetmek güncel seçim fingerprinti ve exact iki satır miktar/fiyat eşleşmesini gerektirir; sıfır iskonto dahil eski toplamla kaydetme engellenir.
- Normal önizleme mevcut GET kontratını geriye uyumlu genişletir. Ek/eksik/tekrar query alanları, uydurma rol/tavan, eksik sales.create/finalize reddedilir. Bekleyen yazma kuyruğunun UUID/gövdesi değişmez.

`source-tests.txt`: 15 dosyada 57 test PASS; normal native draft/finalize, oturum lease/logout, exact iskonto sınırı, rol değişimi, seri ve stale önizleme testleri dahil. Vite üretim derlemesi PASS: `desktopWriteGreen-BVpBP4IK.js`, CSS `desktopWriteGreen-D6yoncVT.css`.

Readonly bağımsız inceleme: sıfır iskontoda miktar değiştikten sonra önizlemesiz kaydetme P2 bulundu ve giderildi; ikinci incelemede yeni somut P1/P2 yok. İnceleyen test/SQL/UI/runtime yazısı yürütmedi.

Örnekler: 2 ADET ×12 +1 ADET ×10 =34, %3 =1,02, toplam32,98 TRY. 2 SERİ ×6 ADET ×12 +1×10 =154, %3 =4,62, toplam149,38 TRY. Bu sayılar kaynak testidir; gerçek ekran/SQL doğrulaması sonradan ayrıca kaydedilecektir.

İnsan/personel kabulü BEKLİYOR. K04-03 dövizli satış, günlük şirket kuru entegrasyonu, müdür/patron onayı ve iskontolu kayıt bu teslimle kapanmaz. Eski ERP/ticari veri/yedek/Vega ve merkezi plan/Excel değiştirilmez.
