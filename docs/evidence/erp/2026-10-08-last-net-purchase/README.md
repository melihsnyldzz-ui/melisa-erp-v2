# Belge/giriş öncelikli son net alış — ERP-MIGUNIFIED01 eki

8 Ekim 2026 / ERP-DEC-029 / [PR23 talimatı](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6057616427). Dar TEST uygulaması teknik tamamlandı; insan kabulü bekliyor. Genel migration tamamlanmadı. Bu ek sonunda durulur.

## Uygulanan sonuç

| Kaynak / durum | Ürün sayısı | Sonuç |
| --- | ---: | --- |
| Geçerli alış belgesi | 4.338 | Tarihli net birim alış dolduruldu |
| Kanıtlı ticari giriş | 0 | Net anlamı ve belge bağlantısı kanıtlanamadı; kullanılmadı |
| Yalnız mevcut kart alış | 5.076 | 5.033 tam +43 kısmi; kart tutarı korunur, net NULL |
| Bilinmeyen / manuel | 7.253 | 7.252 bilinmeyen +1 manuel korunmuş; net NULL |
| Yeni immutable metadata | 16.667 | Commit ve bulk readback eş |
| Net referansı boş kalan | 12.329 | Tahmini tutar/döviz veya ikinci iskonto yok |
| Kaynak kimliği drift nedeniyle dışarıda | 1 | Parent kapsamındaki ürün tekil atlandı |

Eski 16.668 kart metadata kaydı, parent manifest ve eski beş SQL modülü aynen korunur. Önceki üç kimlik/provenance dışlaması yeni batch'e alınmadı. Yeni kayıtların 6.089'unda korunmuş native maliyet bulunur; kimliği drift yaşayan bir ürün dahil eski 6.090 kabul kapsamı maliyeti ve bütün native ürün verisi hash-eştir. Bu maliyetlerin muhasebe kanıtı yeniden yapılmadı. Maliyet/stok/satış fiyatı/cari-finans/hold/rol yazması0. Bekleyen47 hesaplık onay paketinin18 private dosyası değişmedi.

## Kaynak ve hesap kuralı

F0102 kart/birim ile F0103 D0001–D0007 belge alanları 9 Ekim öncesi tarihlerde, SELECT-only iki geçişle toplu okundu; kaynak as-of 2026-10-08T10:39:21.010Z. Geçmiş dönem belgesi güncel alış olarak sunulmaz. Öncelik: geçerli alış belgesi → kanıtlı ticari giriş → mevcut kart → bilinmiyor.

Ürün bağı yalnız kesin tam stok kodu veya tekil tam model + tedarikçi kodu + aynı kaynak marka/birim tanığıyla kurulur. Kısa model tek başına, farklı şirketlerde aynı IND, isim benzerliği veya çelişen bağlantı net alış sağlamaz. Model-only ve çelişkili adaylar uyarı olarak korunur.

Belge sınıfı20, iptal/iade dışı durum, aynı birimde pozitif miktar, ana birim/seri çarpanı1, açık satır TL/KUR1, KDV oranı0/masraf0 ve başlık–satır toplamı–tek muhasebe yansıması tam mutabakatı birlikte zorunludur. Net satır tutarı miktara bölünür; kart iskontosu tekrar uygulanmaz. Başlıktaki USD etiketi satır TRY tutarına taşınmaz; doğrulanmamış kur dönüşümü yapılmaz. NULL vergi/masraf tutarları sıfır varsayılmaz. Exact pay/payda ve 18 basamaklı sunumun EXACT/TRUNCATED_18 ayrımı saklanır.

Aynı gün çelişen tutarlar en yüksek ID veya varsayılan saatle çözülmez.513 üründe daha yeni belirsiz aday nedeniyle eski geçerli belge seçildi; tarih ve uyarı normal kartta görünür. Toplam2.318 kaydın belirsiz/yeni aday uyarısı vardır; hepsi net alış kazanmış değildir. Alternatif kart/giriş değerleri ve seçim gerekçesi silinmez.

## Uygulama ve güvenlik kanıtı

Yeni8.704.294.912 byte COPY_ONLY/CHECKSUM yedek ve RESTORE VERIFYONLY geçti; aktif DB restore yok. SHA256: 506c529926e85ea80131ea9990cb507c2ce6084aa3ad4dbdc5c732a382fec4f7. Before-image ve kaynak/target/binding/hold/manual CAS tekrar okundu. Ayrı V2 immutable snapshot mevcut erp_migration içinde, ikinci ürün veritabanı yok.

SERIALIZABLE/applock batch sırasında56 eski veri koruma grubu eş; uygulama sonrası55 veri grubu ve yeni sekiz nesne hariç bütün eski SQL izinleri eş.316 eski SQL module hash'i, V1 metadata ve30 V1 nesne izni değişmedi. Yeni30 nesne izni ayrı exact denetlenir: üç yeni tabloda API/native SELECT/INSERT/UPDATE/DELETE DENY; API yalnız reader EXECUTE ve beş nesneye VIEW DEFINITION; native yeni reader EXECUTE yok. Genel SQL izinleri veya kullanıcı rolleri genişletilmedi.

Aynı committed manifest replay16.667 satır/ikinci metadata etkisi0. Aynı run farklı body reddedildi; üç tablo immutable UPDATE51139 negatifleri rollback ve0 değişiklikle geçti.80 hedefli test, syntax, rollback içinde beş SQL module parse ve reproducible paket build geçti. Genel Goal8 suite'i tekrar çalıştırılmadı.

## Çalışan ekran ve hız

TEST100/source cc4c4601ec0a006c2138385859e5167934829adf, CANONICAL-TEST-cc4c4601ec0a,1497 dosya. Web5194/API4144/native4146 aynı source/package; API/native Semih\MELISADEV/MELISA_ERP_SIRKET_TEST_20260929_01,sysadmin0/LIVEaccess0. TEST98 ve kurulmamış TEST99 korunur.

Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) kartındaki ayrı alış düğmesi seçilen net tutar/döviz/birim/tarih/kaynağı ve ayrı eski kart tutarı/iskontoyu gösterir. Mevcut üç izin product.view + purchase.view + finance.view korunur. Gerçek aktör16 GET200, aktör15 GET403, anonim401, query400, POST405, bilinmeyen ürün404, drift ürünü503. Normal satış/personel/müşteri katalog DTO'su maliyet veya referans içermez. Sekiz gerçek API örneği planla exact eş; eski beş örnek, belge dolan ek örnek, kısmi döviz ve manuel koruma ayrıdır. Normal tarayıcıda eski beş before/after örneği ve ek belge/iskonto örneği açıldı; belge neti, ayrı kart dövizi ve daha yeni belirsizlik uyarısı görünür doğrulandı. Ham belge/kimlik/tutarlar ve ekran görüntüleri repo dışı private kanıtta tutulur.

| Ölçüm | TEST98 önce | TEST100 sonra |
| --- | ---: | ---: |
| İlk50 | 488ms | 519ms |
| Sonraki50 | 500ms | 520ms |
| Kod | 431ms | 441ms |
| Barkod | 276ms | 271ms |
| Kart | 131ms | 146ms |
| Ayrı alış düğmesi | — | 323ms |

Üç ardışık authenticated loopback GET'in medyanı; JSON okuma dahil, ekran paint ölçümü değildir. Önce ilk soğuk katalog örneği1503ms idi; diğer iki örnek488/483ms. Liste ve ilk kart belge taraması çalıştırmaz;50 ürün ve mevcut yeşil tasarım/fotoğraf/stok/satış fiyatı korunur.

## GitHub ve kalan

Branch codex/erp-finish-20261004 / [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), uygulama750c7252a0acb76cee9cbc33bb464029965ff9b2, çalışan source cc4c4601ec0a006c2138385859e5167934829adf. İlk kaynak taramasındaki sentetik provenance yolunun false positive'i yalnız exact tarihsel fingerprint ve gerekçeli aynı satır allow ile çözüldü; tarama/genel secret kuralları kapatılmadı. Exact çalışan source için PR37765840300/push37765833918, quality-build-test/windows-startup-test/secret-scan üçer SUCCESS. Son belge commit'i PR head ve kendi CI kaydıyla ayrı teslim edilir.

ERP-UA24/ERP-UA25 bekliyor. Finish49/9🟢/39🟡/1🔴 değişmedi; D03 genel maliyet/migration kabulü 🟡. Cari47 plan, bilinmeyen kaynaklar, gerçek T1 ve geniş insan kabulü açık. Vega/LIVE/CRM/main merge/finans uygulaması yok; yeni goal başlamaz. Makine özeti [delivery-summary.json](delivery-summary.json).
