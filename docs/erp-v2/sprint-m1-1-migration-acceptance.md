# Sprint M1.1 — Migration Acceptance Report

Tarih: 17.09.2026. Sonuç: **FAIL — canlıya geçişe hazır değil**.
Hedef yalnız `MELISA_ERP_FULL_TEST_20260916`.

## Amaç

Migration Acceptance PASS için mevcut aktarımın kayıt bazında kontrolü, kesin
kanıtla çözülebilen hataların düzeltilmesi ve karar gerektirenlerin ayrılması.
Bu rapor Codex mühendislik kontrolüdür; bağımsız QA kabulü ChatGPT'ye, işletme
kabulü Melih'e aittir. QA Accepted ve Business Accepted verilmedi. Sprint Done değildir.

## Kapsam

Ürün, stok, barkod, cari, belge/satır, hareket, F0104 resmî ihracat, döviz ve
2026 devirleri. Yeni özellik, ekran, UI, modül ve refactor yok.
Kaynak Vega salt okunur; canlı ERP bağlantısı yok; terminal kayıtları korunur.

## Yapılacaklar ve uygulanan kontroller

- [x] Kayıt bazında acceptance checklist ve ayrıntılı fark dosyası.
- [x] Ürün kapsamı, miktar, negatif stok ve barkod sahipliği kontrolü.
- [x] Belge/satır anahtarları; numara, tarih, miktar, kaynak fiyat ve iskonto kontrolü.
- [x] Cari/finans/stok hareket kapsamı, döviz hesabı toplamı ve devir kontrolü.
- [x] F0104 kaynak belge listesi ve hedefte bulunma kontrolü.
- [x] Güncel Vega tablolarının donmuş migration kaynağıyla karşılaştırılması.
- [x] Güvenli barkod karar düzeltmeleri ve yeni inceleme kayıtlarının TEST commit'i.
- [x] Manual Decision Required listeleri ve her FAIL için çözüm planı.
- [ ] Sabit kaynak kesiminden son delta aktarımı ve bağımsız QA kabulü.
- [ ] İşletme kabulü.

## Acceptance Checklist

Karşılaştırma temeli `spec-20260917-01` donmuş kaynak snapshot'ıdır. Sonrasında
güncel kaynak ayrıca okundu; aşağıdaki alt kontrollerin PASS olması kaynak
güncelliğini veya alanın tamamının kabulünü tek başına göstermez.

| Kontrol | Sonuç | Kanıt / açık |
|---|---|---|
| Kapsamdaki ürün kartları | PASS | 16.477/16.477; kod, ad, marka ve kategori farkı 0 |
| Kaynak ürün kapsam belirsizliği | FAIL | 16 kayıt: 13 miktar, 3 aktiflik bilgisi belirsiz |
| Bilinen güncel stok + korunan terminal etkisi | PASS | Kontrol edilen ürünlerde kart ve etkin hareket toplamı farkı 0 |
| Negatif stok korunması | PASS | Kaynak ve hedefte terminal etkisi ayrılmış 1.910 negatif kart |
| Tüm stok kabulü | FAIL | 13 bilinmeyen miktar; 684 başlıksız kaynak stok hareketi; 42.821 geçmiş hareketin ürün bağlantısı yok |
| Barkodların tek aktif ürünü bulması | FAIL | 51.813 eşleme / 51.789 doğru aktif karşılık; 24 istisna. Kaynakta 49 barkod çakışması, 5 ayrı hedef sahipliği kararı var; sayılar örtüşebilir |
| Önceki 1.120 barkod farkı | FAIL | Güncel sınıflamada 1.115 çözümlü / 5 çözümsüz; 2 yalancı eksik kapatıldı, 2 yalancı çözüm yeniden açıldı |
| F0102/F0103 belge kapsamı | PASS | 52.691/52.691 başlık |
| Belge numarası ve tarihi | PASS | Snapshot ile karşılaştırılan başlıklarda fark 0 |
| Belge satırı kapsamı | PASS | 521.868/521.868 benzersiz kaynak satırı; 129 referans kopyası bir daha sayılmadı |
| Satır miktar, kaynak fiyat, toplam ve iskonto | PASS | Karşılaştırılan alanlarda fark 0 |
| Belge operasyonel ürün bağlantıları | FAIL | 42.882 satır ürüne bağlanamıyor; ayrıca 7 kaynak satırın başlığı yok |
| İptal belge aktarımı | PASS | Snapshot'ta iptal olarak işaretli bir başlık native belgede bulunmadı |
| Kaynak anahtarı mükerrerliği | PASS | Kontrol edilen başlık/satır/cari/finans/stok kayıtlarında ikinci asli kaynak anahtarı yok |
| Aynı ticari olayın çift etkisinin dışlanması | FAIL | 16.698 genel cari belge ilişkisi çözümsüz; kaynak anahtarı tekilliği ticari olay tekilliği demek değildir |
| Cari hareket kapsamı | FAIL | Bağlı beklenen 52.444 / bulunan 52.421; 23 döviz/tutar belirsiz hareket; ayrıca 7 başlıksız hareket |
| Finans/kasa hareket kapsamı | PASS | 16.685/16.685; ham gelir/gider/kur alanları korundu |
| Tarihli DEVIR hareketlerinin etkisi | FAIL | 2.615 tip 90, 1 Ocak dışı devir hareketinde `affects_balance=0`; işletme yorumu doğrulanmalı |
| Geçmiş stok hareket kapsamı | PASS | Bağlı 503.908/503.908; kaynak giriş/çıkış miktarları farkı 0 |
| Cari hesap–hareket toplam tutarlılığı | PASS | 1.040 hesapta saklı bakiye ile etkin hareket toplamı farkı 0 |
| Cari kimlik kabulü | FAIL | 2 tanımsız dövizli cari; 1 çoklu döviz kimlik eşleştirmesi kanıt bekliyor |
| USD/EUR/TRY hesap ayrımı | PASS | 499 USD, 62 EUR, 479 TRY ayrı hesap; bu sprintte döviz dönüşümü yok |
| Tüm döviz kapsamı | FAIL | `LL` kimliği kesinleştirilmedi; 23 kaynak cari hareketi kapsam dışında |
| Açık 2026 devirlerine hizalama | PASS | Tanımlı 324 hesabın farkı 0; PAKEL açılışı 37.265,26003454 USD |
| Tüm 2026 açılışlarının kabulü | FAIL | 716 hesapta açık 01.01.2026 kaydı yok; 2 açılış satırı `LL`. Yokluk sıfır kabul edilmedi |
| F0104 resmî ihracat kapsamı | FAIL | Snapshot'taki 714 başlık hedef ticari belgelerinde yok; güncel kaynakta ayrıca 1 yeni başlık var |
| Kaynak güncelliği | FAIL | 745 tablonun 729'u aynı, 16'sı farklı; delta kontrolünde 412 eklenen ve 72 değişen satır, 0 silinen satır; bir tablo kontrol sırasında da değişti |
| Terminal kayıtları | PASS | 10059/10060/10061 ve bağlı korunmuş kayıtlar aynı hash |
| Yedek / TEST commit / erişim | PASS | Yeni COPY_ONLY/CHECKSUM + VERIFYONLY; commit korundu; Yeni ERP bağlı MCP üzerinden run okundu |

## FAIL nedenleri ve çözüm planı

| Alan | Sonuç | Neden | Çözüm planı |
|---|---|---|---|
| Migration | FAIL | Veri/ilişki açıkları ve değişen canlı kaynak | Aşağıdaki kararları kapat; sabit kaynak kesimi al; delta aktar; QA ve işletme kabulü |
| Ürün | FAIL | 16 belirsiz kapsam kaydı, sonradan 15 yeni kart | Aktiflik/miktar kanıtını doğrula; yeni kartları sabit delta kapsamında aktar |
| Stok | FAIL | 13 miktar belirsizliği, 684 yetim hareket, 42.821 ürün bağlantısız geçmiş hareket | Kaynak belge ve ürün eşleşmesini kanıtla; terminal etkisini ayırarak miktarı yeniden karşılaştır |
| Barkod | FAIL | Kaynak çakışmaları ve belirsiz sahiplik | Barkod + model/renk/kart kimliğiyle owner karar listesi; onaylı eşleşmeleri uygula |
| Cari | FAIL | Tanımsız dövizli kartlar ve tek kimlik altında birleşme kararı | Döviz tanımını ve kimlik kanıtını doğrula; hesapları ayrı tutarak yeniden karşılaştır |
| Belgeler | FAIL | Eksik ürün bağlantıları, başlıksız satırlar, son kaynak değişiklikleri | Kaynak anahtarlarıyla header/ürün bağla; son deltada belge no değişimini izli uygula |
| Hareketler | FAIL | 23 eksik cari hareketi, 2.615 tarihli DEVIR etkisi ve çözümsüz belge ilişkileri | Döviz/DEVIR iş kuralını doğrula; aynı ticari olayı tekilleştir; izli düzeltme sonrası hesapları yeniden karşılaştır |
| F0104 | FAIL | Resmî ihracat kayıtları native belgeye bağlanmamış | F0102/F0103 karşılığını kaynak belge anahtarı/satırlarıyla eşleştir; ikinci stok/cari etkisini engelleyen aktarım |
| Döviz | FAIL | `LL` bilinmiyor; kapsam eksik | Kaynak döviz tanımına işletme onayı; keyfi kur dönüşümü yapmadan eksik hareketleri aktar |
| 2026 devirleri | FAIL | Açık açılış kaydı olmayan hesaplar ve `LL` | 716 hesap için yokluk/sıfır/devir dayanağı kararı; 2 LL satırı doğrulandıktan sonra per-currency kontrol |

## Güvenle çözülenler

`8682453432335 ` ve `8682472224140 ` barkodlarının sondaki boşluğu dışında
doğru üründe aktif olduğu doğrulandı; iki eski eksik kararı RESOLVED yapıldı.
Karantinadaki `dddd` ve `FDFDFD` için eski RESOLVED kararları UNRESOLVED yapıldı.
Bu düzeltmeler barkod sahibini değiştirmez. 1.120 eski farkın net çözüm sayısı
1.115 olarak kalır; hangi beş kaydın açık olduğu artık aktif durumla tutarlıdır.

F0103 ürün bağlantıları için başlıktaki tedarikçi + model + marka + benzersiz
stok kodu kanıtı ayrıca arandı. İncelenen 34.959 alış satırı ve 1.133 envanter
satırında yeni güvenli aday bulunmadı; tahmini eşleşme uygulanmadı.

TEST patch: `m11-20260917-patch01`, `COMMITTED_ACCEPTANCE_FAIL`.
Dört eski kararın sınıfı düzeltildi; 2.615 DEVIR + 16 kaynak değişimi için
2.631 yeni karar kaydı ve dört çözüm iz kaydı eklendi. Ticari veri, kaynak
hareket ve döviz bakiyesi değiştirilmedi. Başarılı commit rollback edilmedi.

## Manual Decision Required

Kayıt listeleri private kanıtlarda ve TEST `migration_decisions` içinde tutulur.
Toplu kararlar tek tek yüz binlerce satır tahminiyle çözülmez; önce kaynak/kimlik
kuralı doğrulanır, sonra ilgili kayıt grubu yeniden işlenir.

| Karar | Gerekli bilgi / karar | Sonraki uygulama |
|---|---|---|
| MD01 | 49 barkod çakışması ve 5 sahiplik uyuşmazlığında ürün/model/renk kimliği | Yalnız kesin sahip veya onaylı gerçek mükerrer kart birleştirmesi |
| MD02 | 13 miktar ve 3 aktiflik belirsizliğinin kaynağı | Ürün kapsamı ve stok toplamını tekrar üret |
| MD03 | 716 açık devir kaydı olmayan hesabın başlangıç dayanağı | Her döviz için açık kaynak kanıtlı devir; 189 hesapta tarihî kapanış sıfır değil |
| MD04 | `LL` para biriminin gerçek tanımı, 2 cari / 23 hareket / 2 açılış bağlantısı | Dönüşüm yapmadan doğru döviz hesabına aktar |
| MD05 | Çoklu dövizli gerçek cari kimliği için kanıt | Peşin USD/TL/EUR hesaplarını birleştirmeden doğru kimlik bağlantısı |
| MD06 | 2.615 tip 90 DEVIR satırının dönem işlemi mi tekrar açılış mı olduğu | Tarih/cari/döviz bazında tek etkin kayıt; geçmişi silmeden izli düzeltme |
| MD07 | F0104 resmî ihracat belgelerinin F0102/F0103 ticari olayıyla ilişkisi | 714 snapshot + 1 yeni başlık için belge/satır eşleme ve çift etki kontrolü |
| MD08 | Yetim belge bağlantıları ve tarihî ürün kimliği | 7 satır, 7 cari, 684 stok hareketi ve ürün bağlantısız satırlar için kanıtlı adaptör düzeltmesi |
| MD09 | Sabit migration kesim zamanı | 16 değişen tablo, 412 yeni/72 değişen kayıt için terminali koruyan delta migration |
| MD10 | Kaynak personel ön eklerinin gerçek kişi karşılığı | Sekiz prefix için kaynak kanıtlı kişi listesi; isim tahmini yok |

MD09 deltası sırasında `F0102D0007TBLSTOKHAREKETLERI` hash'i değişti. Canlı
kaynak sabitlenmeden bu delta tutarlı bir atomik kesim sayılmaz. Sonradan gelen
15 ürün, 3 F0102 stok çıkış başlığı/166 satır ve 1 F0104 başlığı/19 satır bu
sprintte körlemesine eklenmedi. Dolayısıyla TEST, son Vega deltasıyla henüz eşit
değildir; TEST'te düzeltmeler, açıklar ve kayda alınmış acceptance sonucu günceldir.

## Riskler

- Kapsam/ürün kimliği açıkları geçmiş raporların eksiksizliğini engelliyor.
- Tarihli DEVIR yorumunun yanlış olması güncel bakiyeyi etkileyebilir;
  saklı bakiye ile hedef hareket toplamının tutması tek başına Vega eşitliği değildir.
- F0104 ve genel cari ilişkileri çözülmeden ticari olay tekilliği kabul edilemez.
- Vega yazılmadı, ancak işletme kaynağı çalışma sırasında değişiyor; eşzamanlı
  okuma atomik snapshot garantisi sağlamaz.

## Rollback Planı

Kullanıcı talimatıyla başarılı TEST sonucu geri alınmaz; bu sprintte rollback,
restore veya veri silme yapılmadı. Yazma öncesi doğrulanmış yedek tutuldu.
Olası düzeltmeler yeni, denetlenebilir ileri patch ile ve yalnız TEST'te yapılır.
Terminal koruma hash'i değişmedi:
`d1205b7c8b7a61fa617fa64be1a0faf108ca6692ddf9199c1574f8a11b6d8509`.

## Kanıt ve tekrar üretim

Özel kanıt kökü: `%LOCALAPPDATA%\MelisaERPServer\migration-spec`.

- `m11-20260917-before/acceptance-report.json`: kapsam ve ölçümler.
- `m11-20260917-before/record-differences.jsonl`: kayıt bazında bütün bulunan farklar.
- `m11-20260917-before/manual-decision-required.json`: mevcut açık karar listesi.
- `m11-20260917-before/barcode-manual-decisions.json`: barkod + kart/model karşılaştırması.
- `m11-20260917-before/F0104-document-review.json`: resmî ihracat başlık listesi.
- `m11-20260917-source/table-checks.jsonl`: 745 güncel tablo hash karşılaştırması.
- `m11-20260917-source/record-deltas.jsonl`: 16 tablo için önce/sonra kayıt farkları.
- `m11-20260917-source/delta-summary.json`: ikinci okuma stabilitesi ve delta sayıları.
- `m11-20260917-patch01/`: yedek, commit, post-commit koruma, yeni kararlar ve MCP okuma kanıtı.

Salt okunur kontrol komutları `vega-m11-acceptance.mjs`,
`vega-m11-source-check.mjs`, `vega-m11-source-deltas.mjs` dosyalarındadır.
Kanıt dosyaları mevcutsa üzerine yazılmaz. Yazıcı
`vega-m11-acceptance-patch.mjs --commit-test` kesin TEST kimliği, özel run,
doğrulanmış yedek ve koruma kontrolleri gerektirir; tamamlanmış run yeniden yazılmaz.

## Sonraki Sprint

M1.2 — Migration kararlarının kapatılması ve sabit kesimden delta aktarımı.
Önce MD03/MD04/MD06/MD07/MD09 iş kuralları; ardından kaynak anahtarıyla kanıtlı
eşlemeler ve aynı checklist'in yeni snapshot'ta tekrarı. QA ve işletme kabulü
olmadan ERP Core, Terminal entegrasyonu veya pilot aşamasına geçilmez.
