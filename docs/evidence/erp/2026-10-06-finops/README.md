# ERP-FINOPS01 — kabul kanıtı çalışma kaydı

2026-10-06, ERP-DEC-015 / Uzun Goal3. **Ödeme ve kasa bölümleri teknik olarak TEST61/source `aff60757dcb8641001ca36ac9030ab572cae8808` üzerinde hazır; tüm Goal3 açık.** Dal `codex/erp-finish-20261004`, draft PR23. Kullanıcı denemesi ayrı bekler.

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
| 3 Tedarikçi kartı | Aynı kaynak kabul→fatura→borç→ödeme/kalan/ters zinciri; fiziksel ve finansal olaylar ayrı, eski bilinmeyen bağ tahmin edilmez. | Finans bağımlılığı bekleniyor |
| 4 Stok sayımı | Personel kalıcı barkod/kod/miktar ve bilinmeyen kayıt; sistem/sayılan/fark. Tamamlama stok etkisiz; actual yetkili gerekçeli onay bir kez stok düzeltir; personel403. | Önceki bölüm bekleniyor |
| 5 Fiziksel alış iadesi | Ayrı kaynak belge, özgün fiyat/maliyet/kur ve kalan miktar; stok azalır, borç ters etkisi; eski fatura korunur, fatura iptali fiziksel iade sayılmaz. | Sayım bağımlılığı bekleniyor |
| 6 Ana Sayfa | Gerçek günlük tahsilat/ödeme, bekleyen kabul/sayım/iade işleri; izinli sınırlı okuyucular, temiz boş durum, ayrı döviz. | Önceki bölümler bekleniyor |
| 7 Teslim | Gerçek üç genişlik, rol/negatif/native SQL/yanıt kaybı, önce-sonra hız, bağımsız inceleme, yeni immutable TEST paket/launcher, exact source/hash ve PR23 CI/secret scan, status/tree/UA. | Önceki bölümler bekleniyor |

Her yeni yazmada aktör+UUID+tam gövde kalıcı replay; farklı gövde409, çift tıklama/paralel replay ek etki0; sunucu sonrası yanıt kaybı ve refresh aynı sonucu bulur. Gerçek korunmuş kart/karantina/0-negatif miktar/borç üstü ödeme/yanlış döviz native sonuçları kaydedilir. Rol15 finans/maliyet/kâr/stok onayı görmez,16 mevcut gerçek yetkilerinden fazlasını almaz. Yetki güncel SQL ile doğrulanır; eski token veya admin görünümü bypass değildir.

Katalog16.622,3830CONFIRMED,67belirsiz ve hold korunur; 30Eylül kaynak snapshotı güncel Vega delta değildir. Kaynak fotoğraflar, CRM/LIVE/Vega/main merge/gerçek ödeme/mesaj/terminal/rapor/ayar kapsam dışı. Ek müşteri iadesi ancak zorunlu teslim paketli/testli/GitHub'da tamamlandıktan sonra değerlendirilir; güvenli mevcut temel yoksa yarım akış açılmaz.
