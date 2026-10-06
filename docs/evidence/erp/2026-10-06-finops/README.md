# ERP-FINOPS01 — kabul kanıtı çalışma kaydı

## Kalıcı sayım normal yüz bağlantısı — TEST64

- TEST63/source `5e647c912fb8cc7397cf0191308ee836bb6a908e` kalıcı iki ürünlü sayım model/API'sini içerir. TEST64/source `100a5286f943baee4f4699229e1bd101452d7dff` bunu normal `ornek-akis.html#count` canlı moduna bağlar. Sadece bu sayfa için tam allowlist `/api/test-daily/count` GET ve `draft|approve|reject|cancel` POST kullanılır; mevcut normal API oturumu ve rol kontrolleri yürür. Sayım görünümünde TEST istatistik bandı yoktur. Otomatik TEST ADMIN'e geçiş bu akışta kapalıdır.
- Kullanıcı parola bilmediğini söyledi ve açık erişim tercihi olarak **yalnız yerel demo** seçti. Bu nedenle gerçek kullanıcı oturumu veya SQL sayım yazması yapılmadı. TEST64'te gerçek tarayıcıyla `http://127.0.0.1:5194/ornek-akis.html#count` açıldığında “ÖRNEK MOD — Bu kayıtlar TEST veritabanına yazılmaz” uyarısı ve yerel sayım/fark inceleme listesi görüldü; örnek ürün ve adetler localStorage demosudur. [Tarayıcı gözlem kaydı](count-screen.json). ERP-UA15 hâlâ bekliyor; bu UI gözlemi ortak TEST kabulü değildir.
- TEST64 runtime source/package/DB/isolasyon, LIVE sahipleri ve geri dönüş kaydı: [runtime-switch-finops-64.json](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-64.json). API4144/native4146/web5194 yeni source `100a5286f943baee4f4699229e1bd101452d7dff`; database `MELISA_ERP_SIRKET_TEST_20260929_01`; sysadmin/control/LIVE=0, external=false, business writes=0; native loopback-only; önceki paket63 korundu.
- Kaynak kontrolleri: `apps/sites-workflow` 575/575 test ve production build PASS; count model + route policy 14/14 PASS; PR23 exact head `100a5286f943baee4f4699229e1bd101452d7dff` CI/secret-scan SUCCESS. Kaynak checkout'unda `testDailyAdminAccess.test.mjs` `sqlserver.node` native binding'i bulunmadığından çalışmadı; TEST64 switch gerçek API/native sağlık ve TEST kimliğini doğruladı.

2026-10-06, ERP-DEC-015 / Uzun Goal3. **Ödeme/kasa/tedarikçi zinciri TEST62, kalıcı sayım modeli TEST63 ve normal sayım ekranı bağlantısı TEST64/source `100a5286f943baee4f4699229e1bd101452d7dff` üzerinde teknik hazırdır.** Dal `codex/erp-finish-20261004`, draft PR23. ERP-UA13–17 insan kabulü bekler. Kullanıcı yalnız yerel demo yolunu seçti; gerçek SQL sayım kabulü yapılmadı. Sonraki geliştirme bölümü fiziksel alış iadesidir.

## Tedarikçi kartı: kabul/fatura/ödeme zinciri

- TEST62'nin [runtime geçiş kaydı](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-62.json) aynı TEST DB, API4144/web5194 LAN+loopback ve native4146 loopback-only kimliğini doğrular; LIVE port sahipleri/özel ayarlar değişmedi ve iş yazması yapılmadı.
- Normal [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers) ekranında iki ayrı kaynağın karışmadığı doğrulandı: fiziksel mal kabul kartı supplier13370, finans denemesi supplier23381. İkincisinde receipt39 → invoice `TDAY-FINOPS-20261006` → belge/cari 300TRY → ödenen0/iade0/kalan300TRY; OD-48065/66 ödemeleri ve ODI-48067/68 ters kayıtları hesap, tarih ve aktif/ters durumu ile gösterilir. Kaynakta timestamp bulunmayan hareketlere saat eklenmedi.
- Ekran kanıtı [supplier-card-screen.json](supplier-card-screen.json) tarayıcı AX gözlemindeki kullanıcıya görünen başlıkları ve değerleri, paket kaynağını ve normal URL'yi kaydeder. Ayrı fiziksel kabul/fatura bölümü eski kayıtlarda bilinmeyen kabul bağlarını tahmin etmeden göstermeyi sürdürür.
- `sites-workflow` tam testleri 575/575; yeni tedarikçi zinciri hedefli testi 12/12; Vite uygulama build'i ve PR23 CI/secret scan başarılı. ERP-UA13 insan kabulü pending; bu ajan ekran denemesi kullanıcı PASS'i değildir.

## Güncel TEST ekranı: ödeme ve kasa hareketleri

- [TEST61 paket geçişi](C:/Sirket/ERP/evidence/ERP-FINOPS-20261006/runtime-switch-finops-61.json): source/manifest doğrulandı; TEST web5194/API4144 ağ ve loopback, native4146 loopback-only. TEST DB `MELISA_ERP_SIRKET_TEST_20260929_01`; LIVE port sahipleri ve özel ayar aynı kaldı; eski release korundu.
- Ödeme denemeleri için [native onay kaydı](payment-native-accepted.json) ve [ticari tabloların karşılaştırması](commercial-after.json) eklendi. Dar sentetik tedarikçi için 100 TRY kısmi, 200 TRY kalan ödeme ve iki ayrı iptal/ters kayıt UI'den yapıldı; son borç300/kasa1000, ürün stoğu5 (tek önceki kaynak mal hareketi) olarak korundu. Kimlik/UUID ve yanıt sonuçları native journal'da eşleşti.
- Normal [Tahsilat ve kasa hareketleri](http://127.0.0.1:5194/ornek-akis.html#collections) ekranı TEST61'de tarayıcıda açıldı. TRY/USD/EUR ayrı özetler, müşteri girişleri, tedarikçi çıkışları ve her iki tarafın ters kayıtları görünür. Banka tipi hesaplar listelenebilir, ancak hiçbir açılış bakiyesi/gerçek banka entegrasyonu ileri sürülmez. Görüntülenen özet yalnız listelenen sentetik/TEST kapsamının hareket toplamıdır.
- Paket61'de aynı LAN/actor16/50 satır/3 örnek koşulunda [ölçümler](after-61.json): first50 500ms, sonraki50 402ms, kod araması436ms, barkod araması266ms, kart140ms, Ana Sayfa78ms medyan. Önceki TEST58 medyanlarıyla karşılaştırma: sırasıyla677→500, 556→402, 605→436, 329→266, 180→140, 180→78ms. Katalog için ticari yazma yapılmadı.
- Hedefli TEST ödeme UI/API zinciri, ödeme lifecycle, normal collection workflow ve ayrı TRY/USD/EUR mapping doğrulandı; tüm proje/hosted CI durumu PR23 [checks](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23/checks) üzerinden son head için ayrıca izlenir. ERP-UA13/14 insan kabulü bekler; ajan tarayıcı kanıtı PASS değildir.

## Başlangıç kanıtı

- [Gerçek runtime kimliği](runtime-before-58.json): API4144 ERP, native4146 yalnız loopback, TEST DB/LIVE erişimi0/externalfalse; LIVE port sahipleri karşılaştırma için kaydedildi.
- [Korunan önceki zincirlerin native durumu](native-before.json): inbound stok30/3, tedarikçi−100TRY; gece stok17/18, müşteri borcu100TRY/kasa300TRY. Eski kayıtlara yeni borç veya açılış uydurulmaz.
- [Aynı koşulda TEST58 hızları](before-58.json): LAN HTTP, actor16,50satır,3örnek. first50 1423/574/677ms, next50 556/522/556, code596/605/773, barkod326/329/366, kart167/180/186, HOME206/180/167. İlk örnek ve sonraki örnekler birlikte korunur; geçmiş en iyi değer yeni baseline gibi kullanılmaz. Ticari yazma0.

## Ödeme kapsamı kurulum provası

- [SQL dış işlem doğrulaması](fixture-validate.json): TEST58 health kimliği ve ayrı sysadmin operatör transaction'ı içinde kaynak SQL başarıyla kuruldu ve tüm native/module/scope/rol/izin korumaları karşılaştırıldı. Sonuç **ROLLBACK**; kalıcı fixture tablo/procedure/rol/işlem kaydı oluşmadı. SQL Server identity sayaçlarında boşluk kalması beklenir ve ID reset uygulanmadı. Deneme kimlikleri yalnız bu geri alınmış çalıştırmaya aittir; yeniden kurulumda tekrar ayrılır.
- SQL kaynak SHA-256 `F428678D9C35BE17D2BC6836081016D97A30795ED23FFE99A8B21216311B6197`. Uygulamadan önceki bağımsız review P0/P1 vermedi. Bu prova normal çalışma API'sinin yeni ödeme endpoint'ine bağlandığını veya gerçek ödeme zincirini kanıtlamaz. TEST runtime58/source93365d0 değişmedi.
- API, sites workflow ve canonical fixture offline kontrolleri sırasıyla 434/572/122 test PASS; quality syntax PASS. Bu hosted-GitHub CI veya insan kabulü değildir.

## Zorunlu sıra ve tamamlanma kanıtı

| Bölüm | Gerçek sonucu kanıtlayacak kabul | Durum |
| --- | --- | --- |
| 1 Tedarikçi ödeme | Kaynak kabul/fatura pozitif borç → kısmi ödeme → kalan → tam ödeme → ters kayıt; her aşamada SQL borç/kasa doğrulanır, stok değişmez. TRY/USD/EUR ayrı; fazla ödeme, yanlış döviz ve bilinmeyen kur uygulanmaz. | Teknik hazır TEST61; ERP-UA13 insan kabulü bekliyor |
| 2 Finans/kasa | Müşteri tahsilat girişi ve tedarikçi ödeme çıkışı; tarih/party/döviz/tutar/yön/belge/aktif-ters durumu ve döviz ayrı toplamları. Doğrulanmamış ticari açılış/gerçek banka bağlantısı uydurulmaz. | Teknik hazır TEST61; ERP-UA14 insan kabulü bekliyor |
| 3 Tedarikçi kartı | Aynı kaynak kabul→fatura→borç→ödeme/kalan/ters zinciri; fiziksel ve finansal olaylar ayrı, eski bilinmeyen bağ tahmin edilmez. | Teknik hazır TEST62; ERP-UA13 insan kabulü bekliyor |
| 4 Stok sayımı | Personel kalıcı barkod/kod/miktar ve bilinmeyen kayıt; sistem/sayılan/fark. Tamamlama stok etkisiz; actual yetkili gerekçeli onay bir kez stok düzeltir; personel403. | TEST63/64 model/API ve normal ekran bağlantısı teknik hazır; ERP-UA15 gerçek TEST hesabı kabulü bekliyor; kullanıcı yalnız yerel demo seçti |
| 5 Fiziksel alış iadesi | Ayrı kaynak belge, özgün fiyat/maliyet/kur ve kalan miktar; stok azalır, borç ters etkisi; eski fatura korunur, fatura iptali fiziksel iade sayılmaz. | Sayım bağımlılığı bekleniyor |
| 6 Ana Sayfa | Gerçek günlük tahsilat/ödeme, bekleyen kabul/sayım/iade işleri; izinli sınırlı okuyucular, temiz boş durum, ayrı döviz. | Önceki bölümler bekleniyor |
| 7 Teslim | Gerçek üç genişlik, rol/negatif/native SQL/yanıt kaybı, önce-sonra hız, bağımsız inceleme, yeni immutable TEST paket/launcher, exact source/hash ve PR23 CI/secret scan, status/tree/UA. | Önceki bölümler bekleniyor |

Her yeni yazmada aktör+UUID+tam gövde kalıcı replay; farklı gövde409, çift tıklama/paralel replay ek etki0; sunucu sonrası yanıt kaybı ve refresh aynı sonucu bulur. Gerçek korunmuş kart/karantina/0-negatif miktar/borç üstü ödeme/yanlış döviz native sonuçları kaydedilir. Rol15 finans/maliyet/kâr/stok onayı görmez,16 mevcut gerçek yetkilerinden fazlasını almaz. Yetki güncel SQL ile doğrulanır; eski token veya admin görünümü bypass değildir.

Katalog16.622,3830CONFIRMED,67belirsiz ve hold korunur; 30Eylül kaynak snapshotı güncel Vega delta değildir. Kaynak fotoğraflar, CRM/LIVE/Vega/main merge/gerçek ödeme/mesaj/terminal/rapor/ayar kapsam dışı. Ek müşteri iadesi ancak zorunlu teslim paketli/testli/GitHub'da tamamlandıktan sonra değerlendirilir; güvenli mevcut temel yoksa yarım akış açılmaz.
