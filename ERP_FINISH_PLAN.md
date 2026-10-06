6 Ekim2026 ERP-INBOUND01: normal Mal Kabul→Alış→tedarikçi hareketi→HOME TEST58/source93365d0 dar teknik hazır. İnsan ERP-UA10/11/12 bekliyor;49/7🟢/24🟡/18🔴 değişmez. [Kanıt](docs/evidence/erp/2026-10-06-inbound/README.md). Başka iş başlamaz.

6 Ekim2026 ERP-NIGHT01: normal Satış→müşteri Tahsilat→kalıcı müşteri/home dar teknik hazır. B04/B06 kırmızıdan kısmiye alındı; insan kabulü ERP-UA07/08/09 bekliyor. TEST53/source11f1734 ve [kanıt](docs/evidence/erp/2026-10-06-night/README.md). Bu gece tamamlandı ve duruldu.

# Melisa ERP — bitirme planı

5 Ekim2026 güncel kullanıcı kabulü: ERP-UA04 PASS ve ERP-D04 mevcut normal katalog kapsamında tamam; A03🟢. B01 normal Ana Sayfa TEST47/source236d49b ile 🟡 teknik hazır; ERP-UA05 insan kabulü bekliyor. [Kanıt](docs/erp-v2/canonical-20261005/home-daily-work-acceptance.md). Yalnız bu tur tamamlandı ve duruldu; önceki bekleyen kayıtlar tarihsel olarak korunur.

5 Ekim2026 güncel — ERP-D04 kullanıcı düzeltmesi: gerçek KOD1/KOD4, güvenli gösterim kodu, normal listede küçük fotoğraf/gerçek filtre/doğal sıralama TEST46/source7da6f2c ile teknik hazır. [Sınıflandırma kabul kanıtı](docs/erp-v2/canonical-20261005/catalog-classification-acceptance.md), güncel ortam ve süreler STATUS'ta. ERP-UA04 bekliyor; önceki ERP-UA02/03 PASS ve finish49/6🟢/22🟡/21🔴 korunur. Kullanıcı talimatıyla burada durulur; CRM/başka finish işi başlamaz.

5 Ekim 2026 — ERP-UA02 normal katalog/performans PASS ve ERP-UA03 plan PASS korunur; ERP-D03 tamam. ERP-D04, 3.830 merkezi fotoğrafı TEST normal kartlarına bağladı; 67 belirsiz ve 4620 hold kapsam dışında. Teknik kabul hazır; yeni ekranın ERP-UA04 insan kabulü bekliyor, A03🟡. [Uygulama kanıtı](docs/erp-v2/canonical-20261005/photo-application-acceptance.md). Bu görev sonunda duruldu; CRM/başka iş başlamadı. Günlük sıra DELIVERY_BOARD'dadır.

Önceki kayıt — ERP-UA02 kabulünden önceki 5 Ekim 2026 performans teslimi — **Yalnız ERP-D02/A01/A02/B02 çalışma kataloğu:** paket40/sourcedf3de90, tasarım değişmeden default50. Gerçek50liste medyan6786→393ms, barkod1050→195ms, kart792→197ms; servis hazırken ilk50istek393ms,35sn sonrası kart140ms/sayfa337ms. Paket39ilk1353ms ara ölçümü ayrıca korunur. Tüm global doğrulama/karantina/yetki ve veri aynı; [STATUS](STATUS.md). Finish49/5🟢/22🟡/22🔴 ve ERP-UA02 insan sonucu değişmez. Kullanıcı talimatıyla bu dilim bittiğinde başka finish-tree işi başlatılmaz; fotoğraf ayrı başlatma bekler.

Önceki kayıt — ERP-UA02 kabulünden önceki 5 Ekim 2026 teknik teslim — **ERP-D02 çalışma kataloğu:** ornek-akis.html mevcut tasarımda gerçek ürün/barkod/stok/satış fiyatı/döviz ve eksik fotoğraf alanına bağlandı. Paket38/source7db0685 teknik hazır; [ERP-UA02](USER_ACCEPTANCE.md) insan kabulü bekliyor. Günlük sıra [DELIVERY_BOARD](DELIVERY_BOARD.md), teknik kanıt [STATUS](STATUS.md). Sayım49/5🟢/22🟡/22🔴 değişmez; gerçek fotoğraf/CRM entegrasyonu tamam sayılmaz.

5 Ekim 2026 önceki LAB teslimi — **B02+A01 stok:** paket34/sourcefab3e1d normal katalog/barkod/kart ve üç genişlik teknik hazır. [Kullanıcı adımları](docs/erp-v2/canonical-20261005/stock-products-acceptance.md). Personel kabulü bekliyor; bu tarihsel kayıt yeni günlük sıra değildir. B02 kısmiye alındı, genel migration/ticari kabul tamam sayılmadı.

5 Ekim 2026 önceki ek kullanım kabulü — **TEST ADMIN (paket32 tarihsel):** [5194](http://127.0.0.1:5194) taze sekmede otomatik TEST ADMIN; İş sırası + 17 TEST menüsü erişimi ve gerçek kullanıcı girişine dönüş/yenileme gerçek ekranda doğrulandı. Mevcut rol tabloları, SQL fixture scope'u ve LIVE/Vega sınırları korunur. [Kabul/teslim kaydı](docs/erp-v2/canonical-20261005/test-admin-acceptance.md). Teknik hazır; gerçek kullanıcı kabulü bekliyor. Bu konfor işi genel ticari, rol/personel veya migration yapraklarını tamamlanmış saymaz; finish tree sayımı değişmez.

## Güncel finish tree — 6 Ekim 2026

**Toplam 49 iş: 🟢 7 tamam · 🟡 24 kısmi / kabul bekliyor · 🔴 18 açık. Genel ilerleme: %14,3 tamam; %49,0 kısmi.** Sayımlar yalnız aşağıdaki tekil yaprakları kapsar. Teknik hazırlık ve personel kabulü ayrı tutulur; kısmi işler tamam yüzdesine eklenmez. Aşağıdaki tarihsel F01–F06 satırları yeni açık iş veya ikinci finish tree değildir.

Ana hedef: gerçek SQL verisini kullanan, günlük mal kabul → alış → satış → tahsilat → gün sonu akışına ve Vega geçişine hazır ERP. Bu hedefin tümü henüz kabul edilmedi. Kaynak `C:\Sirket\ERP\melisa-erp-v2`, exact origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`. Çalışma dalı `codex/erp-finish-20261004`, uygulama tabanı `e0c18e3d36a48bc2caab33f8192655eb2fc5805d`; belge dalı veya eski main uygulama tabanı yapılmadı. Ayrı CRM kabulü PR #21'de korunur; o eski paralel dal güncel migration kodunun üstüne körlemesine alınmaz.

🟢: kayıtlı kapsamın kabulü tamam; yeniden ispat işi açılmaz. 🟡: kaynak/teknik hazırlık var, belirtilen gerçek kullanım veya işletme kabulü eksik. 🔴: somut uygulama/kanıt/karar eksik. Bilinmeyen maliyet, bakiye, barkod veya kur sıfır/tahmin ile tamamlanmış sayılmaz. Belirsiz kartlar karantinada kalır.

| ID | İş | Durum | Kanıt / kapanış ölçütü |
| --- | --- | --- | --- |
| P01 | Kanonik kaynak ve origin | 🟢 | SEMIH exact repo, temiz e0 tabanı ve fetch/push doğrulandı; eski kopyalar korunur. |
| P02 | TEST/LIVE süreç ve DB ayrımı | 🟢 | Stok kabulünde5194/4144/4146 → paket34/sourcefab3e1d → Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; LIVE süreç sahipleri aynı. |
| P03 | Tek TEST launcher ve paket/hash kaydı | 🟢 | Stok paket34 1.248 dosya manifest eşleşti; eski paketler ve before-stock-34 launcher geri dönüş kaydı korunur. |
| A01 | Stok kartı, kod/ad, barkod, stok, birim | 🟡 | ERP-D02 normal yüz16622açılış+54hold/sentetik0 kod/ad/exactbarkod/nativeERPstok ERP-UA02 PASS;86bilinmeyenbirim nullable. Eski LAB16679 kapsamı korunur. Genel veri/personel/delta kabulü açık. |
| A02 | Satış/alış fiyatı, maliyet, döviz | 🟡 | ERP-D02 satış fiyatı/döviz normal yüz ve ortakv1 API ERP-UA02 PASS; alış/maliyet bu katalogda yok.63774typedfiyat/C03exact8→native4 veUSD/EURsentetik kabulü korunur. Genel fiyat yazımı/personel kabulü açık;NULL/gerçek0 ayrıdır. |
| A03 | Gerçek ürün fotoğrafı | 🟢 | ERP-UA03 plan PASS / ERP-D03 tamam. ERP-D04 önce42/source956fc32 kart fotoğrafı; şimdi46/source7da6f2c normal listede thumbnail/KOD1/KOD4/güvenli kod/gerçek filtre ve doğal sıra. Merkezi3.830CONFIRMED,67belirsiz ve4620hold hariç; orijinaller korundu. [Önceki fotoğraf kanıtı](docs/erp-v2/canonical-20261005/photo-application-acceptance.md) ve [yeni sınıflandırma kanıtı](docs/erp-v2/canonical-20261005/catalog-classification-acceptance.md) teknik hazır; ERP-UA042026-10-05 açık kullanıcı kabulü PASS; yalnız mevcut3830CONFIRMED kapsamı tamam.67belirsiz/karantina dışarıda; CRM bağlanmadı. |
| A04 | Gerçek müşteri ve dövizli bakiyeler | 🟡 | C06 normal441kart/ayrı döviz,exact8 kaynak+güncel+defter bağı,UNKNOWN ve28 karantina gerçek salt okunur TEST kabulü hazır. Kaynak30 Eylül; delta/personel kabulü açık. |
| A05 | Gerçek tedarikçi ve dövizli borçlar | 🟡 | Açılıştaki401/406 kabulü korunur. C07 normal530native kart/90nativehold, ayrı kanıtlı/doğrulanmamış/UNKNOWN hesap ve gerçek salt okunur TEST kabulü hazır. Tüm530 migration kabulü değildir; delta/personel kabulü açık. |
| A06 | Kaynak güvenirliği ve karantina gösterimi | 🟡 | 176 kaynak/172 hedef/4 hedefsiz; API+SQL engeli ve negatif ekran provası hazır. İşletme kabulü bekliyor. |
| B01 | Ana Sayfa günlük iş sırası | 🟡 | TEST58/source93365d0: mevcut satış/tahsilat özetleri korunur; kalıcı sayım, stok kartı gerekli ve alış taslakları ayrı sonraki okumayla günlük iş listesine gelir. Gerçek ilk kullanılabilir749ms/iş listesi995ms,1440/1024/390. Kasa açılış/vade/ödeme bekleyen kaynağı bağlı değil. ERP-UA05/09/12 insan kabulü bekler. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| B02 | Stok arama/filtre ve detay | 🟢 | Kullanıcı2026-10-05 normal ornek-akis kataloğu ve performansı kabul etti; ERP-UA02 PASS/TEST paket40source df3de90. Gerçek arama/exactbarkod/kart/stok/satışfiyatı/default50 ve önceki1440/1024/390teknik kanıt korunur. Fotoğraf A03,veri/delta A01,genel fiyat A02 ayrı açık; eski LAB/hata/çoklubarkod kanıtları korunur. |
| B03 | Cariler bilgi hiyerarşisi | 🟡 | Müşteri ve tedarikçi arama/aktiflik/karantina/sayfa ve ayrı dövizli kart; iki modül iframe1440/1024/390 taşmasız. Tedarikçi deneme iletişimi üç genişlikte kullanılabilir; genel cariler/personel kabulü açık. |
| B04 | Satış günlük kullanım ekranı | 🟡 | Normal yeşil Satış TEST53: gerçek readonly katalog/müşteri; iki sentetik ürün taslak/finalize, literal barkod/tam kod, yenileme/yanıt kaybı/replay/iptal ve1440/1024/390 teknik hazır. ERP-UA07 insan/genel ticari kabulü bekliyor; [gece kanıtı](docs/evidence/erp/2026-10-06-night/README.md). |
| B05 | Alış günlük kullanım ekranı | 🟡 | Normal TEST58 iki ürünlü TRY kabul→kalıcı taslak→140TRY finalize/ters ve kayıtlı USD currentprice/4Ekim kur paneli; üç genişlikte taşmasız. Stok faturada ikinci kez artmaz. Önceki C01/C02/C03 kabulü korunur; ERP-UA11 genel alış/personel kabulü bekler. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| B06 | Finans günlük kullanım ekranı | 🟡 | Normal müşteri tahsilatı TEST53: kısmi/tam/ters kayıt, kalan borç/kalıcı SQL ve mevcut seller/İlker yetkileri teknik hazır. ERP-UA08 insan kabulü bekliyor. Yalnız sentetik TRY; banka/tedarikçi ödeme/genel kasa açılışı kapsam dışında. |
| B07 | Raporlar filtre ve kapsam | 🔴 | Gerçek kaynak, NULL maliyet/kâr kapsamı, ayrı döviz ve açıklamalı export; üç genişlik. |
| B08 | Ayarlar günlük kullanım ekranı | 🔴 | Kullanıcı/izin/terminal/başlama/yedek durumlarını kanıtlı ve sade göster; üç genişlik. |
| C01 | Çok satırlı mal kabul | 🟡 | TEST58 personel15 çok satırlı sayım/eksik-fazla notu/kaydet/yenile; İlker16 onayı. Sayım#4→kabul#3 stok29/2→30/3 bir kez; yanıt kaybı ve paralel replay ek etki0. Sayım#5 iki satır hazır;#6 belirsiz barkod kalıcı ve gönderim kapalı. Önceki28/0→29/2 kabulü tarihsel olarak korunur. ERP-UA10 ve genel ticari kapsam bekler. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C02 | Ayrıntılı alış taslağı | 🟡 | TEST58 normal25091 taslak/finalize140TRY, borç−100→40; yenileme/iptal borcu−100'e döndürür, fiziksel stok30/3 aynı. Kaynak60/80TRY immutable. Eski140/80 işlemler ve220TRY taslak korunur. ERP-UA11 ve genel alış/personel kabulü bekler. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C03 | Dövizli alış fiyatı operasyonu | 🟡 | Önceki typed kaynak/exact8→native4/EUR ve iki tarihli kur kabulü korunur. TEST58 normal currentUSD1.34567890/version7→1.3457USD,4Ekim USD40/TRY1→53.8280TRY. Kabul38 stok31→32;25092 borç60→113.828→60 ters,stok32 aynı. EURnull/TRYpurchasequote yok;3current/7version/önceki25090 aynıdır. ERP-UA11 genel ticari/personel kabulü açık. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C04 | Gerçek satış ekranı kabulü | 🟡 | Önceki kabul korunur; normal53 iki ürünlü satış/taslak/finalize/fiş/stock/debt ve UUID tekrar güvenliği teknik hazır. Yalnız ayrılmış sentetik kapsam; ERP-UA07 insan ve genel ticari kabulü açık. |
| C05 | Açık hesap | 🟡 | Normal53 tahsilatsız satış150TRY borç oluşturur, kasa0;50kısmi sonrası100kalan, tam sonrası0 ve ters kayıtlar kalıcı doğrulandı. Genel ticari limit/vade/döviz/personel kabulü açık. |
| C06 | Gerçek müşteri kartı | 🟡 | Normal salt okunur kart/18 gerçek API denemesi ve arama/sayfa/boş/karantina/üç genişlik kabulü hazır. customer.view sınırı ve bilinmeyen hesaplar korunur. Yetkili düzenleme ve personel kabulü açık; gerçek ticari kart yazması yok. [Kabul](docs/erp-v2/canonical-20261004/customer-card-acceptance.md). |
| C07 | Gerçek tedarikçi kartı | 🟡 | Önceki530nativekart/90hold,13373deneme iletişim/izin kapsamı korunur. TEST58 normal13370 kabul#3→25091→+140TRY/−140TRY zinciri; eski bağ bilinmiyor açık, ayrı dövizli gerçek kartlar salt okunur. İlker16 mevcut view/edit,personel15 finans erişimi kapalı. ERP-UA12 ve gerçek kart düzenleme/personel kabulü açık. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C08 | Kasa/banka günlük akışı | 🟡 | Normal53 müşteri kısmi/tam tahsilatı ve ters hareketleri mevcut yetkiyle aynı native transaction; stok değişmez, TRY ayrı. ERP-UA08 bekliyor; banka/tedarikçi ödeme/fiziksel kasa açılışı/sayım ayrı. |
| C09 | Fiyat yazma/düzenleme | 🟡 | Ayrılmış301986 native exact8 fiyat create/edit, onaylı TEST16 özel izin, immutable version/CAS/fullpayload replay; normal fiyat→kabul37→native25090→borç→iptal, eski belge fiyatı korunur. Genel ticari kartlar/terminal fiyat tüketimi/personel kabulü açık. [Kabul](docs/erp-v2/canonical-20261005/product-price-acceptance.md). |
| C10 | Sayım/iade/ters kayıt | 🟡 | Mevcut sayım/bağlı alış iadesi geçmişi korunur. TEST58 çok satırlı kalıcı sayım, bilinmeyen ürün incelemesi ve fatura tersinde borç geri/stok aynı kanıtlı. Fatura iptali fiziksel iade değildir. ERP-UA10/11 ile genel sayım/iade/personel kabulü açık. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C11 | Kullanıcı/yetki | 🟡 | Mevcut roller korunur; yeni geniş kullanıcı izni yok. Gerçek15 sayım/home200,alış/tedarikçi/FX403;16 mevcut yetkili200,14receiving403; negatif ürün/karantina/replay aktör sınırı. TEST58 personel refresh/403sonrası navigasyon oturumu korunur; maliyet/borç görünmez. Genel rol matrisi/personel kabulü açık. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| C12 | Fiziksel terminal | 🔴 | Gerçek cihaz/scanner/offline/sync; kaynak/API/DB/package kimlikli normal kullanım kabulü. |
| C13 | Windows otomatik başlama | 🔴 | Mevcut görev/launcher sahibi, logon/reboot/uyku sınırı ve gerçek açılış kabulü; LIVE değişikliği ayrı yetki. |
| C14 | Backup/restore | 🔴 | Ayrı sentetik restore hedefiyle prova, veri kaybetmeden geri dönüş ve operatör kabulü; VERIFYONLY restore değildir. |
| C15 | Günlük raporlar | 🟡 | Mevcut rapor kaynakları korunur; normal ekranın dönem/döviz/maliyet kapsamı ve export kabulü eksik. |
| D00 | Donmuş Vega açılış mutabakatı | 🟢 | RUN06 COMMITTED, eşlenen 16.622 ürün/772 cari/785 hesap/63.774 fiyat fark0, replay ek yazma0; yalnız bu kapsam. |
| D01 | 54 ürün belirsizliği | 🔴 | İşletme kimlik/birim/barkod kararı ve kaynak kanıtı; operasyon engeli A06'da korunur. |
| D02 | 122 cari belirsizliği | 🔴 | 28 müşteri/94 tedarikçi kimlik/döviz/bakiye kararı; tahmin/NULL→0 yok. |
| D03 | Eksik maliyetler | 🟡 | 10.552 NULL açık gösterilir; yeni kanıt veya açıklamalı işletme kabulü gerekir. Liste alış fiyatı maliyet değildir. |
| D04 | 71 yeni ürün delta | 🔴 | Gerçek kaynak salt okunur plan; yeni ID/alias/birim/barkod/fiyat/açılış zinciri, sentetik TEST prova. |
| D05 | 341 değişmiş ürün delta | 🔴 | Kaynak kimliği ve before-image ile eşleme; korunmuş yerel stok/maliyet etkisi; atomik TEST prova. |
| D06 | 74 değişmiş cari delta | 🔴 | Döviz hesaplarını ayrı ve exact etkileri korunarak eşle; güvenli kapsam belirsizliği açık kalsın. |
| D07 | T0/T1 cutover planı | 🔴 | Sorumlu/zaman, bütün kaynak yazıcı ve gecikmiş terminal kesimi, tutarlı snapshot; LIVE uygulama ayrıca onaylı. |
| D08 | İdempotent delta batch | 🔴 | Yeni immutable run/hash/plan, tam before-image, drift/red ve replay0; RUN06 writer tekrar kullanılmaz. |
| D09 | Son mutabakat | 🔴 | Yeni kesim/delta kaynak→native kayıt bazında fark0; fiyat sürümü/karantina mirası ve eski geçmiş korunur. |
| D10 | Committed rollback provası | 🔴 | Ayrı sentetik TEST etkisini geri al, sonraki hareketi ezme; yarıda transaction rollback'i yeterli değil. |
| D11 | Vega READ ONLY arşiv planı | 🔴 | Tek yazıcı devir sırası ve geçmişe salt okunur erişim; gerçek Vega mod değişikliği bu yetkide yapılmaz. |
| E01 | Modül bazında gerçek kabul | 🔴 | Her modüle normal TEST URL ve 3–5 deneme; rol/olumsuz durum/SQL etkisi ve kişi/tarih/kapsam kayıtlı. |
| E02 | Personelin günlük akış kabulü | 🔴 | Mal kabulden gün sonuna kullanıcı günlük işini deneyip kabul eder; ajan teknik testi insan kabulü değildir. |
| E03 | Görsel üç genişlik kabulü | 🔴 | Eski C03/C06/C07/C09 LAB kanıtları korunur. TEST58 normal Mal Kabul/Alış/Tedarikçi/HOME1440/1024/390 toplam12görünüm taşmasız; personel/yetkisiz/belirsiz durumları da kanıtlı. Tüm ERP modülleri/fiziksel cihaz/personel görsel kabulü hâlâ açık; ERP-UA10/11/12 bekler. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |
| F01 | Tek finish tree ve otomatik sıra | 🟢 | Bu tablo güncel iş kaynağı; root sayım/status günceller. `devam` sıradaki bağımsız açık işi seçer. |
| F02 | GitHub/CI teslim düzeni | 🟡 | Feature codex/erp-finish-20261004/draft PR23. TEST58/source93365d0 exact push37435923959/PR37435929646 CI SUCCESS. Son belge head ayrı PRChecks ile doğrulanır; kaynak/GitHub/runtime ayrıdır. Genel ERP teslimi açık; merge/LIVE yok. [Sabah kanıtı](docs/evidence/erp/2026-10-06-inbound/README.md). |

### Önceki C09 dilimi, sahiplik ve kabul — tarihsel kayıt

C09 dar teknik TEST kabulü hazır: paket29/sourcef295561; normal fiyat create/edit, actual SQL/API provenance ve immutable history/CAS, özel TEST16 izin; eski kur/fiyat snapshotıyla kabul37/native25090/finalize/iptal. Stok31/maliyet62,6994/borç60; eski C03 taslak25089 korunur. API34 ve12negativeSQL;28oldtables/136izin/455oldSQLobject fark0. Üç genişlikte fiyat formu ve eski belge taşmasız; büyük işlemler. Genel ticari kartlar/terminal tüketimi/personel kabulü açık, C09 🟡 ve toplam5/21/23. [Kabul](docs/erp-v2/canonical-20261005/product-price-acceptance.md). Backend/frontend/SQL ayrı dosya sahipliğiyle çalıştı; bağımsız salt okunur review yapıldı. Root entegrasyon, gerçek TEST kurulum/paket/kabul ve Git/CI/plan sahibidir.

Aşağıdaki C07/C06/C03 paket ve sayımlar önceki dilimlerin tarihsel kanıtıdır; bu eski runtime ve sayımlar ilgili C09 kaydına aittir; güncel gece runtime/sayım üstteki ERP-NIGHT01 ve STATUS kaydındadır.

C07 seçili teknik TEST kapsamı tamam: paket24/source0907cdd, uygulama95bef87; normal530native kart/90nativehold ve ayrı döviz kanıtı, bilinmeyen/kayıtlı-doğrulanmamış/karantina ayrımı. Kullanıcının açık yanıtındaki TEST16 supplier.view/edit iki anahtarı eklendi;2insert/replay0 ve diğer134izin tam aynı. Gerçek kartlar salt okunur;13373 deneme iletişimi normal ekranda kaydet/replay/yenile/orijinalNULLrestore ile doğrulandı. Row_version CAS, UUID/fullpayload replay ve immutable before/after journal tam2completed/0reserved. API20okuma+14negatif/replay,9rollbackSQL,27eski tablo ve28protectedfixturekolon fark0;1440/1024/390 kart+form taşmasız. İki bağımsız çapraz kaynak/SQL incelemesi ve son gerçek SQL mühür/yetki kontrolü PASS. [Tedarikçi kabulü](docs/erp-v2/canonical-20261004/supplier-card-acceptance.md).

Yalnız indirilebilir npm download cache temizliği kullanıcı tarafından onaylandı ve uygulanarak5,24GB açıldı. Eski paket23 ve launcher geri dönüş kaydı korundu; yalnız doğrulanmış üç TEST süreci yeni pakete geçti, LIVE sahipleri aynı. Contact SQL5metadata/replay0; eski42tanım/37FIRST/15+17manifest ve kaynak/hold mühürleri korundu. Bu kapsam gerçek ticari kart düzenleme, personel veya cutover kabulü değildir; C07 🟡 ve toplam5/20/24. Source95bef87 ve paket0907 için dört hosted CI jobSUCCESS; nihai belge head ayrıca doğrulanır.

C06 salt okunur müşteri kartının dar gerçek TEST teknik kabulü hazır. Genel kart düzenleme ve personel kabulü PARTIAL. Paket23/source8933b01:441 müşteri,25 satırlı sayfa,28 karantina; gerçek kart155 TRY/USD kaynak+yerel exact8+güncel+defter mutabık, EUR doğrulanmadı. Kaynak30 Eylül; güncel Vega bağlantısı/delta değildir. Bilinmeyen tutar sıfır yapılmaz, dövizler toplanmaz. 18 gerçek API denemesi, bağımsız kaynak/SQL inceleme ve 27 ticari/finans tablosunun tüm count/maxId/digest farkı0. Okuyucu25sayfa542/895ms; owner7FE6 hash, dar EXEC ve eski mühür/guardlar korunur. [Müşteri kabulü](docs/erp-v2/canonical-20261004/customer-card-acceptance.md). Aynı dosyada paralel yazma yapılmadı.


C03 dar teknik TEST teslimi tamamlandı; [gerçek kabul kaydı](docs/erp-v2/canonical-20261004/purchase-fx-acceptance.md), paket21/source2751fac. Typed `purchase/CARD/0`, ayrı mühürlü ADET×1, exact8→açık HALF_UP native4 ve iki tarihli sentetik kur; gerçek kartlar salt okunur, yazma yalnız301986/13373 TEST kopyasıdır. Üç fiziksel kabul/+3 stok; EUR/USD finalize+iptal toplam borç etkisi0; ret etkisiz. Stok29/ortalama63,9242/borç60; fatura25089 49,50 TRY karşılıklı EUR taslağı personel denemesine hazır. 17 yeni guard/15 eski/42 tanım/37 FIRST+mühürler,24 önceki ticari/finans tablo tam digest'i korunur. Restore/committed rollback yapılmadı; genel alış ve insan kabulü eksik olduğundan C03 🟡 kalır.

**ERP-1 / B02+A01 teknik teslimi tarihsel kapsamdır; günlük sıra DELIVERY_BOARD tarafından belirlenir.** Yeni salt okunur okuyucu kabul edilmiş kaynak kimliğini native stok/birim/barkod/karantina ile bağlar; bilinmeyen değer sıfır yapılmaz. Genel ticari yazma ve personel kabulü ayrı açık kalır. C09 dar teknik TEST kabulü hazır; [kabul](docs/erp-v2/canonical-20261005/product-price-acceptance.md).

İlk C01/C02 diliminin [kabul kaydı](docs/erp-v2/canonical-20261004/purchase-batch-acceptance.md) personelin beş denemesini içerir. Tarihsel SQL source46e10ce/paket18 uygulaması4e6b606 kabulü korunur; o C09 diliminin çalışan uygulaması paket29/sourcef295561 idi. Güncel çalışan uygulama STATUS üstündeki TEST53/source11f1734 kaydındadır. Çalışan C01/C02/migration tekrar ispat işi açılmadı; C03 yalnız yeni etkilenen akış ve kaynaklarla kontrol edildi.

İlk kabul iki farklı sentetik ürün, satır başına 1–5 ADET, TRY ve açık KDV/iskonto0 kapsamındadır. Bu dar prova genel dövizli fiyat yazımı, tüm ticari kartlar veya fiziksel terminal kabulü sayılmaz. Legacy tek satır/bağlı iade korunur. Taslak/pending stok ve borç değiştirmez; fiziksel onay stok oluşturur; finalize yalnız borç oluşturur; replay ikinci etki üretmez; sahte/yetkisiz/karantina satır bütün işlemi durdurur.

Yeni kod sonrasında uygun hedefli test/build, bağımsız review, normal browser ve SQL farkı kaydedilir. Personel kabulü olmadan ilgili yaprak 🟡 kalır. LIVE/Vega yazması, main merge, gerçek ticari kartlarda test yazması, credential değişikliği ve geri dönüşü zor işlem bu teknik yetkiye eklenmez.

Güncel yerel kaynak toplama: [3 Ekim kanonik baseline](docs/erp-v2/canonical-20261003/README.md). Aşağıdaki ilk envanter, EVDEKIPC devir anının tarihsel kaydıdır; SEMIH kaynak eşlemesi bu bağlantıdaki kanıtla güncellenir.

Güncelleme: 5 Ekim 2026. Bu dosya ERP bitirme işinin **tek güncel kaynağıdır**. Kısa görünüm: [STATUS.md](STATUS.md). Kaynak ve ortam kanıtları: [envanter](docs/erp-v2/inventory-20261003.md).

## 4 Ekim güncel migration dilimi

Vega → Melisa gerçek TEST açılışı ve bağımsız stok/cari/fiyat/maliyet mutabakatı tamamlandı; exact kapsam fark0, genel cutover PARTIAL. Kabul edilmiş fiyat okuyucusu önceki PASS kapsamıyla korunur. Sonraki gerçek açık olan operasyon karantinası kapandı: 176 kaynak/172 hedef/4 hedefsiz tedarikçi, immutable kimlik bağı ve API/SQL işlem engeli; 21 hedefli test, bağımsız37 tablo koruma ve gerçek normal kullanıcı negatif API/masaüstü/mobil provası PASS. Günlük [Aktarım karantinası](http://127.0.0.1:5194/is-akisi-taslagi.html#migration-quarantine) personelin kabulüne hazır; insan kabulü BEKLİYOR.

Güncel kaynak codex/canonical-live-20261003; SQL/ticari kod45959295421c61b40bf49b1cc51bcb01dce784f4/paket15, nihai dokümantasyon TEST paketi CANONICAL-VEGA-MIGRATION-TEST-20261004-16. Zorunlu launcher C:\Sirket\ERP\runtime\start-canonical-test.ps1, web5194/API4144/native4146; yalnız ayrı TEST DB. LIVE/Vega yazımı yok. [Migration planı](ERP_MIGRATION_PLAN.md), [STATUS](STATUS.md), [PR15](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/15).

Sıradaki migration kaynak eksiği güncel deltanın ayrı idempotent TEST batch'iyle prova edilmesidir; 71 yeni/341 değişmiş ürün ve74 cari henüz uygulanmadı. Typed fiyat yazımı, belirsiz kimlik/bakiye/maliyet iş kararı, fiziksel finans, atomik kesim ve geri dönüş kabulü açık. Önceki çok satırlı mal kabul ve fiziksel terminal işleri ayrıca açık ERP kapsamlarıdır; bu görev çalışan bağlı iade/satış akışlarını yeniden ispatlamadı.

## 3 Ekim SEMIH sonucu — tamamlanan önceki dilim

Kanonik kaynak `C:\Sirket\ERP\source\canonical-live-20261003`; origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`, aktif dal `codex/canonical-live-20261003`. Kullanıcının son talimatındaki bu kök uygulanır. F02 kaynak eşlemesi, F03 dosya sınıflaması ve önceki F05 teknik kabulleri korunur; çalışan satış/tahsilat/sayım yeniden ispatlanmadı.

Bulunan ilk gerçek eksik kapatıldı: **mal kabulden yeni alış faturası → aynı faturanın kendi satırından mal iadesi**. Önce iade ekranı farklı, sabit bir TEST faturası kullanıyordu. Yeni bağ kaynak fiyatı/kalabilecek miktarı gösterir; taslak etkisizdir, yetkili onay gerçek SQL stok/borç etkisi üretir. Aktif iadeli kaynak fatura iptal edilemez; iade ters kayıtla kapatıldıktan sonra iptal edilebilir. Alış kalan borcu onaylı iadeyi de düşer.

Fatura #25083 / satır #93181 → iade taslağı #31 → iade #223: 1 ADET ve 60 TRY borç ters etkisi; ters kayıtta ikisi de geri geldi. Kasa/banka hesapları ve hareketleri aynı. 10 API + 4 UI hedefli test, 14 gerçek tarayıcı kontrolü PASS. SQL'deki iki stok, iki tedarikçi ve iki audit kaydı korunur. İlk audit kapsam reddi bütünüyle rollback edildi; aynı taslaktan devam edildi. Toplam alış istek geçmişinin 30 kayıt engeli kaldırıldı; geçmiş boyutu iptal/ters kaydı kilitlemez. Yeni ticari kural, tablo veya kolon eklenmedi.

Son TEST paketi `CANONICAL-LINKED-RETURN-TEST-20261003-05`; tam commit ve hash paketin `release-manifest.json` dosyasında. Launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`, ekran `127.0.0.1:5194`, API 4144, native 4146 salt okunur. DB `MELISA_ERP_SIRKET_TEST_20260929_01`; LIVE erişimi/dış işlemler kapalı. [Yeni kabul](docs/erp-v2/canonical-20261003/linked-purchase-return-acceptance.md) · [Teslim](docs/erp-v2/canonical-20261003/delivery.json).

**Sıradaki insan kabulü:** bu bağlı akışı günlük iş sırasıyla TEST ekranında görmek. Bu akış ayrılmış kayıtlarla iş kabulüne hazırdır. **Sıradaki gerçek kaynak eksiği:** çok satırlı mal kabul/ayrıntılı alış taslağı; fiyat kartı yazımı ve fiziksel native kabulü de açık. Önceki “kalan tek iş insan kabulü” ifadesi eski dar teslim kapsamına aitti; tüm ERP tamamlandı anlamına gelmez. LIVE geçişi yapılmadı.

Aşağıdaki eski host envanteri ve F02 bekleme anlatısı tarihsel devir kaydıdır; güncel durum yukarıdaki bölüm ve STATUS'tur.

## Çalışma ilkesi ve mevcut durum

**Çalışanı koru; kanıtlı kabulü yeniden açma; dağınık kaynakları eşleştir; yalnız gerçek eksikleri düzelt.** Mevcut çalışan ERP işlevsel baseline'dır. GitHub'da en yeni tarihli dosya veya `main` etiketi, kendiliğinden çalışan sürüm anlamına gelmez.

ERP sıfırdan yapılmayacak. [9 Temmuz insan kabulü](docs/erp-v2/final-human-acceptance-log.md) ve Eylül ayındaki sınırlı gerçek SQL/tarayıcı kabulleri korunur. Bunlar kendi sürüm ve kapsamlarında geçerlidir; yeni bir ortamın tamamı için otomatik kabul sayılmaz. Bir özellik ancak somut hata, ilgili kod değişikliği veya farklı veri kaynağı varsa yeniden incelenir.

3 Ekim'de inceleme **EVDEKIPC / WARD-V2** üzerinde başladı. Yerel eski kaynaklar ile GitHub incelendi. **SEMIH'teki çalışan kaynak, tüm worktree'ler, TEST/LIVE süreçleri ve gerçek DB kimlikleri henüz doğrudan envanterlenmedi.** Bu nedenle kanonik deployment seçimi ve TEST kurulumu tamamlanmış değildir. Kullanıcı aynı sohbeti SEMIH'e geçiremediğini ve orada yeni sohbet açacağını bildirdi. Devir kaynağı bu dosyadır; kullanıcı uzun görev metnini yeniden taşımayacak. Yeni sohbette önce araçların host/çalışma yolu kontrol edilir.

Bu oturumda mevcut ERP kopyalarına, servislere veya ticari verilere müdahale edilmedi. GitHub `main`den bağımsız `codex/erp-finish-20261003` dalında dokümantasyon hazırlanıyor. Bu dalın tabanı `577c0cb9d0953635b30088fa23e1e887c7b75775`; LIVE tabanı olarak kabul edilmedi.

## Yetki ve ilerleme

Kullanıcının 3 Ekim talimatı, TEST'te gerekli kod düzeltmesi, restart, branch/commit/push ve testleri ayrıca onay almadan yürütmeye izin verir. Eski dokümanlardaki genel onay maddeleri bu yetkilendirilmiş işler için tekrar onay döngüsü oluşturmaz. İşe ek bridge, test kotası veya yapay onay paneli eklenmez; uygulamanın gerçek kullanıcı yetkileri ve ticari veri bütünlüğü korunur.

Yalnız geri dönüşü zor LIVE değişikliği, veri kaybı, gerçek ticari kayda istenmeyen yazma veya credential riski için açık onay istenir. TEST adlı bir servisin gerçekten ayrı DB'ye bağlı olduğu anlaşılmadan ticari test yazımı yapılmaz. Şifre, token, connection string, müşteri dökümü, yedek ve ortam dosyası Git'e girmez. Eski kopyalar kanıtlanmadan silinmez.

## Tek repo ve ortam düzeni

Mevcut `melihsnyldzz-ui/melisa-erp-v2` ailesi korunacak; yeni ERP reposu açmaya şu an gerek gösteren kanıt yok. Uygulanacak düzen:

| Parça | Hedef | Bugünkü durum |
|---|---|---|
| Kaynak | Tek ERP repo; web/API/native terminal ve gerekli ortak sözleşmeler burada | GitHub aile ve dalları bulundu; SEMIH kaynakları eksik |
| `main` | Kabul edilmiş kaynak; çalışan LIVE sürümü ayrıca tam commit ile kayıtlı | Mevcut `main` ile LIVE eşitliği bilinmiyor |
| `candidate/test` | Çalışan baseline üzerine yalnız seçilmiş eksik/düzeltmeler | Çalışan baseline eşleşmesinden sonra kurulacak |
| TEST | Web 5194 → API 4144 / native 4146; tek launcher ve açık TEST etiketi | Kullanıcının bildirdiği düzen; güncel yerel süreç/DB kanıtı bekliyor |
| LIVE | Web 5188 → API 4114 / native 4116; sabit sürüm ve geri dönüş kaydı | Kullanıcının bildirdiği düzen; mevcut çalışma korunuyor |
| Geliştirme | API 4100; TEST/LIVE ile karıştırılmaz | SEMIH Tailscale adresinden health/version yanıtı alındı |
| Vega | VEGA2026 kaynak bağlantısı ayrı kaydedilir | Kaynak rolü biliniyor; güncel server/instance/firma/dönem eşlemesi eksik |

Her deployment kaydı yalnız host, checkout yolu, branch, tam commit, varsa yerel fark özeti, web/API adresleri, servis/launcher adı, DB server/instance/adı, rolü ve son kabul bağlantısını içerir. Gerçek secret içermez. Host görülmeden yeni port, ikinci TEST veya tahmini DB yaratılmaz. Geri dönüş; önceki uygulama sürümü ve yapılandırmasıyla yapılır, iş kayıtlarını silerek yapılmaz.

## Önce yapılacak somut işler

| İş | Durum | Tamamlanınca görülecek sonuç |
|---|---|---|
| F01 — EVDEKIPC ve GitHub kaynak envanteri | Tamam, kapsamı sınırlı | 10 mevcut ilgili repo + bu inceleme checkout'u, korunacak yerel farklar, 14 uzak dal kayıtlı |
| F02 — SEMIH çalışan kaynak eşlemesi | SEMIH erişimi bekliyor | LIVE/TEST süreç → dosya → commit → DB haritası; native backend dahil |
| F03 — Değerli adayları çalışan kaynakla uzlaştırma | Karşılaştırma kısmen hazır | Her fark için zaten mevcut / alınacak / gereksiz kararı; eski kopyalar korunur |
| F04 — Tek TEST çalıştırma ve sürüm kaydı | F02'ye bağlı | Kullanıcının açabildiği 5194 ve doğru TEST API/DB bağlantısı |
| F05 — Gerçek iş akışındaki açık eksikleri kapatma | F02 sonrası hata bazında | Her düzeltme TEST ekranında görülebilir; bilinen kabuller tekrarlanmaz |
| F06 — Günlük kullanım ve LIVE geçişi | Açık | Kabul edilmiş TEST sürümü, somut kalan riskler ve gerektiğinde tek LIVE onayı |

F02 için SEMIH'te ilk bakılacak yerler: çalışan süreçlerin gerçek dosya yolları; `C:\Sirket\ERP`; `C:\Users\Xaser\Documents\Codex\2026-09-30\task`; kullanıcı GitHub/Codex worktree dizinleri. Bunlar geçmiş kayıtlardan gelen arama başlangıçlarıdır, güncel kanıt değildir. Eski `ERP_STATUS.md` ve teslim paketleri silinmez. Önceki erişim/gate metinleri yeni iş listesi gibi kopyalanmaz; yeni hostta gerçek erişim ve mevcut çalışan durum esas alınır.

## İşyerinin günlük akışı

“Mevcut/kabulü kayıtlı” yeniden geliştirme işi değildir. “Eşleme eksik” de özellik bozuk demek değildir. Her açık satır yalnız somut eksik bulunduğunda kod işine dönüşür.

| İş akışı | Korunan çalışma / kayıt | Gerçekten tamamlanacak nokta |
|---|---|---|
| Sabah gelen malı sayma, barkod indirme/etiket | Ürün/barkod ekranları mevcut; stok sayımı için Eylül tarayıcı/SQL kabulü var | SEMIH'te kullanılan mal kabul ve barkod indirme yolunu eşleştir; eksik veya çalışmayan indirme/etiketi düzelt |
| İlker'in alış, stok ve fatura girişi | Eylül kabulünde 10 × 12 TRY alış: stok 10, tedarikçi borcu 120; taslak etkisiz | Çalışan ekrandaki karşılığı ve açık hatalar; tüm alış modülünü yeniden yapma |
| Terminal satışı ve stok düşümü | ERP Core satışı kabul edilmiş; terminal mükerrer gönderim/transaction için ayrı gerçek SQL kabulü mevcut | Native istemci ile çalışan native API kaynağını eşleştir; mevcut kabulün hangi sürüme ait olduğunu koru |
| Muhasebenin eşzamanlı tahsilat/kasa/cari işlemi | 20 tahsilat + 10 ödeme; cari 40, tedarikçi 110, net kasa 10 örneği kayıtlı. Kasa kapanışı/çakışma düzeltmeleri ayrı dalda | Çalışan kaynakta bu düzeltmelerin bulunup bulunmadığı; yalnız eksik farkın eşzamanlı akışı |
| KDV toplamda | Kullanıcının açık gereksinimi | Mevcut fiş toplamı, indirim sonrası KDV ve çıktıyı incele; eksikse toplamda gösterimi düzelt. Vergi oranı uydurma |
| USD / EUR | İşlem anı kur snapshot'ı, ayrı döviz kasa ve eksik kur görünürlüğü için mevcut çalışma/kabuller var | Güncel kaynakta doğru dalı koru; farklı dövizleri tek para gibi toplama; eksik kuru 1 veya 0 sayma |
| Açık hesap | 26 Eylül şirket kararı: yetkili açık hesap satışı tahsilat olmadan cari borç oluşturabilir | Güncel uygulanmış akışı ve yetki/limit/vade bağını eşleştir; satışa sahte tahsilat ekleme |
| Tedarikçi borç / ödeme / dönüş | Alış borcu ve ödeme kabulü; tedarikçi hareketleri mevcut | Tedarikçiye mal dönüşünün gerçek ekranı ve stok/borç/ödeme etkisindeki eksikler |
| Müşteri iadesi | Satış iptali kabulü mevcut; iptal otomatik nakit iade değildir | Kısmi/tam mal iadesi, cari alacak ve gerekiyorsa ayrı ödeme akışının mevcut kapsamını bul; eksik kısmı tamamla |
| Sayım / fark | Gerçek tarayıcı 5→7→6→8; üç hareket, üç audit; neden/yetki/stale kontrolleri kayıtlı | Bu sürümün çalışan kaynakta olup olmadığını eşleştir; aynı kabulleri sırf belge için yeniden çalıştırma |
| İptal / düzeltme | Gerçek servis/SQL kabulünde mükerrer iptal tek etki; kapanmış kasaya parasal düzeltme engeli | Güncel TEST'e alınacak fark varsa yalnız etkilenen akış; geçmiş fişleri silme |
| Son alışa göre fiyat / maliyet | Son net alış maliyeti ve ağırlıklı ortalama maliyet ayrı mevcut kavramlar | İlker'in kullandığı son alış fiyatının öneri ve ekranda görünmesi; geçmiş satış maliyet snapshot'ını güncel fiyatla ezme |

## Değerli kaynaklar ve kabulün devri

- `codex/commerce-erp-quality-20260908` (`f787cfe…`), mevcut `main`den 64 commit ileride; 275 dosya farkı var. Terminal satış güvenliği, kasa/fiş/sayım/döviz/rapor ve çıktı düzeltmeleri içeriyor. Hepsini körlemesine birleştirme. SEMIH'te zaten olanları ayır, yalnız eksikleri aktar. [Kabul kayıtlarının dizini](docs/erp-v2/inventory-20261003.md#korunan-kabul-kayıtları).
- `review/erp-simplification-20260915` (`aea716f…`): 1 commit, 10 dosya; menü sadeleştirmesi ve kanıtsız “hazır/eksi stok yok” etiketlerinin kaldırılması. Ticari kabul veya native backend teslimi değildir. Commerce dalıyla ortak menü dosyaları var; kaynak okunarak uzlaştırılmalı.
- `codex/native-terminal-source-20260929` (`552491b…`): 1 commit, 74 dosya; native Android candidate.18-t2 kaynak koruması. **Uyumlu native backend bu teslimde yok.** Android kaynağını main'e almak tek başına terminal entegrasyonunu bitirmez.
- Mayıs/Haziran EVDEKIPC kopyaları ve değiştirilmiş UI/terminal dosyaları envanterde korunuyor. Son tarih tek başına değer ölçüsü değildir; kullanıcı farkları kaybolmaz.

## Kabul ve bitiş ölçütü

Bir düzeltme için kayıt: sorun → değişen dosya/commit → TEST adresi → iş ekranındaki sonuç → stok/cari/kasa etkisi → kalan somut eksik. Otomatik test/HTTP 200 yalnız teknik destek kanıtıdır. Önceden kabul edilmiş değişmeyen özellikler yeniden açılmaz. Yeni/düzeltilen akış kullanıcıya gerçek ERP ekranında gösterilir; iş kabulü kullanıcının gördüğü sonuca bağlanır.

Son teslim: tek kanonik kaynak; tek anlaşılır TEST/LIVE eşlemesi; korunan eski kopyalar; bu plan ve kısa STATUS; sabah mal kabulden satış/tahsilat ve gün sonuna günlük kullanılabilir ERP. **Bu teslim henüz tamamlanmadı.** Mevcut sonraki adım F02'dir; sırf yeni sprint üretmek için özellik açılmaz.
