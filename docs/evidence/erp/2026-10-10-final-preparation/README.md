# ERP + CRM son hazırlık — 10 Ekim 2026

**ERP-CRM-FINAL01: sınırlı TEST teknik hazırlığı ilerliyor; genel işletme hazırlığı koşullu, ERP-UA30 insan kabulü bekliyor.** Bu rapor [ERP-DEC-041](../../../../PROJECT_DECISIONS.md) kapsamında dört aşamanın mevcut kanıtını toplar. Önceki [genişletme kanıtı](../2026-10-10-business-expansion/README.md) korunur; kabul edilmiş aktarımlar tekrar uygulanmaz. Karar, günlük sıra, teknik durum ve insan kabulünün tek kayıt yerleri sırasıyla PROJECT_DECISIONS, DELIVERY_BOARD, STATUS ve USER_ACCEPTANCE dosyalarıdır.

Rapor, 10 Ekim tarihli özel kanıtlar ve tek DB koordinatörünün sonuç bildirimlerinden hazırlanmıştır. Ham işlem satırları, kişi adları, hesap/ürün kimlikleri, fiyatlar, bakiyeler ve bağlantı ayarları özel alandadır. [Makine özeti](summary.json) aynı sınırları taşır. Sonuçlar aşağıdaki tarih ve kapsamla sınırlıdır; sonraki teslimin PR head/CI veya gerçek kullanıcı kabulü yerine geçmez.

## 1. Günlük ERP / CRM akışları

DB02 üzerinde son gözlenen ERP kaynak öneki `656bd52`, CRM kaynak öneki `5f8` olarak koordinatör tarafından doğrulandı. Yeni ERP uygulama kaynağı `c5081be7725dac53cf887ebf6500224eac7a3e91` için paket oluşturuluyor; bu kaynak kayıtlı olsa da yeni paketin başlatıldığı veya exact-head CI'ın geçtiği bu rapor sürümünde ilan edilmez. 14 hedefli test PASS. Önceki TEST125 korunur.

Yeni günlük kapsam, kaynakla eşleşen **açıkça seçilmiş sonlu TRY alt kümesine** bağlıdır. Mevcut sentetik TEST kasası kullanılır; gerçek kasa açılışı doğrulanmış sayılmaz. TRY/USD/EUR kaynak bilgisi okunabilir olması, üç para biriminde tam günlük finans akışlarının çalıştığını kanıtlamaz.

| Akış / koruma | Bu rapordaki sonuç |
| --- | --- |
| Sayım taslağı ve onayı | Koordinatörün normal native akış denemesi teknik PASS. |
| Aynı UUID ile sayım tekrarı | Teknik PASS; ikinci stok etkisi oluşmadı. |
| Yetkisiz personel sayım işlemi | Teknik PASS; işlem reddedildi. |
| TRY mal kabul ve bağlı alış faturası | `656bd52` paketinde oluşturma / gönderme / onay / alış taslağı / finalize ve tekrar teknik PASS. |
| Satış önizlemesi | Teknik PASS; satışın kesinleştirilmesi ve kalan günlük zincir henüz bekliyor. |
| Sayım iptali | Henüz denenmedi. Gerekli dar native kural eki kurulmadı. |
| Satış finalize / tahsilat / tedarikçi ödeme / iade | Bu rapor sürümünde yeni sonlu kapsamın uçtan uca sonucu bekliyor. Önceki kabul edilmiş genişletme kanıtı ayrı korunur. |
| Normal yeşil ekran turu | Tam tur doğrulanmadı; API yanıtı tek başına ekran veya kullanıcı kabulü değildir. |

Günlük revision v05 kurulumu **10 Ekim 14:12:10 UTC** teknik PASS: 51 ticari tablo için kurulum öncesi/sonrası tam satır kanıtları aynı; önceki manifest/revision kanıtları ve diğer SQL nesneleri korunmuş. Bu kurulumun ticari yazması 0, native CHECK değişikliği 0 ve rol değişikliği yoktur. Daha sonraki yetkili sentetik işlem etkileri bu DDL korunumu sonucundan ayrı izlenir.

Satış kesinleştirmedeki mevcut native kâr/maliyet kaydı için gerekli **revision 5** ekinin rehearsal ve Apply sonucu **10 Ekim 14:58:26 UTC PASS**. Yalnız günlük guard, ready ve günlük context değişti; yeni üç append-only kanıt satırı, v4'ün eski sekiz satırını değiştirmeden eklendi. 51 ticari tablo, eski proof/journal grupları ve diğer SQL nesneleri önce/sonra aynı; ticari kurulum yazması0, native CHECK/rol değişikliği0. Satış/tahsilat/ödeme/iade ve normal ekran turunun yeni paketle gerçek sonucu bekliyor. Bu DDL PASS, günlük işlemin veya insan kabulünün PASS'i değildir.

Sayım iptali için hazırlanan bağımsız native CHECK ekinin **14:22:15 UTC** provası, tek kuralın yeniden doğrulanması sırasında SQL 547 ile durdu ve transaction geri alındı. Ek kurulmadı; eski kural veya geçmiş ticari satırlar değiştirilmedi. Mevcut kuralın oturum kimliğine bağlı dalı, kurulum sahibi altında tam satır doğrulamasını etkileyebilir; hangi satırın reddedildiği bu kanıtla belirlenmiş değildir. Bu sonuç eski kuralın güvensiz olduğunu veya tüm günlük akışların başarısız olduğunu göstermez. Kuralı zayıflatarak ilerleme yapılmadı.

## 2. Kaynak farkı ve işletme kararları

Salt okunur kaynak karşılaştırması **10 Ekim 2026 14:01:33 UTC** tarihinde alındı. Aynı kapsamın iki ardışık geçişi kararlıydı; yazıcılar dondurulmadı ve atomik snapshot alınmadı. Bu nedenle sonuç **gerçek T1 değildir**. Ürün karşılaştırma tabanı 8 Ekim, cari karşılaştırma tabanı 6 Ekim kaynak okumalarıdır; yeni sentetik TEST bakiyeleri kaynak açılışıyla karşılaştırılmaz.

| Tarihli kaynak farkı | Değişen kayıt sayısı |
| --- | ---: |
| Ürün | 233 |
| Müşteri para birimi hesabı | 22 |
| Tedarikçi para birimi hesabı | 28 |

Ürün farklarının alt nedenleri birbiriyle örtüşür; stok miktarı, kart alış fiyatı, kaynak kimliği ve birim fiyatı sayıları toplanarak yeni toplam üretilmez. Seçilen deneme kapsamının cari kaynak değişikliği de gerçek açılış için güncel T1 doğrulaması gerektirir.

Gerçek işletme kararı gerektiren açık maddeler:

- **18 UNKNOWN belge:** satış, alış veya iptal kaydının gerçek işlem kaynağı ve ilgili stok/cari etkisi belge sahibi tarafından belirlenmeli. Daha önce çözülmüş dört sentetik taslak yeniden açılmaz.
- **39 kasa/banka hesabı; gerçek açılışı hazır 0/39:** fiziksel hesap ve para birimi listesi, aynı kesim anındaki sayım/ekstre, yoldaki tahsilat/POS/devir ve belirsiz işlem kaynakları gerekli. Mevcut sentetik TEST kasası bu kanıtı sağlamaz.
- **8 kişi / hesap takma adı eşlemesi:** gerçek personel kimliği ve cihaz/işlem sahipliği kesinleştirilmeli. TEST kullanıcıları gerçek personel veya işletme sahibinin kabulü yerine geçmez.
- Stok ve cari açılışlarında kaynak, depo/birim ve açılış yetkisi eksikleri özel karar listesinde korunur. Bilinmeyen tutar veya kimlik tahminle doldurulmaz; açılışlara yazılmaz.

Önceki revision 3'ün kabul edilmiş **37 residual kanıt satırı** korunmuştur. Sonraki tarihli gözlemler aynı kanıtla birebir karşılaştırılmadan yeni sayı eski invariant yerine yazılmaz.

## 3. Tek mağaza günü TEST hazırlığı ve insan kabulü

Mevcut doğrulanmış katalog/cari kapsamı yeniden aktarılmaz. Sonlu TRY denemesi, günlük işlemlerin güvenli teknik alt kapsamını hazırlar; bütün katalog ve cari hesapların günlük kullanıma hazır olduğu anlamına gelmez. Tam dövizli günlük tur, gerçek personel eşlemesi, fiziksel Zebra ve işletme sahibinin gözle denemesi henüz bu raporla tamamlanmış sayılmaz.

**ERP-UA30 bekliyor.** [Tek mağaza günü turu](store-day-tour.md) hazırlanmıştır. Önceki ERP-UA29 / CRM-UA07 ve diğer bekleyen kabul kayıtları teknik denemeyle PASS'e çevrilmez. Satış, tahsilat, ödeme, mal kabul, sayım, iade ve kapanışın tek normal ekran turunun kalan sonuçları koordinatör raporuyla tamamlanmalıdır. Bu rapor geniş insan TEST'i için genel yeşil sonuç vermez.

## 4. Yedek, kurtarma ve final T1 hazırlığı

Yeni DB02 yedeği **10 Ekim 13:58:35 UTC** tarihinde tamamlandı: yaklaşık **9,2 GB**, COPY_ONLY / CHECKSUM, **VERIFYONLY PASS**. Aktif veritabanı üzerine yazılmadı. **Bu yeni yedek geri yüklenmedi.** VERIFYONLY, restore veya uygulama kurtarma sonucu değildir.

Önceki ayrı izole DB02 restore kanıtı ve Aşama 5 kurtarma/inverse kanıtı yeniden kullanılır. Bunlar gerçek izole restore, sonraki yerel/sentetik etkilerin korunması, CAS durdurmaları, rollback ve tekrar güvenliği kanıtlarını içerir. Yeni yedeğin restore sonucu veya bütün yeni günlük akışların geri dönüşü bu geçmiş PASS'lerden çıkarılamaz.

Gerçek final T1 için kaynak yazıcı/kuyruk sorumluluğu ve kesim anı, eşzamanlı kesin kaynak kapsamı, güncel plan/drift denetimi, yeni yedeğin ayrı restore doğrulaması ve gerçek uygulama yetkisi gerekir. Mevcut salt okunur kaynak okumaları ve TEST kurulumu bunları tamamlamaz. Vega/LIVE/gerçek T1 açılış yazması, main merge, gerçek WhatsApp, ücretli AI ve Eğitim PR27 bu çalışmada yapılmadı.

ERP PR23 / CRM PR3 kaynak teslim bağları korunur; bu rapor yeni teslimin exact-head CI sonucunu doğrulamış değildir. Son kaynak teslimi, çalışan paketler ve insan kabulü [STATUS](../../../../STATUS.md) ile [USER_ACCEPTANCE](../../../../USER_ACCEPTANCE.md) üzerinden ayrı takip edilir.
