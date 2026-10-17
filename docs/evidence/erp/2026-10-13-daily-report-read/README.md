# ERP15 / B07–C15 — mevcut günlük raporları son çalışan paketle eşleştirme

## 17 Ekim — P08.2 rapor filtre sayfa CSV sözleşmesi

[ERP PR38](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/38) kaynak `92bf14ea2c87d5489ab9c5f19603cbd8a55a2f1e`, mevcut yedi raporun kullanıcı filtresiyle dönen tablo ve CSV gövdesi arasındaki bağlantıyı dar kapsamda doğrular. Yanıtın kind/period/from/to/currency/brand/type/groupBy alanları ve offset/50 limit, seçili istekle eşleşmeden tablo çizilmez; Türkiye gün etiketleri gerçek `+03:00` half-open UTC kapsamına bağlıdır. Sayfa toplamı/satır adedi ve satır tarih-döviz kapsamı tutarsızsa görünüm hata/Yenile durumuna döner. CSV yalnız BOM, quoted semicolon/CRLF/escape şeması, filtre metadata'sı, sütun başlığı, satır sayısı/toplamlar ve her satırın uygun tarih/döviz/görünür marka/tür bağı doğrulanınca indirilir. Korunmamış formül başlangıcı reddedilir; negatif sayısal değerler, NULL, gruplanmış satışın boş tarih alanı ve stok hareketinin filtresiz bilinmeyen dövizi korunur.

Eski kaynakta yanlış tür/dönem/döviz/UTC/sayfa ve yanlış tablo/CSV satırı kontrollü sentetik yanıtla kabul edilebiliyordu; yeni hedefli negatifler önce FAIL, son web rapor **23/23**, ilgili API rapor **6/6 PASS**. Bağımsız High salt okunur incelemede açık P0/P1/P2=0. Exact [push CI39033410985](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39033410985) ve [PR CI39033423282](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39033423282) completed SUCCESS. Bu, gerçek sunucunun yanlış yanıt verdiği iddiası değildir; istemcinin kontrat dışı yanıtı reddetme kanıtıdır. PR38 dar diff için geçici PR36 tabanı üzerindedir. **Yeni paket/kurulum, gerçek normal GUI, SQL/ticari işlem, fiziksel cihaz ve insan kabulü yapılmadı;** P08/B07/C15 genel kapanışı ve49/9/39/1 değişmez.

13 Ekim 2026; ERP-DEC-050/053 ana devam kapsamında. Yeni satış, alış, tahsilat, ödeme, sayım, iade, stok/cari/kasa hareketi veya migration oluşturulmadı. Kabul edilmiş Goal6/Goal8/Aşama4 rapor ve işlem provaları kendi tarih/source/DB/kapsamlarıyla korunur; eski mağaza günü tekrar oynatılmadı.

## Çalışan sürüm ve kaynak eşitliği

Uygulama source **b68aa1b7f6b3e6d044a6d275b587c0d849c03e38**, immutable **CANONICAL-COMPLETE-TEST-20261011-b68aa1b**, 1876 dosya; manifest SHA256 **5f7d8fe3a0ca75a7b867ad872ea14e76b970d3c4292c314654f58b2749bbe65c**. Web5234/API4184/native4186; Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02, copy e16b70f0-4057-428b-9abc-6bbcaf35fe82; actualT1/externalOperations/automaticJobs=false. Özgün TEST125, CRM09ca/nativeOrder60e ve CRM sahibinin11staged kaydı korundu. Mevcut kurulum/v22 APK HTTP200; APK aynı, yeni cihaz kabulü değildir.

Önceki0bf rapor frontend/model/test/CSS ve API route/service/readstore/model/test dosyaları Stage6 source595621aa ile byte-identical; f2f→0bf rapor değişimi0. Yeni b68 yalnız frontend'in iki maliyet etiketi ve ilgili testidir. API/native/SQL/filtre/toplam/yetki/CSV davranışı değişimi0; startup225/CSS9 aynı.

## Kullanıcıya görünen tek düzeltme

Önceki **Maliyeti kanıtlı** etiketi fazla kesin bir ifade taşıyordu: native okuyucu yalnız average_cost_try_snapshot kaydı var/yok sayar. Yeni normal görünüm **Maliyet kaydı olan / Maliyet kaydı olmayan** der. Bu kayıt varlığını bağımsız maliyet doğrulaması veya kesin kâr diye sunmaz. profitAvailable=false ve personel maliyet redaction'ı korunur; bilinmeyen maliyet sıfır yapılmaz.

Root9/9 hedefli kontrol, source High GO, syntax/build ve dar secret scan0. Bunlar yalnız değişen görünüm/regresyon kapsamıdır; eski bütün rapor testleri tekrar çalıştırılmadı.

## Son çalışan veriyle teknik eşleştirme

Seçili tarih **8–10 Ekim 2026**, groupBy=none, aynı copy scope,50satır sayfa. Bu raporlar yalnız bu çalışma kopyasında journal ve tam native effect_json bağı doğrulanan işlemlerdir. Önceden kopyalanmış Vega/ERP açılışı ve belgeleri günlük toplama dahil değildir. Rapor hareket toplamı güncel cari bakiyesi, stok açılışı veya resmi kasa/gün sonu kapanışı değildir.

| Rapor | Mevcut kayıt sayısı | Son kapsam |
| --- | ---: | --- |
| Satışlar | 5 | Kayıtlı fiş dövizi/tutarı; ayrı TRY/USD. |
| Tahsilatlar | 1 | Kayıtlı tahsilat dövizi; yeni tahsilat yok. |
| Alışlar | 5 | Kayıtlı fatura dövizi/tutarı; eski belge korunur. |
| Tedarikçi ödemeleri | 1 | Kayıtlı ödeme; yeni ödeme yok. |
| Stok hareketleri | 425 | İmzalı hareket miktarı,50sayfalama; güncel stok miktarı diye sunulmaz. |
| Müşteri hareketleri | 10 | Hesabın dövizi ve ayrı borç/alacak etkisi. |
| Tedarikçi hareketleri | 8 | Özgün alış/iade/ters kayıt etiketleri ve ayrı döviz etkisi. |

Bu sayılar farklı tür/satır kapsamlarıdır; toplanıp ürün/işlem toplamı yapılmaz. Maliyet kaydı olan403/olmayan0 satış satırı yalnız mevcut kayıt kapsamıdır; doğrulanmış maliyet veya kâr değildir.

**46 ortak GET slotu** önce/sonra aynı; iki ekUSD satış page/CSV ile son48slot. Normal16 yedi raporu,15 yalnız mevcut izinli satış/alış/stok raporlarını okur. Personelin dört finans raporunun page+CSV isteği8adet403; maliyet paneli/verisi verilmez. Fresh kullanıcı∩oturum ve native izinler aynı, yeni grant yok. Kendi normal giriş/çıkışı ayrı; ticariPOST0.

Bağımsız parametreli10 native SELECT recordset önce/sonra aynı. Yedi16 ve üç15 rapor/CSV, aynı tarih/copy/provenance/kimlik ve exact8 satır alanlarıyla eş; toplamlar TRY/USD/EUR bazında BigInt8/NULL korumasıyla ayrı doğrulandı. Toplam890 tekrar görünüm satırı kontrolü benzersiz işlem sayısı değildir. EkUSD filtrede doğru iki satış ve kendi döviz toplamı/CSV ayrıca eş. Marka/tür alanı before/after DTO'da aynı; bu groupBy=none SQL kanıtı genel marka/tür kırılımını bağımsız yeniden kanıtlamaz.

Normal Chrome'da dönem ve kapsam, yedi tür, ayrı döviz/boşEUR, stok ilk/sonraki50, supplier alış iadesi ters kaydı, Yenile ve boş gelecek aralığı incelendi. Normal15 finans düğmeleri kapalı/maliyet gizli,16 başlangıç rolü geri getirildi. Son görüntü ve kapsam private browser-proof'tadır; insan kabulü değildir.

Gerçek CSV düğmesiyle önce tüm dövizli, sonra son paketUSD filtreli dosya indirildi. Download event yakalanamadı; bunun yerine yeni İndirilenler dosyasının tarih/boyut/byteSHA ve exactAPIexportcontent eşliği doğrulandı. Düğmenin başarı mesajı tek başına içerik kanıtı sayılmadı. Dosyaların ham içerikleri GitHub'a yüklenmedi.

Default **Bugün**, izole kopyanın mühürlü9Ekim iş gününe göre hesaplanır; status'ta9Ekim tarih kapsamı vardır. Duvar saati13Ekim veya bugünkü gerçek mağaza/Vega hareketi diye sunulmaz. Teknik kontrol8–10Ekim özel tarih veUSDfiltre ile açık kapsam kullanır. İlk0bf tarayıcı açılışında report error gözlendi; sonraki aynı-source today API ve özel aralık başarılıydı. İlk hatanın nedeni kesinleştirilmedi; maliyet etiketi değişikliği bu bağlantı hatasını düzeltmiş sayılmaz. Sonb68 varsayılan ekranı başarılı okundu. Bu tur16aktörü yedi raporun ilk sayfasında yaklaşık5,1–7,1sn API okuması gözlendi; eskiGoal6 küçük kapsam230ms değerleri güncel hız diye kullanılmaz. Reader hızı/OPS01 genel kapanışı yapılmaz.

Private kanıt: C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261013\private\b07-c15. before-first-api.json; before/after-reports-api.json; before/after-native.json; before-sales-download.csv/after-usd-sales-download.csv; verification.json; browser-proof.json/ekranlar; running-proof.json; root-targeted-tests.txt; source/deliveryCI/secret raporları. Ham isim/tutar/DTO/SQL/CSV/ekranlar private kalır.

## Kapanışın sınırı

Mevcut raporların seçili copy/dönem/döviz/CSV ve normal görünüm alt kapsamı teknik hazır. B07/C15🟡, ERP-UA19/UA32 **bekliyor**; genel işletme raporu, güncel Vega/historical import, genel birim/marka-tür kombinasyonları, gerçek açılış ve insan/gün sonu kabulü kapanmadı. Tarihsel Goal6 TEST77/source4f918c51 yedi rapor/altı dönem/KOD1-KOD4/CSV; Goal8 TEST94/sourcecee ve Stage4/Stage6 eskicopy kanıtları korunur, güncel sayılarla karıştırılmaz. Eski restore/inverse veya ticari prova tekrarı0.

49toplam/9tamam/39kısmi/1açık aynı; completeDelivery=false. Uygulama source ile sonraki doküman teslim HEAD'i ayrı. Source altı hostedCI FAILURE: ödeme/harcama nedeniyle başlamadı; yerel PASS insan veya CI başarısı değildir. [Normal Raporlar](http://192.168.1.46:5234/ornek-akis.html#reports). LIVE/Vega/T1/main/CRM geliştirmesi/mesaj/ücretliAI/temizlik/giriş/cihaz işlemi yok.
