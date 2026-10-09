## ERP-STAGE0501 — Aşama 5 canlı öncesi eksikler — 9 Ekim 2026

ERP-DEC-034. Önceki migration yeniden uygulanmadı. 22 UNKNOWN belgeden dört mevcut TEST siparişinin exact journal/native/guard bağı kanıtlandı; ticari etkileri 0. Kalan 18 belge UNKNOWN (11 tamamlanmış, yedi iptal). 1.151 boyut/hesap engeli ve 179 atanmamış cari hareket bağlantısı kayıt bazında korundu; iptal net sıfırı bilinmeyen depo/birim/kökeni çözmez. 39 kasa hesabının matematiksel kapanışı doğrulandı fakat gerçek açılışa hazır 0; beş kaynak isim/döviz grubu dar Vega D0007 SELECT-only bağıyla çözüldü. Kaynak/yerel/sentetik ayrı; yeni finans tutarı veya otoritesiz açılış yazılmadı.

Güncel TEST125 yedeği COPY_ONLY/CHECKSUM/SHA/VERIFY ile alındı ve yeni Stage5 inverse TEST'e gerçekten restore edildi. Aktif/orijinal TEST ve Stage4 kopyası restore/reset edilmedi; önceki kanıtlar korunur. İzole committed kaynak inverse343stok+59döviz hesabı/46fiyat/34kart grubu gerçekCOMMIT;3manualCASalanı ve6sonrakiCOMMITsentetikprova korunur. Fault tüm native adımlardan sonra gerçekten BEFORECOMMIT rollback oldu;9tam native/704diğer tablo+sütun/journal/guard koruması eş. Replay0/farklıbodyret. Bağımsız22SELECT/0write343stok59hesap/47fiyat35kart/402eski hareket59audit/224noop159hassasiyet/eski16/572nativewithdrawalvarlığı doğrulandı. Fiziksel silme0, eski16.671ürün/64.015fiyat üyeliği currentnative değerle korunur. Çalışan normal ERP inverseprojeksiyonuna geçirilmedi; genel/LIVE otomatik recovery değildir. [Kanıt](docs/evidence/erp/2026-10-09-stage5/README.md). Normal günlük zincir mevcut Stage4 kayıtlarıyla tek 18 dakikalık turdadır; ERP-UA28/UA27/UA18 bekler. CI hesap engeli açık; gerçek T1/LIVE/Vega/CRM/main yok. Bu aşama sonunda **DUR**.

## ERP-STAGE0401 — Aşama 4 açılış etki ayrımı — 9 Ekim 2026

ERP-DEC-033. Eski160 sentetik işlem/taslak/ters kayıt bağı ve241 native etki kimlik/journal/profile ile ayrıldı; UNKNOWN22 belge/taslak ve ayrı stok/cari/kasa etki adayları tahminle sınıflanmadı. V02, yeni restore kopyasında18.096 satır/89.410 bileşenin SQL muhasebe projeksiyonudur; kaynak+kanıtlı gerçek yerel korunur, sentetik hariç, UNKNOWN engel. Native belge/defter silme ve ana stok/bakiye overwrite yok. Bağımsız exact8 kaynak/yerel/sentetik/UNKNOWN kapanışı0 fark. Stok16.426/cari273 READY; kasa0 READY,39 somut engel. TRY/USD/EUR ve ürün/depo/birim ayrı kalır. [Kanıt ve sınıflar](docs/evidence/erp/2026-10-09-stage4/README.md).

Yeni izole normal günlük prova17 isteğin20 etkisini ISOLATED_TEST_COPY → SYNTHETIC_LOCAL journal'ıyla izler. Bunlar gerçek şirket kaynak kartları kullanılsa da gerçek yerel/açılış sayılmaz. V02 sonrasında oluşan yeni kopya etkileri ayrı kanıtla korunur; gelecek gerçekT1 writer'ı bu tur çalışmaz. Aynı UUID/body replay ikinci ticari etki0, farklı body ret. Önceki ürün/cari/alış/maliyet/medya/hold/rol teslimleri yeniden migrate edilmedi; orijinal TEST29 veri/337 modül/9.048kolon aynı.

COPY_ONLY/CHECKSUM/SHA/VERIFY yedek ve iki yeni raw restore gerçekten yapıldı;29 kritik veri+337modül/native şema eş. Orijinal/aktif DB restore/reset yok. Günlük ödeme/sayım/alış iadesi committed ters kayıtları kanıtlı. Bütün PRODUCTCOMPLETION01 ve283 CARICOMPLETION01 batch'i için sonraki gerçek hareketleri silmeden committed toplu inverse bu tur yapılmadı; eski16'nın dar kanıtı bu kapsamı kapatmaz. UNKNOWN/kasa/banka/istisna/insan-cihaz/CIhesap engeli/gerçekT1 somut açık kalır. TEST125/sourceedb3c89; ERP-UA27 bekliyor. **Bu aşama sonunda DUR; finalT1/LIVE/Vega/CRM/main yazması yok.**

## ERP-PRODUCTCOMPLETION01 — Aşama 3 uygulanmış TEST alt kapsamı

ERP-DEC-032 / ERP-PRODUCTCOMPLETION01: kesin ürün alt kapsamı TEST'e uygulandı; ERP-UA26 insan kabulü bekliyor, teslim sonunda DUR. [Aşama 3 kanıtı](docs/evidence/erp/2026-10-08-product-completion/README.md). F0102 / D0007 görüntüsü **08.10.2026 20:28:57 TR**; atomik final T1 değildir. Şirket/tablo/IND ve önceki Goal7/açılış stok katkısı korunur. Eski 86/752 sayıları kendi tarihsel kapsamıdır. **72 yeni kart, 310 mevcut native satır** (4 ana alan), **109 doğrulanmış ADET/1 barkod bağı, 72 yeni ana birim bağı, 343 ürün-depo kaynak farkı, 319 yeni / 47 güncellenen satış fiyatı** uygulandı. Yeni görünüm 16.743 ürün / 64.333 fiyat; eski immutable sürümler ve native geçmiş korunur. Kaynağın 53.084 kartının tamamı aktarılmadı.

Stok yazımı kaynak A − önceki katkı B'dir; gerçek yerel C / kimlikli sentetik D ayrıdır. Toplam TEST stoğu A diye ilan edilmez. Etkisi ayrışmayan 185 stok ve 1.990 negatif kaynak miktarı alanı korunur; bağımsız kesin alanlar uygulandı. 61 tam bekleyen kart: 55 eski yayımlanmamış (54 hold), 5 tür kanıtı eksik, 1 kod çakışması. Diğer alan istisnaları: 9 döviz tuple'ı, 5 barkod sahipliği, 1 manuel/kanıtsız eski fiyat. Sayılar çakışabilir. Bilinmeyen birim/çarpan/döviz/maliyet, 0 veya ADET/1 tahminiyle doldurulmadı. Kaynaktaki gerçek sıfır ayrıca korunur; bedelsiz satış izni değildir.

Tek owner transaction, exact CAS, mevcut guard ve batch journal kullanıldı. Aktarım source 5ecddf4; okuyucu source 63f0a017. Bağımsız SQL bütün 1.272 native after-image, 14.563 stok kapanışı, 16.743 ürün / 64.333 fiyat bindingini doğruladı. 382 değişen kart + 2 koruma örneği normal API'de 384/384 PASS. Commit sonrası replay 0 / farklı body ret; bütün yazımlar sonrasındaki hata transaction içinde geri alındı, 73 veri kümesi ve şema eş. COPY_ONLY/CHECKSUM/HEADERONLY/VERIFYONLY yedek doğrulandı; aktif/izole restore yapılmadı. **Bütün PRODUCT kart/barkod/fiyat/görünümünü kapsayan committed inverse henüz uygulanmış/kanıtlanmış değildir.** Eski stok/fiyat inverse aritmetiği yalnız offline uyumluluktur; geçmişi koruyan tam kurtarma final geçiş öncesinde açık.

283 cari / 59 hareket, önceki 16 hesap, iki LL / 770 dış kapsam, 4.338 net alış referansı / 6.090 maliyet, 3.830 fotoğraf / 67 belirsiz, roller ve holdlar 73 hash kümesinde korundu. R2/R3 okuyucu yayımlarında ticari yazma 0; önceki modüller ve kaynak sürümü aynı. Uzun JSON birimi ve canonical timestamp düzeltildi; korumalar gevşetilmedi. **TEST113 / source 63f0a017ec23e89ca9aab7e44acb051f4e86479a**, normal 50 ürün, beş örnek ve hız kanıtlı. Yeni cari/maliyet araştırması, ödeme paneli veya tasarım işi açılmadı. İnsan kabulü ve genel final kapsam bekler; sonraki aşama başlatılmadı.

## ERP-CARICOMPLETION01 — ERP-DEC-031 / 8 Ekim 2026

Kullanıcının sabitlediği 283 hesap yalnız TEST'te uygulandı: 59 fark, 224 ikinci finans hareketi olmadan doğrulama, 0 hata/drift ayrılması.159 kayıpsız hassasiyet ve157 ana kart gösterge eşitlemesi tamam; önceki16,770 dış kapsam veikiLL korunur. Güncel source/target kontrolü, gerçek yedek/atomic rollback, bağımsız SQL/API283/283, committed replay0 ve normal üç kart kanıtlı. Son TEST107/source6c31585; [teknik sonuç ve sınırlar](docs/evidence/erp/2026-10-08-current-party-application/README.md).

Bu onaylı TEST uygulaması gerçek T1/LIVE kesimi değildir. Commit sonrası bu batch'in inverse uygulaması çalıştırılmış sayılmaz; doğrulanmış yedek ve before-image geri dönüş kanıtları korunur. ERP-UA24/25 insan kabulü bekler. Bu dar teslim sonunda **DUR**; kalan hesap, yeni migration, Vega/LIVE/CRM/stok/satış fiyatı/main yok. Aşağıdaki onay hazırlığı ve önceki teslim kayıtları tarihsel kapsamlarıyla korunur.

## ERP-MIGUNIFIED01 eki — ERP-DEC-029 / 8 Ekim 2026

TEST100/sourcecc4c4601ec0a: belge→kanıtlı giriş→kart öncelikli son net alış V2 metadata16.667 kayıtta uygulandı.4.338 belge net/0 giriş/5.076 kart/7.253 bilinmeyen-manuel,12.329 netNULL;1 kimlik drift dışarıda. Eski16.668 V1 ve6.090 native maliyet korunur. Native stok/satış fiyatı/cari-finans/hold/roller ve47 hesap onay paketi değişmedi. Yeni yedek, CAS/readback/replay0, normal opt-in kart ve exact source CI kanıtlı. [Teslim](docs/evidence/erp/2026-10-08-last-net-purchase/README.md).

Bu dar metadata eki genel migration veya ortalama maliyet bitişi değildir; ERP-UA24/25 bekler. GerçekT1, Vega/LIVE/CRM/main merge veya yeni finans yazması yok. Ek tamamlandı; dur. Aşağıdaki önceki paket/prova kayıtları tarihseldir.

## Goal8 — teknik tamamlandı / insan kabulü bekliyor — 7 Ekim 2026

ERP-DEC-026 kapsamı: son TEST94/source `cee7d7a85b4c797732cfcba8967855f2efbad55b`, 45normal ekran (15×1440/1024/390),13rol,7native rapor, dokuz aşamalı bağlı sentetik gün/replay0, final stok/fiyat/cari writer-reader/inverse/parent recovery native kanıtı ve güncel hız teslim edildi. **49toplam /9🟢 /39🟡 /1🔴**; D02/D06/E01/E02/E03🟡, D01 güvenli karantinada🔴/CANLIDAN SONRA. [Teknik kanıt ve kısa insan listesi](docs/evidence/erp/2026-10-07-goal8/README.md).

İnsan PASS yok; USER_ACCEPTANCE/ERP-UA24 bekler. Gerçek ticari işlem seçici kapsamı, kullanılacak cari kanıtı, gerçekT1/FINAL API-browser-CRM aktivasyonu ve fiziksel/kurtarma kabulü LIVE öncesi açıktır. Vega/LIVE yazması, gerçekT1, müşteri gönderimi ve main merge yapılmadı. Goal7.3 drift normal; eski batch tekrar edilmedi. **Goal8 sonunda DUR; sıradaki tek iş kullanıcıyla15–20dk kabul turu.**

Aşağıdaki kayıtlar tarihsel teslimlerdir; güncel runtime ile karıştırılmaz.

Final adapter teknik sınırı: ayrılmış sentetik native SQL prova, müşteri/tedarikçi altı döviz hesabı,16671ürün/63775typedfiyat normal SQL okuyucu forward/inverse; immutable NULL/hold/source-hash/CAS ve parent recovery korunur. Önceki committed fark ikinci kez uygulanmaz. Final collector gerçek kaynağa çalıştırılmadı; normal FINAL API/browser/CRM aktivasyonu, güncel kaynak kapsamı ve gerçek cutover onayı ayrı. Goal7.3teki16hesap delta yeniden çalıştırılmadı.

## Final cutover hazırlığı — 7 Ekim 2026 / ERP-DEC-025

Goal7.3 **TEST cari delta mekanizması teknik olarak kanıtlandı** olarak korunur. Üç örneğin dar insan ekran kontrolü tamamlandı; sonraki Vega bakiye değişikliği normal kaynak driftidir. **ERP-UA24 bekliyor, PASS değil.** [Ortak stok/fiyat/cari final T0-T1 prosedürü](docs/erp-v2/canonical-20261007/final-cutover-procedure.md) 10 kullanıcı adımı ve teknik kalan-fark/replay/inverse sözleşmesini içerir.

Yeni saf `final-cutover-plan.mjs` mevcut Goal7.3 exact/replay/inverse yardımcılarını kullanır; önceki committed kaynak farkını tekrar uygulamaz, yerel Melisa etkisini korur, fiyatı kendi döviz/birim/kademe sürümüyle ele alır. **13 yeni sentetik offline test geçti.** SQL/dosya/ağ/CLI yazıcısı yok; `executeAllowed:false`, `financialWriteAuthorized:false`; yalnız kanonik TEST hedefi. Final T1 collector, gerçek journal bağlayıcısı, genel müşteri/tedarikçi writer/reader ve parent recovery henüz uygulanmadı; gerçek kesim/onay bekler. Bu kayıt final uygulama hazır veya insan kabulü tamam demek değildir.

Bu tur yeni finans/cari/stok/fiyat yazması, kaynak capture, yedek/restore, paket/restart/deploy, Vega/LIVE/CRM veya main merge yapılmadı. Önceki Goal7/7.3 native kanıtları yeniden yapılmadı. Çalışan TEST86 uygulama kaydı source769031c olarak korundu; kaynak hazırlık commit'i yeni runtime değildir. Finish **49 toplam / 9🟢 / 34🟡 / 6🔴** değişmedi; D02/D06 açık, D07 kısmi. GitHub teslimi mevcut dal/PR23'te; final HEAD CI makbuzu ayrı doğrulanır. Bu hazırlık tesliminden sonra durulur.

Aşağıdaki kayıtlar önceki turların tarihsel kanıtlarıdır.

**7 Ekim 2026 — Goal7.3 / ERP-DEC-024: teknik tamamlandı, insan ERP-UA24 bekliyor.** Onaylı16 tedarikçi hesabı (14TRY/2USD):15 fark uygulandı,1 no-op aynı. Bağımsız SQL/API16/16;15 hareket/15audit/16journal/1committed run;37eski veri koruma kümesi ve5yetki-holdscope aynı. Committed replay0, farklı body reddi; yeni COPY_ONLY/CHECKSUM/VERIFYONLY yedek ve3sentetik inverse kanıtı. TEST86/source769031c;writer c9e0629;normal yeşil dört örnek doğrulandı. 488API/618ekran/55migration PASS, exact sourceCI3/3 SUCCESS. [Rapor](docs/erp-v2/canonical-20261005/goal73-supplier-delta.md). Finish49/9🟢/34🟡/6🔴 aynı;D02/D06genel açık. Bu dilimden sonra DUR;başka aktarım/CRM/LIVE/Vega/main yok.

Parent Goal7.2v04 read-only manifest financialWriteAuthorized:false aynıdır; yeni approval-bound execution manifest ile yalnız15 fark işlendi. Gerçekcutover/T1/diğer cari aktarımı, hold kaldırma ve LIVE/Vega write yetkisi verilmedi.

## Goal7.2 rapor mutabakatı — 7 Ekim 2026

ERP-DEC-023;[rapor](docs/erp-v2/canonical-20261005/party-currency-report-reconciliation.md). Hash-eş iki Vega export kapsamı kullanıcı teyitli;üretim saati/atomikT1yok.57hesap için46sabit gösterim/7zaman-sürüm/1tutar farkı/3(-).16strict-ready(14TRY2USD,hepsi tedarikçi):15delta+1no-op.30gösterim-hassasiyet ve önceki27carry/4newcard/2LL ayrıbekler. Nativeaçılış+korunacaklocal+mapdelta önerisi private;writer/create/holdlift0.9modeltest+real16verify/replay+4negatif geçer;12finance/2reader/5auth-holdhashaynı. D02/D06/UA24/finish renkleri korunur;TEST84aynı,başka işe geçilmez.

## Önceki Goal7.2 — rapor teyidinden önceki araştırma

ERP-DEC-022/[rapor](docs/erp-v2/canonical-20261005/party-currency-transfer-readiness.md).4absent tedarikçi→ayrıNEW_CARD_REQUIRED;gerçekcreate/link0. 3806source hareket/3806exacttypediptalsizhead,86Jan1openinghead. 84nativeopening+localmutabık araştırma hesabı içinde57carry+dönem belgesi kanıtlı,27explicitcarryeksik(14prior2025). Kaynak10cari14changed/new1deleted;4projection two-passstable/non-atomic. Tarihli independentVegaFXreport0;arşivSQL/FR3aktifversion yerine geçmez.209privateaccountmatrix:0KANITI TAMAM/203KANIT EKSİK/2LLİŞLETME KARARI/4EŞLEŞME YOK.

Salt okunur saf plan/verify+replay;SQLwriter yok. SourceDelta=newVerifiedSource-oldAcceptedSource;suppliernativeişaretayrı;expected=acceptedOpening+preservedLocal+mappedDelta. Yanlış eskiopening yorumu ayrıcorrectionplanıister. Sonraki ayrı onaylıTEST için kanıtlıaltkapsam+backup+source/hold/nativeguard+immutablebatch/replay0+independentmutabakat+laterlocalpreservinginverse önerilir;bu turbu işlemler yapılmadı. LLkaynak104açılışbelgeleri bulundu;eskiTLalternatif+5deneme açıklaması tekrar sorulmaz,LLconvert/zero0. D02/D06/UA24renkleri korunur;LIVE/Vega/CRM/mainmerge/cari/financewrite0. Dış rapor ve27hesabın carry kanıtı bekler;başka işe geçilmez.

## Goal7.1 — 7 Ekim 2026, cari gösterimi ve aktarım planı

ERP-DEC-021: cari türü/rolü ve ayrı hesabın Döviz Bakiye tutarı+para birimi+B/A birlikte korunur. Genel Bakiye/hamBAKIYEekleme yok; varsayılan döviz diğer hesapları gizlemez. [200 cari karşılaştırması ve güvenli kalan aktarım planı](docs/erp-v2/canonical-20261005/party-currency-comparison-plan.md).

122hold+78dış değişmiş cari;196exactnativebağ/4eksik,209hamFXgrup/124kayıtlınet/83hareketsiz/LL2. 3799tekil hareket/192bağımsızSQLgrup fark0. 84açılış+yerel native hesap/defter mutabık;84sayısal aday/77sıfırdışı fark fakat finansuygulanabilirliği tamam0. 103/104 açılış adayı, dönem ve 30/31 ayrı;2025ekleme0. Tarihsiz qqq aynı tarih/kapsam tutar kabulü değildir. Finanswrite0/holdlift0;gerçekcutover/Vega/LIVE/CRM/mainmerge0. D02/D06açık,ERP-UA24bekler;finish49/9🟢/34🟡/6🔴 değişmez. Goal7.1 tesliminden sonra durulur.

## Goal7 —güncel7 Ekim2026

7 Ekim2026 **Goal7 / ERP-DEC-020 — Faz B teknik tamamlandı, insan kararı/kabulü bekliyor:** Güncel SELECT-onlyT0/privateMelihpaketi;563stockatom+49new/12master,241+16typedprice/62barcode gerçekTEST. Replay0/nativefark0/committedinverse yeni count/audit korunumu ve yeni backup kanıtlı. TEST83/sourcee2ffea6c;cari/FXwrite0. **49/9🟢/34🟡/6🔴**. UA19–23bekler. [Kanıt](docs/evidence/erp/2026-10-07-goal7/README.md). Goal7 sonunda DUR; gerçekcutover/Vega/LIVE/CRM/mainmerge yok.

T0 a681b7f98003fa1c61dc57bda25f725536849efadc0d823f81c875c4909b53e4;00:40:52–00:41:05TRT/8projection/iki geçiş sabit,atomikT1 değil.86new/752changed/29customer56supplier;eski71/341/74 tarihsel. Kapsam16759+13quantityreview/6109known10650unknowncost.49new20known29NULL; tüm fiyat/cost güncel kabulü yok.

Stockrun GOAL7-b8fd65a6-fc1f-44a7-ad84-12d6f6f314e1/plan059d736d75fa053e1422b7fdd1988db499d7593591d30dcbcc3db4d081e57c60;source-native GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d/plan38e77efd0f0d90dddb67501d7faf4b7b5c177d9217cb8240647b5fdc06547efe.563nativequantity/468nativeeffect,46protected16guard fark0. Native16671/64015version;eskiRUN06/C09korunur. CariFXwrite0;TRYUSDEURayrı,276diagnosticBAKIYEsemantiği kararı bekler.33sarı2kırmızı yeni ve değişmişkapsamın kalanatomları uygulanmadı.

Committed−2/newnative−1/inverse+2:29stok, aynı count/audit; ayrıcleanup+1→30historykorunur. Replay0;source-nativeimmediatefullsealproof, postbusinessdrifttoleransı iddia edilmez. YeniTESTbackupVERIFYONLY,active restore yok. [T0/T1 ve arşiv/historical plan](docs/erp-v2/canonical-20261007/goal7-cutover-archive-plan.md) hazır;actualcutover/Vegapermissionchange yok.

# Vega → Melisa ERP açılış migration planı

4 Ekim 2026. Kullanıcının bu görevdeki talimatı geçerlidir: Vega kaynak sistemdir; aktif kartlar, stok, cari/döviz bakiyesi, fiyat ve kanıtlı maliyet ile gerekli açılış verileri taşınır. Eski resmi geçmiş, eski fatura/arşiv ve muhasebe belgeleri yeniden aktarılmaz. TEST provası yetkilidir; LIVE yazımı yetkili değildir.

5 Ekim C07 seçili TEST teknik kabulü: [tedarikçi kartı](docs/erp-v2/canonical-20261004/supplier-card-acceptance.md),paket24/source0907/uygulama95bef87/PR23. Normal530native kartın ayrı hesapları ve90nativehold mevcut RUN06/998supplierstage ve176hold mühürleriyle okunur; tüm530kart açılış kabulü değildir. İlker TESTrole16 iki onaylı supplier.view/edit anahtarı,diğer134izin aynı;13373sentetik iletişim normalUIkaydet/replay/yenile/NULLrestore ile2journalda kanıtlandı. Eski42tanım/37FIRST/15+17manifest,C06reader ve mühürler aynı;27eski ticari/finans tablo ve28protectedfixturekolon fark0. C07 genel düzenleme/personel kabulü PARTIAL. Bu yeni reader/izin/iletişim metadata işi delta veya cutover kabulünü genişletmez; Vega/LIVE/gerçek ticari kart yazması yok.

Korunan önceki ERP operasyon dilimi C06: [müşteri kartı teknik salt okunur TEST kabulü](docs/erp-v2/canonical-20261004/customer-card-acceptance.md),paket23/source8933b01.30Eylül müşteri açılışı normal ekranın ayrı döviz hesaplarına bağlandı; kaynak/güncel/defter exact8 mutabakatı veUNKNOWN/karantina görünümü mevcut mühürlerle doğrulanır.441native kartın tümü migration kabulü sayılmaz.27ticari tablo tam fark0; yeni delta/kart yazması yok. Genel düzenleme/personel kabulü açık.

Korunan önceki ERP operasyon dilimi C03: [dövizli alış teknik TEST kabulü](docs/erp-v2/canonical-20261004/purchase-fx-acceptance.md), paket21/source2751fac. RUN06 typed fiyat ve ayrı birim kanıtı yalnız iki sentetik fiyat kopyasıyla normal alış akışına bağlandı; yeni17 koruma eski15/42 tanım/37 FIRST ve migration mühürlerini değiştirmedi. Sentetik USD40/EUR45, güncel piyasa/Vega verisi değildir. 71 yeni/341 değişmiş ürün ve74 cari delta uygulanmadı;54 ürün/122 cari iş kararı, eksik maliyet, T0/T1, idempotent batch, son mutabakat ve committed rollback açık. Bu operasyon kabulü migration/cutover kabulünü genişletmez.

## Kaynak, hedef ve veri kesimi

- Kanonik kaynak kod: `C:\Sirket\ERP\melisa-erp-v2`, origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`; aktif feature dalı `codex/erp-finish-20261004`, kabul edilmiş açılış tabanı `codex/canonical-live-20261003/e0c18e3`. Eski source checkout'u arşiv/kanıttır; deployment değildir.
- Prova kaynağı: `Semih\MELISADEV / VEGA_CAPTURE_20260930_01`, fiziksel salt okunur. Yerel `VEGA2026` F0102/F0103 işletme dönemini içermediğinden kaynak seçilmedi; eski `VEGA2026_ANALIZ_READONLY` da güncel prova kaynağı değildir.
- Yakalamanın işaret ettiği veri kesimi 30 Eylül 2026'dır. 4 Ekim export zamanı kaynak güncelliği anlamına gelmez. Güncel Vega `DESKTOP-KSRK0EQ / VEGA2026` bağlantısı da SELECT-only SQL rolüyle doğrulandı: sysadmin/CONTROL/INSERT/UPDATE/DELETE yetkisi yok; gerekli 29 tabloda SELECT var. Snapshot isolation OFF. Güncel okuma/delta gerçek geçiş anının atomik snapshot'ı değildir.
- Hedef yalnız `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Web 5194, ERP API 4144, native API 4146 salt okunur. LIVE DB ve 5188/4114/4116 servislerine yazma/restart yok.
- Ham kart, cari, fiyat, maliyet ve ilişki dökümleri yalnız `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004\private` altında. Git ve web paketine yalnız kod, yöntem ve anonim mutabakat özeti girer.

## Eşleme ve açılış kuralları

| Alan | Kaynak | Hedef ve kontrol |
|---|---|---|
| Ürün kimliği | F0102 stok IND + özgün kod; baştaki sıfırlar korunur | Mevcut native source_record_key/alias ile birebir eşleştir; benzer adla birleştirme yok |
| Kapsam | Aktif sıfır stok dahil; pasif sıfır olmayan ek açılış kapsamı | Pasif sıfır kart dışarıda; belirsiz aktiflik/miktar karantinada |
| Stok | F0102 D0007 hareket neti; dönem hareketi olmayan kart için KALAN ve kaynak gerekçesi | MERKEZ tek fiziksel stok. F0103/F0104 ikinci stok değildir. Eksi stok aynen kayıtlı inceleme konusu; sıfıra çevrilmez |
| Birim/barkod | F0102 BIRIMLEREX, birim IND/faktör | ADET/faktör 1 kanıtı; çakışan barkod yeni sahipliğe zorlanmaz |
| Satış fiyatı | Kaynak birim + kademe + para birimi | Çoklu kademe/döviz korunur; sadece scalar alan kontrolü yeterli değildir |
| Liste alış fiyatı | Kart ALISFIYATI/DALISFIYATI/APB ve iskonto | Son net maliyetten ayrı, para birimiyle korunur |
| Maliyet | Kanıtlı ürün bağı olan son kesinleşmiş net alış satırı, tarih/kur/iskonto izleri | Son net alış maliyeti; hareketli ağırlıklı ortalama diye etiketlenmez. Kaynak bağı/kur kanıtlanmıyorsa NULL/UNKNOWN; bugünün kuruyla doldurma yok |
| Müşteri | F0102 cari IND + rol + hesap dövizi | Native müşteri, party link ve döviz hesabı birlikte kontrol |
| Tedarikçi | F0103 cari IND + rol + hesap dövizi | Native tedarikçi, party link ve döviz hesabı birlikte kontrol |
| Bakiye | D0007 cari defterinin işaretli (BORC−ALACAK)/KUR hesabı; 30/31 teknik devir sınıflaması ayrıca belgeli | TRY/USD/EUR ayrı. Müşteride native alacak işareti kaynakla aynı; tedarikçide native pozitif borç için kaynak işareti ters çevrilir. Card BAKIYE ile hesap dövizi aynı değilse zorla eşitleme yok. Eksik/uyumsuz hesap karantinada |
| Açılış etkisi | Dondurulmuş kaynak ve korunacak hedef başlangıç farkı | Eski belgeleri silmeden yalnız tanımlı açılış farkı; scalar stok/bakiye ve etkili hareket aynı sonuca ulaşmalı |
| Kasa/banka ve günlük kur | Fiziksel döviz sayımı, banka mutabakatı ve kabul edilmiş geçiş günü kur kaynağı | Cari bakiyeden kasa türetme yok. Mevcut TEST kasa/banka korunur; gerçek finans açılışı ayrıca iş sayımıyla kabul edilir. 12 Eylül kayıtlı kur güncel piyasa kuru kabul edilmez |

Hedef hassasiyeti açıkça korunur: fiyat ve döviz hesabı tabloları decimal(28,8), kart maliyet/fiyat/bakiye alanları decimal(18,4), stok kartı decimal(18,3). Finansın tam kaynak değeri döviz hesabında ve exact hareket alanında tutulur; 4 basamaklı kart alanı SQL ROUND(value,4) projeksiyonudur ve en fazla 0,00005 fark ayrı raporlanır. Maliyet/fiyatın tam kaynağı da kanıtta tutulur. Mutabakat exact hesap/fiyatı exact kaynakla, kart projeksiyonunu aynı yuvarlanmış kaynakla karşılaştırır. Stokta temsil edilemeyen miktar sessiz yuvarlanmaz; karantinaya ayrılır.

## Prova uygulama sırası ve koruma

1. Server/DB/rol/firma/dönem kimliği, kaynak read_only ve hedef izolasyonu doğrulanır. Export projeksiyonları iki okumada aynı hash vermeli; canlı kaynakta bu kontrol atomik veri kesimi yerine geçmez.
2. TEST başlangıcının COPY_ONLY/CHECKSUM yedeği alınır; mevcut TEST korumaları, belge/hareket/kasa ve fixture parmak izleri saklanır. Yalnız TEST yedeği; LIVE yedeği/restore/reset yok.
3. Kaynak açılış modeli `erp_migration` ayrık şemada immutable run/hash ile kaydedilir. Ham veri paketlenmez. Bu aşama tek başına native geçiş kabulü değildir.
4. Native plan her hedef ID için before/after değerleri, kaynak kimliği ve izinli kolonları dondurur. Mevcut trigger'lar kapatılmaz. Gerekli uzantı yalnız aynı TEST DB, admin migration oturumu, aktif run ve onaylanmış birebir planı kabul eder; uygulama writer'ına genel migration izni verilmez.
5. Ürün/stok/fiyat/maliyet ve cari/bakiye eşlenen alanları kontrollü güncellenir; farklar tek seferlik kaynak anahtarlı açılış hareketine bağlanır. Kaynak çakışması veya başlangıç sapması transaction'ı durdurur. Eski fatura/satış maliyet snapshot'ı/kasa/geçmiş silinmez.
6. Replay ek yazma üretmemeli. Bağımsız reviewer doğrudan donmuş Vega SELECT → native hedef SELECT ile kayıt anahtarlı stok, cari/döviz, fiyat, maliyet farklarını doğrular. Aynı importer'ın stage-to-stage sayımı tek başına mutabakat değildir.
7. Kanonik TEST paketi manifest/hash ile üretilir; `C:\Sirket\ERP\runtime\start-canonical-test.ps1` ile açılır. 5194'te yayınlanan salt okunur özetin gerçek SQL kanıtıyla aynı olması kontrol edilir.

## Geçiş günü delta/cutover

1. İşletme geçiş saati ve sorumlusu belirlenir. Güncel Vega server/DB/firma/dönem ile hedef LIVE kimliği ayrı yetkilendirilmeden LIVE işlemi başlamaz.
2. Kart/stok/cari/fiyat/maliyet ve ürün bağları için T0 dondurulmuş başlangıç export/hash alınır. Vega kesiminde bütün yazıcılar ve gecikmiş/offline terminal senkronları kontrollü durdurulur; tek ortak tutarlı snapshot veya yazım duraklatılmış kesim gerekir.
3. T1 son export alınır. T0→T1 delta kaynak kimliği ve payload hash ile INSERT/UPDATE/pasifleştirme olarak ayrılır. Timestamp tek başına değişim yakalama değildir; tüm açılış bakiyesi/net stok yeniden hesaplanır. Eksilen kart DELETE sayılmaz; gerekçe/karantina gerekir.
4. Geçiş anına kadar Vega tek yazıcıdır. T1 aktarımı sonrası yeniden iki sistemde satış/alış açılmaz. Cutover pencere içindeki hareket source-key ile tek etkili uygulanır; eski açılışlar/teknik ters kayıtlar ikinci kez çalıştırılmaz.
5. Kabul kapıları: kaynak/hedef kimliği, kapsam dışı ve karantina açıklaması; kayıt bazında stok/cari/döviz/fiyat/maliyet farkı sıfır; bilinmeyen/çatışmalı alanların işletme kararı; native etkili defter ve scalar eşitliği; replay sıfır yazma; kasa/geçmiş/yerel hareket korunması; gerçek personel/terminal kabulü.
6. Kabulden önce Vega yazıcılığına dönülecekse yalnız doğrulanmış hedef açılış batch'i geri alınır veya TEST doğrulanmış backup stratejisi uygulanır; yeni gerçek Melisa işlemleri oluştuysa restore ile kaybedilmez. Kaynak ve hedef delta/ters kayıt planı birlikte incelenir. Bu görev hiçbir LIVE rollback/restore gerçekleştirmez.
7. Kabul sonrası kaynak Vega salt okunur arşiv olarak tutulur. Eski resmi geçmiş Melisa ERP'ye toplu taşınmaz; gerekirse ayrı salt okunur referans erişimi sağlanır.

## Bu provanın sonucu

Gerçek native TEST açılışı COMMITTED. Eşlenen kapsamın bağımsız SQL mutabakatı **PASS, fark 0**. Genel migration/cutover durumu **PARTIAL**: kapsam dışı/belirsiz kayıtlar, güncel delta, fiyat yazımı ve cutover kabulü açık. Kabul edilmiş açılış fiyatlarını günlük TEST ekranında okuma kabulü PASS. Güncel canlı Vega kesimi, eksik maliyet ve belirsiz cari hesapları çözülmeden LIVE cutover kabulü verilmez.

### Doğrulanmış source ve gerçek delta

- Dondurulmuş final export `source-capture-06`, SHA-256 `36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400`. 52.959 kart; 11.749 aktif ve 4.927 pasif sıfır olmayan = 16.676 açılış kapsamı. 36.270 pasif sıfır kart dışarıda, 13 belirsiz miktar incelemede. 2.048 kaynak eksi stok sessiz sıfırlanmaz.
- 950 cari; 891 aktif + 3 pasif bakiyeli = 894 kapsam. 84 ana döviz bakiyesi bilinmiyor, 2 tanınmayan LL dövizli kayıt var. Kaynak çoklu döviz hesapları ayrı tutulur.
- 6.076 kanıtlı son net alış maliyeti; 150 son bağlı alışta net/kur/birim/kayıt tutarsızlığı; 10.450 kanıtlı alış bağı olmayan ürün. Bu maliyetler bilinmiyor. 10 birim incelemesi ve 1 sıfır olmayan tanınmayan dövizli fiyat vardır.
- Reviewer doğrudan salt okunur Vega SELECT ile 52.959 ürünün miktarını ve 420 kaynak döviz hesabını snapshot ile karşılaştırdı: sıfır fark; native tedarikçi işaret dönüşümü sıfır fark. Kapsamdaki 16.669 ürün ana birim pointer'ı exact, 7 kayıt belirsiz.
- Güncel kaynak export `current-capture-01`, SHA-256 `c62d3366f8505437daf6f7227bd459f2ab289c02b7b52a3ddf0e431a8bc84d64`; 4 Ekim 00:58:47 TRT okuma bitişi. Projeksiyonların iki okuma hash'i aynı, fakat bütün tabloların ortak atomik veri kesimi kanıtlanmış değildir.
- Gerçek T0→güncel delta: 71 yeni ürün (70 kapsamda), 341 değişmiş ürün (337 kapsamda), kaybolan ürün yok. Miktar 327, satış fiyatı 35, alış fiyatı 54, maliyet kanıtı 28, net maliyet 19, barkod 8 kartta değişmiş. 74 cari değişmiş, 71 bakiyesi değişmiş; yeni/kaybolan cari yok. Alan fark sayıları aynı kartı birden fazla sayabilir; toplamı değişen kart sayısı değildir.
- Güncel kaynakta 53.030 kart, 16.745 kapsam, 6.104 kanıtlı maliyet var. Bu yeni kart ve deltalar dondurulmuş 30 Eylül native prova kabulüne dahil sayılamaz; geçiş günü ayrı idempotent batch + aynı mutabakat kapıları gerekir.
- Ek bağımsız barkod incelemesi: kapsamda 17.804 benzersiz kaynak ürün/barkod çifti; başlangıçta 36 native eşleşme eksikti. Native plan kapsamındaki 35 eksikten yalnız 8'i hem kaynakta tek sahipli hem hedefte sahipsizdir; 27'si kaynakta çok sahipli veya hedefte başka ürünün barkodudur. Güvenli 8 eklenebilir; diğerleri yeniden sahiplik atanmadan karantinaya ayrılır. Önceden pasif barkodlar kaynaktan aktivasyon kanıtı olmadan açılmaz.
- TEST başlangıç yedeği `C:\Sirket\ERP\backups\VEGA-MIGRATION-TEST-20261004\PRE_OPENING_01.bak`: COPY_ONLY + CHECKSUM, VERIFYONLY PASS. SQL Express COMPRESSION desteklemediği için ilk sıkıştırma denemesi yazmadan durdu; başarılı yedek sıkıştırmasızdır. Restore provası bu görevde yapılmadı.

### Uygulanan native açılış ve bağımsız mutabakat

Run `VEGA-OPENING-TEST-20261004-06`; plan SHA-256 `18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a`. SQL uygulama kaynak commit'i `03ca9c122fbe98aca82f6998e4657aa9d63ccce0`. Writer yalnız exact binary server/DB kimliği, doğrulanmış TEST yedeği ve değişmemiş başlangıç hash'leriyle çalıştı. Bütün adımlar tek SERIALIZABLE transaction içindeydi; güncellemeler en fazla 500 kayıtlık gruplarla aynı korumadan geçti.

| Kontrol | Gerçek kapsam | Bağımsız sonuç |
|---|---:|---|
| Ürün kimliği/metadata/stok | 16.622 ürün | 0 fark; Vega miktarı + korunacak yerel hareket; scalar = etkili stok defteri |
| Maliyet | 6.070 kanıtlı, 10.552 bilinmeyen | 0 eşleme farkı; bilinmeyen SQL NULL olarak kaldı; tüm maliyetlerin bilinmesi ayrı kabul kapısı |
| Cari ana kartı | 371 müşteri + 401 tedarikçi | 0 fark; rol ve tedarikçi işareti ayrı kontrol |
| Döviz hesapları | 379 müşteri + 406 tedarikçi = 785 | 0 fark; 772 ana + 13 ek hesap; exact hesap = etkili döviz defteri |
| Para birimli/birimli/kademeli fiyat | 63.774 satır | 0 fark; 56.438 güncelleme + 7.336 yeni fiyat |
| Kart fiyatı | 16.182 satış, 6.871 alış projeksiyonu | 0 fark; diğer scalar fiyatlar kaynak kabulü sayılamaz |
| Barkod | 17.736 ürün/barkod çifti; 8 güvenli yeni barkod | Eksik/inaktif eşleşme 0; yeni barkodların kaynak ve hedef sahipliği tekil |
| Açılış hareketi | 1.310 stok + 115 müşteri + 68 tedarikçi = 1.493 | 0 fark; eski belgeler yeniden aktarılmadı |
| Ayrık kaynak kanıtı | 184.045 immutable staging kaydı | Payload/hash farkı 0; staging tek başına native kabul sayılmadı |

Kabul edilen 16.622 üründe korunan yerel stok etkisi toplam −1.109'dur; daha eski tarihteki gerçek terminal satışları da buna dahildir. Tarih eski diye etkileri silinmedi. Açılış stok düzeltmesi −14.461; güncel kaynak neti ve eski yerel hareketler birlikte doğrulandı. Yeni kaynak ürün/cari kartı oluşturulmadı; bu provada mevcut birebir eşlenen native kartlar güncellendi.

27 geçmiş/finans/terminal/audit tablosunun önceki içeriği aynı kaldı. Üç defterin bütün eski satırları ayrıca bağımsız hash ile doğrulandı: 557.649 stok, 29.040 müşteri ve 23.941 tedarikçi hareketi. Bu sayıların artışı yalnız yukarıdaki yeni açılış hareketleridir. 22 TEST guard eski gövdeleriyle etkin; geçici migration guard artığı 0. Kasaya/bankaya ve eski resmi belgelere yazım yok.

`--verify` ve `--replay-test` PASS; fark 0. Aynı `--apply-test` tekrar isteği `RUN_ALREADY_EXISTS_USE_REPLAY` ile DML başlamadan reddedildi. Bu üç kontrol öncesi/sonrası açılışlar, kartlar, fiyatlar, hesaplar, kaynak stage ve audit dahil **37 tablonun tüm satır sayısı/hash'i birebir aynı: ek yazma 0**. Başarısız büyük grup denemesinin transaction rollback'i de bağımsız başlangıç hash'leriyle PASS; guard gevşetilmedi. COMMITTED batch geri alma ve backup restore provası yapılmadı; VERIFYONLY restore kabulü değildir.

Normal TEST oturumuyla gerçek API okumaları: bilinen/bilinmeyen maliyetli iki ürünün stok/maliyeti ve bir müşterinin bakiyesi SQL ile aynı; bilinmeyen maliyet JSON NULL. Aynı kullanıcının native tedarikçi GET isteği mevcut `supplier.view` sınırı nedeniyle 403; yetki değiştirilmedi. 401 tedarikçinin kabul kanıtı bağımsız SQL mutabakatıdır. TEST ürün maliyet UI kaynağında NULL korunur ve Bilinmiyor gösterimi kullanılır; gerçek 0 sıfır kalır. Kaynak regresyonu PASS. Tarayıcı/paket kabul kanıtı release bölümünde tutulur. Toplam 20 hedefli migration/API/UI/SQL kimlik testi PASS.

### Açık kabul kapıları ve güncel delta uygulaması

- 16.676 kaynak açılış ürününden 54'ü native plana alınmadı: 21 kimlik, 3 birim/miktar, 30 benzersiz barkod sorunu. Bu 54 eski TEST kartında hâlâ bulunur; 22 aktif, 39 stoklu. Operasyon karantinası aşağıdaki 4 Ekim diliminde TEST API ve SQL üzerinde tamamlandı. Eşleşme/sahiplik belirsizlikleri çözülmeden tam işletme/cutover kabulü verilemez. 36.270 pasif sıfır kartın native karşılıklarında aktif/stoklu sapma 0.
- 894 kaynak cariden 122'si güvenli native kabul dışında: kimlik/döviz/bakiye/ana hesap belirsiz. 84 kaynak ana bakiyesi bilinmiyor. NULL, sıfır veya uydurma kur ile kapatılmadı.
- Kabul edilmiş 16.622 üründen **9.751'inde scalar alış fiyatı korunmuştur**; 455 üründe bilinen kaynak alış fiyatı farklı dövizlidir; 9.296 üründe kaynak alış fiyatı NULL/bilinmeyendir. Farklı döviz zorla dönüştürülmedi; bilinmeyen kaynak alışın yerine eski scalar değer kabul edilmedi. 9.774 plan inceleme kaydı, kapsamdan çıkarılan 23 ürünü de içerir; kabul edilmiş ürün sayısı değildir. Exact typed alış fiyatı mutabakatı ve yeni kabul edilmiş fiyat okuma ekranı PASS. Yeni rapor eski scalar alış değerini fallback olarak kullanmaz. Eski kart/satış/yazma akışları bu rapor kabulüne dahil değildir; dövizli typed fiyat yazımı ve operasyon kullanımı ayrıca tamamlanmalıdır.
- Kabul edilmiş ürünlerde 33.049 eski ek typed fiyat anahtarı korundu. Yeni API/UI yalnız sealed RUN06 bağları üzerinden gerçek native `product_prices` ID’lerini okur. 33.049 eski ek anahtar bağımsız kontrolde rapor dışında; legacy fiyat yazımı ve diğer operasyon ekranlarının bu provenansa geçirilmesi ayrı kabul kapısıdır.
- 10.552 native maliyet NULL, kaynakta 2.048 eksi stok, 13 bilinmeyen miktar, belirsiz birim/döviz/barkod kayıtları açıklamalı işletme kabulü gerektirir. Liste alış fiyatı kanıtlı maliyetin yerine konmaz.
- Güncel Vega'nın 71 yeni ürünü, 341 değişmiş ürünü ve 74 değişmiş carisi ölçüldü; **bu delta uygulanmadı**. Güncel okuma atomik cutover kesimi değildir. Yeni kartlar için ID/alias/birim/barkod/fiyat/açılış ilişkileri yeni immutable TEST batch'inde prova edilmelidir. Mevcut writer frozen TEST run'ına sabitlidir; LIVE veya güncel delta aktarım aracı olarak kullanılamaz.
- Geçiş günü yeni T0/T1 kesimiyle yeni run/hash/plan gerekir. Cari yerel delta ve önceki defter toplamları `COALESCE(balance_effect_exact,balance_effect)` üzerinden hesaplanmalı. Bugünkü yerel unlinked müşteri/tedarikçi hareketlerinde exact/scalar farkı 0 olduğundan mevcut provada hassasiyet kaybı yok; gelecekte aynı varsayım yapılamaz. Dövizler toplanmaz, yabancı açılışa uydurma FX snapshot yazılmaz.
- Genel LIVE cutover, gerçek personel/terminal akışı, kasa/banka sayımı, kaynak yazıcılarının durdurulması, yeni delta mutabakatı ve geri dönüş kabulü açık. Bu görev LIVE'a/Vega'ya yazmadı; eski resmi geçmişi taşımadı.

### Kanıtlar ve TEST kabul ekranı

Korunan yerel kanıt kökü `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004`. Private bölüm kullanıcı/SYSTEM/Administrators ACL'iyle sınırlıdır; ham ticari veri paket/Git/web'e alınmadı.

- `private/VEGA-OPENING-TEST-20261004-06/{commit-receipt,verification-receipt,replay-receipt}.json`
- `private/independent-postapply-06.json`, `independent-barcode-06.json`, `independent-replay-06.json`, `independent-rollback-03.json`
- `private/current-capture-01`, `private/delta-01/source-delta-summary.json`, `api-migration-proof.json`
- Kanonik TEST launcher: `C:\Sirket\ERP\runtime\start-canonical-test.ps1`; nihai paket `CANONICAL-VEGA-MIGRATION-TEST-20261004-16`. Tam kaynak commit'i ve her dosyanın SHA-256 değeri paketin `release-manifest.json` dosyasındadır.
- [5194 salt okunur migration özeti](http://127.0.0.1:5194/migration-proof.html): eşlenen kontroller ve açık kapılar. Kaydedilmiş paket özeti güncel SQL sonucu gibi gösterilmez.

`sql-vega`, backend, reviewer ve release rolleri kullanıldı. Çalışan eski ticari akışların kabulü yeniden açılmadı. LIVE servis sahipliği korundu; gerçek genel kullanım/LIVE geçişi için PARTIAL kapıları kapanmalıdır.

### Kabul edilmiş fiyat okuyucusu — 4 Ekim gerçek TEST kabulü PASS

Günlük [Fiyat & maliyet ekranı](http://127.0.0.1:5194/is-akisi-taslagi.html#prices) yalnız RUN06 native kabulüne bağlı fiyatları gösterir. 16.622 ürün ve 63.774 fiyat (56.448 satış, 7.326 alış) üç immutable metadata tablosuyla gerçek native ID’lere bağlandı; 56.438 mevcut ID ve 7.336 yeni native ID bağımsız doğrulandı. 54 karantina ürünü ve 33.049 eski ek fiyat anahtarı okuyucu dışında. 9.296 bilinmeyen kaynak alış için eski scalar fallback yok; 455 farklı dövizli bilinen alış kendi dövizinde kalır.

Normal oturumda hem `product.view` hem `purchase.view` zorunlu. ERP API 4144 iki dar prosedürü EXECUTE eder; yeni bağ tablolarına SELECT/DML verilmedi. Native reader’ın mevcut dbo schema DENY EXECUTE koruması kaldırılmadı; 4146 bu raporu sunmaz. Liste/detay run/source/plan/seal hash, ana birim, tam fiyat anahtarı, native kimlik/değer, stage ve satır sayısını kontrol eder; sapmada okuma kapanır. SQL varsayılan case-insensitive grouping’in bir eski price_type varyantını kabul edilmiş anahtarla birleştirmesi tam byte/null anahtar semantiğiyle düzeltildi; gerçek birebir duplicate engeli korunur. Native iş verisine bu okuyucu kurulumunda yazılmadı.

Temiz kaynak `b3676283977729ee5b56a969520b86b530c758a7` paket12 üzerinden yalnız iki reader prosedürü yükseltildi. 16.622/63.774 tam bounded doğrulama ve aynı hash replay PASS; replay ek yazma 0. Kurulum/yükseltme/replay/negatif kontroller sonrası bağımsız SELECT ile mevcut 37 tablonun bütün count/hash’i aynı, 22 eski guard ve 3 yeni immutable guard sağlam. Dokuz bağ tablosu INSERT/UPDATE/DELETE denemesi 51075 ile reddedildi ve rollback edildi; kalıcı metadata değişimi 0. Gerçek sales SQL principal list25 1.836 ms, list100 426 ms, detay 384 ms; kabul dışı detay boş döner.

Normal iki TEST hesabıyla gerçek API/5194 kabulü PASS: exact sekiz basamaklı fiyat string’leri, döviz/birim/kademe, bilinen yabancı alış, bilinmeyen alış ve gerçek sıfır; 54 kaynak karantina liste dışlama (53 çözülmüş native detay da boş), kapsam dışı detay, pozitif stok sayfalama ve A→B seçiminde geciktirilmiş A yanıtının B’yi bozmaması. Masaüstü/mobil sayfa taşması ve konsol hatası 0, ticari yazma 0; mobil geniş tablolar yatay kaydırılır. Native maliyet dört basamaklı projeksiyon olarak etiketlenir; NULL bilinmeyen kalır. 19 hedefli migration/API/UI testi PASS. Eski çalışan akışlar yeniden test edilmedi.

Yetki kanıtının sınırı açık: mevcut iki kayıtlı TEST hesabında da ürün ve alış görüntüleme izni var. Bunlarla alış yetkisi olmayan normal kullanıcı 403 kabulü iddia edilmez; kullanıcı/rol yetkileri değiştirilmedi. Gerçek oturumsuz liste/detay 401 ve veri yok; mevcut gerçek middleware ile eksik ürün, eksik alış ve her ikisi eksik izin durumları 403, iki izin birlikte 200 kapısı PASS. Route zincirlerinde iki izin zorunluluğu doğrulandı. Kısıtlı normal kullanıcı oturumuyla 403 provası ayrıca açık kalır.

Kanıtlar korunan evidence kökünde:

- `private/VEGA-OPENING-TEST-20261004-06/accepted-prices-install.json`
- `private/VEGA-OPENING-TEST-20261004-06/accepted-prices-reader-upgrade-1791076565633.json`, `accepted-prices-replay-1791076751764.json`, `accepted-prices-negative-reader-proof.json`
- `private/independent-accepted-prices-final.json`
- `release/green-prices-verification.json`, `opening-price-permission-verification.json`, `package12-build-verification.json`; gerçek ekran/ham fiyat çıktıları yalnız private bölümde.

Nihai dokümantasyon paketi `CANONICAL-VEGA-MIGRATION-TEST-20261004-13`; tam commit/hash release manifest ve release kabul dosyalarında. Zorunlu launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1` ile 5194/4144/4146 kimliği doğrulanır. LIVE 5188/4114/4116 süreç sahipleri korunur. Donmuş 30 Eylül fiyatları güncel Vega fiyatı diye sunulmaz. Fiyat okuma akışı personelin TEST kabulüne hazırdır; typed fiyat yazımı, güncel delta, eksik maliyet/cari, restore/rollback ve LIVE cutover nedeniyle genel durum PARTIAL kalır.


### Operasyon karantinası — 4 Ekim gerçek TEST kabulü PASS

Sonraki somut eksik kapatıldı: açılış kabulü dışında kalan kartlar önce yalnız planda karantinadaydı, mevcut hedef kartlarına işlem yapılabiliyordu. Şimdi 54 kaynak ürün + 28 müşteri + 94 tedarikçi = 176 kayıt immutable kaynak/plan/seal bağıyla tutulur. Exact alias/native source key üzerinden 172 hedef kimliği doğrulandı; hedefte bulunmayan dört tedarikçi native ID NULL olarak kaldı. 54 ürünün 22 aktif/39 stoklu alanı değiştirilmedi. Kaynak adı bilinmeyen dokuz ürün ve üç müşteride NULL aynen korunur; ekran “Kaynak adı bilinmiyor” gösterir, hedef adından doldurmaz.

Yalnız TEST'e iki metadata tablosu, iki immutable trigger, 37 ticari SQL koruması ve iki dar EXEC okuyucu eklendi. SQL korumaları INSERT/UPDATE/DELETE için FIRST ve etkin; eski 22 guard gövdeleri/etkinlik/sıra özellikleri korunur. API bilinen hedef kimliklerini erken ve aynı transaction içinde kontrol eder; SQL doğrudan yazmayı da engeller. Kaynak alias/role/account/registration ilişkileri ve eski-yeni satırlar birlikte sınanır; karma çok satırlı işlem bütün olarak reddedilir. Dört hedefsiz tedarikçinin kaynak bağını ilgisiz karta eklemek de engellenir. Kabul edilmiş kartları veya ayrılmış TEST fixture'larını genel allowlist ile kısıtlayan yeni bir kural yoktur.

Kurulum, aynı seal replay ve 17 rollback SQL negatif denemesi PASS; replay metadata yazması 0. Üç rol, eski alias güncelleme/silme, hesap, karma işlem, dört hedefsiz kaynak bağı ve iki immutable tabloya INSERT/UPDATE/DELETE denendi; IDENTITY INSERT veya kalıcı ticari yazma yok. Bağımsız reviewer 176 kaynak/172 hedef/4 NULL scope ve tam tuple seal ile bütün 37 mevcut tablonun count/hash'ini, eski 22 guard'ı, üç kabul edilmiş fiyat tablosunun SQL hash'ini, üç fiyat immutable guard'ını ve iki eski reader gövdesini doğruladı: fark 0. Yeni 37 guard + iki immutable + iki prosedür gövdeleri de exact doğrulandı. İlk NOT NULL kurulum denemesi SQL515 ile bütünüyle rollback oldu; yeni nesne 0 ve başlangıç hash'leri aynıydı. Düzeltme yalnız nullable kaynak adı sözleşmesidir.

Normal mevcut TEST oturumlarıyla 5194 masaüstü/mobil liste, arama, sayfalama, 12 NULL adın aynen taşınması ve bilinmiyor etiketi PASS. Mevcut product/customer/supplier görüntüleme izinleri ayrı uygulanır; oturumsuz üç tür 401, supplier.view olmayan oturum 403 ve veri yok. Kullanıcı/rol yetkileri değiştirilmedi. Tam tedarikçi 94/90/4 kapsamının kanıtı bağımsız SQL'dir; yetkisiz normal kullanıcıyla tedarikçi ekranı kabulü iddia edilmez. Gerçek ürün satış, müşteri tahsilat ve tedarikçi ödeme POST denemeleri 409 MIGRATION_ENTITY_QUARANTINED ile reddedildi; 15 ticari tablonun tam satır count/hash'i ve eski 22 guard aynı, başarılı ticari yazma 0. Konsol/sayfa hatası ve mobil taşma 0. Bu dilimde API8/UI4/SQL9 = 21 hedefli test PASS; çalışan eski özellikler yeniden ispatlanmadı.

Günlük [Aktarım karantinası](http://127.0.0.1:5194/is-akisi-taslagi.html#migration-quarantine) salt okunur; burada çözüm/onay/yazma düğmesi yoktur. Karantinada bulunmamak bütün işletme verisinin kabulü anlamına gelmez. Operasyon karantinası açığı bu TEST kapsamı için kapandı; kimlik/birim/barkod/cari belirsizlikleri çözülmüş veya kaynağın tamamı kabul edilmiş sayılmaz. Güncel delta, typed fiyat yazımı, fiziksel finans, atomik kesim, COMMITTED geri alma/restore ve LIVE cutover PARTIAL kalır.

Kod ve SQL kurulum paketi CANONICAL-VEGA-MIGRATION-TEST-20261004-15, kaynak 45959295421c61b40bf49b1cc51bcb01dce784f4. Nihai dokümantasyon paketi CANONICAL-VEGA-MIGRATION-TEST-20261004-16; kendi tam commit/hash'i release-manifest.json ve release kabul kaydındadır. Zorunlu launcher C:\Sirket\ERP\runtime\start-canonical-test.ps1 ile 5194/4144/4146 doğrulanır. LIVE/Vega yazımı veya LIVE restart yok. Ham kayıtlar ve ekran görüntüleri private ACL altında; paket/Git'e alınmaz.

Kanıtlar: private/VEGA-OPENING-TEST-20261004-06/quarantine-install.json, quarantine-replay-*.json, quarantine-negative-proof.json; private/independent-operation-quarantine-final.json; release/quarantine-browser-api-verification.json; release/operation-quarantine-final-acceptance.json. sql-vega, backend, reviewer ve release rolleri kullanıldı. Gerçek personel kabulü BEKLİYOR; teknik gerçek TEST prova kabulü PASS.
