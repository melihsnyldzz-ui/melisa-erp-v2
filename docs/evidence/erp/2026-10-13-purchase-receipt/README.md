# ERP11 / C02–C03 — kayıtlı fatura dayanağı

## 17 Ekim — P05.2.b aynı tarih ve fiyatta kayıtlı dayanak denetimi

[ERP PR37](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/37) kaynak `8cc942548ea7c124df532077a1473b086328f7f9`, önceki c988ab6 tarih/fiyat driftli historical GET teslimini tamamlayan dar kaynak alt adımıdır. `purchaseInvoiceRead`, VERIFIED_BUSINESS_TEST kesinleşmiş GET belgesinde kendi `recordedInvoiceBasis` alanı mevcutsa, güncel tarih ve alış fiyatı aynı olsa bile `historicalPurchaseIdentity` ile özgün fatura ID'si ve `receiptId`→kabul/satır/tedarikçi/fiyat/kur bağını doğrular. Önceki kodda aynı tarih/fiyatlı bozuk `recordedInvoiceBasis.invoiceId='9'` veya `receiptId='9'` kabul edilirdi; yeni negatif test önce FAIL, düzeltme sonrası PASS. Normal liste→tekil detay GET testinde bozuk belge detayı/fiyat/kur gösterilmez, journal değişmez ve POST çıkmaz. Dayanağı hiç olmayan eski ve drift bulunmayan GET okunur, kur “doğrulanamadı” kalır. Yeni taslak/preview/POST ve değişmiş tarih/fiyat guard'ları aynı.

Yerel ilgili model/controller/presentation **38/38 PASS**, bağımsız High salt okunur inceleme açık P0/P1=0. Exact [push CI39032354473](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39032354473) ve [PR CI39032369412](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39032369412) completed SUCCESS; kapsamı dar tutmak için PR37 geçici PR36 tabanı üzerindedir. Bu kaynak/CI sonucu yeni ERP paketi, DB02 okuma-yazma, gerçek normal ekran, yeni alış/stok/borç etkisi veya insan kabulü değildir. P05/B05/C02–C03 üstleri ve49/9/39/1 değişmez.

13 Ekim 2026. ERP-DEC-050/053 ana devam kapsamında dar okuma/görünüm teslimi. Yeni kabul, taslak, fatura, iptal, stok, tedarikçi borcu veya ticari hareket oluşturulmadı. Önceki native işlem/replay kanıtları kendi hedefleriyle korunur; yeniden uygulanmadı.

## Çalışan sürüm

Uygulama source **f2f922af81be6a1852f49ee7a6cf5c6bdb7a1477**, immutable **CANONICAL-COMPLETE-TEST-20261011-f2f922a**, 1876 dosya; manifest SHA256 **2840ecbeaa17c84cd452e78de5738ee2ab494d36f7bb35756c26ce513857e26a**. Web5234 / API4184 / native4186; Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02, copy e16b70f0-4057-428b-9abc-6bbcaf35fe82; actualT1=false. Özgün TEST125 korunur. CRM09ca/native sipariş60e kaynakları ve sahibinin11 staged kaydı aynı. API'de yalnız iki okuyucu ve iki testi değişti; startup225/CSS9 hashleri aynı. Kurulum sayfası/v22 APK HTTP200; yeni Android/fiziksel kabul değildir.

## Ekrandaki değişiklik

- Fatura kendi kayıtlı döviz, miktar, alış fiyatı ve toplamını gösterir. Fiyat/tutar iki ondalık; saklama ve hesaplama hassasiyeti korunur.
- **Bağlı mal kabulü** salt okunur ayrıntı açar: exact kabul, accepted durumu, tedarikçi+döviz, tekil kabul satırı+ürün, miktar ve ADET×1. Tam faturalanmış kabulde kalan miktar0 tarihsel bağı bozmaz.
- Doğrulanmış depo mevcut kullanıcı etiketiyle **Mal kabul deposu** görünür. Kimlik/birim/depo bilinmiyorsa tahmin edilmez. Görünüm düğmesi request/journal yazmaz.
- Faturanın native kaydındaki belge kuru, cari kuru, hesap tutarı ve TRY karşılığı GET-only projection ile taşınır. Açık invoiceId/supplier/receipt/currency/document ve çift yönlü tüm satırlar aynı parent read transaction/typed bulk SELECT içinde doğrulanır. Mutation DTO ve journal değişmez.
- Kur8/tutar4 basamaklı değerler string olarak korunur. Tarihsel değer güncel kurdan hesaplanmaz; kur ID/tarih/version/kaynak detayları kayıtlı değilse üretilmez. Geçersiz/eksik snapshot görünürde bilinmiyor; çelişkili kimlik fail closed. Mevcut sınırlı aynı dövizli hesap kapsamı genişletilmedi.
- Yeni taslak için tarihli kur referansı yalnız taslakta görünür; mevcut faturada gizlenir. Kaynak alış fiyatı bilinmiyorsa faturalanabilir fiyat uydurulmaz. Eski belge yeniden fiyatlanmaz.

## Teknik kanıt

Root61/61 hedefli test, syntax/diff kontrolleri, High bağımsız source GO ve immutable build başarılı; commit-range secret scan0.

Normal15/16 aktörlerinde dört tedarikçi/döviz kapsamı:19 başarılı GET'in eski alanları aynıdır; tek yeni alan doğrulanmış recordedInvoiceBasis.8 yetki reddinin error semantiği aynı, requestId doğal olarak yenidir. Üç distinct mevcut fatura ve dört satır bağımsız native SELECT ile karşılaştırıldı. Her kabul satırında bir goods_receipt_batch stok hareketi; fatura kaynaklı ikinci stok etkisi0. Stok/kart/tedarikçi geçmişi bütün before/after recordsetlerde aynı. Bu yeni ticari/replay provası değildir.

Gerçek Chrome'da TRY, tek/iki satırlı USD, kayıtlı kur, Bağlı mal kabulü ve Yenile; personel yetki görünümü ve boş kapsam incelendi. Ölçülen üç genişlik ve ekranlar private browser-proof içindedir. Yeni ticari POST0; kullanıcı taslakları korunur. Teknik gözlem insan veya Zebra kabulü değildir.

Private kanıt: C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261013\private\c02-c03\recorded-basis. API/native before–after, projection proof, running/browser proof,61test logu, kaynak CI ve ekranlar. Ham isim/tutar/DTO ve ekranlar GitHub'a yüklenmedi. faedc80 önceki görünüm,49df420 depo etiketi checkpointleridir; final çalışan sourcef2f922a'dır.

## Kalan

C02/C03/B05 kısmi; genel işletme/birim/döviz kombinasyonları ve İlker/muhasebe kabulü açık. Mevcut okuyucu tarihsel belge fiyat/tarihini halen güncel mühürlü kapsamla eşitlik arar; güncel ürün adı/kodu join'i tarihsel snapshot garantisi değildir. Bu teslim native kayıtlı kur okumasını tamamlar, o genel reader sınırını değiştirmez.

ERP-UA11/UA32 bekliyor;49 toplam/9 tamam/39 kısmi/1 açık aynı, completeDelivery=false. OPS01 hız, gerçek Windows reboot/logon ve final native belge/video açık. GitHub altı source kontrolü FAILURE: hesap/ödeme nedeniyle başlamadı; yerelPASS veya Vercel bunu karşılamaz. Sonraki doküman HEAD ayrı raporlanır. LIVE/Vega/T1/main/CRM geliştirme/mesaj/ücretliAI/yetki/migration/temizlik yok.

[TEST alış ekranı](http://192.168.1.46:5234/ornek-akis.html#purchases): mevcut fatura→İncele→Bağlı mal kabulü→Faturayı yenile. Yeni işlem gerekmez.

## 17 Ekim — ERP-TEKNIK-23EKIM / P05 kayıtlı alış belgesini yeniden okuma

Yukarıdaki 13 Ekim paketi/CI gözlemi tarihsel kayıttır. Bu yeni kaynak düzeltmesi, kesinleşmiş faturanın kendi fiyat/tarihi ile güncel çalışma kapsamı farklılaştığında normal alış ekranının kapanmasını giderir. Yeni alış fiyatı, kur, stok, borç veya SQL nesnesi yazılmaz.

Üç gerçek kontrolör regresyonu önce FAIL verdi: yalnız güncel ürün fiyatı değişmesi, yalnız eski belge tarihi ve ikisi birlikte. Backend zaten native fatura tarihi/satır fiyatı ile exact mal kabulü ve kayıtlı kur dayanağını okuyordu; eksik frontend GET doğrulamasındaydı.

Ayrı `purchaseInvoiceRead`, yalnız doğrulanmış business TEST'teki **finalized GET** belgesinde fiyat/tarih farkına izin verir. Exact kayıtlı native dayanak; fatura/kabul/tedarikçi-hesap-party/döviz; tekil fatura, kabul satırı ve ürün kimliği; kabul edilmiş özgün miktar; kayıtlı satır fiyatlarından exact toplam korunur. Gelecek tarih, eksik/değişmiş dayanak, fazla miktar veya başka kayıt reddedilir. Belgenin fiyatı ve kuru güncel üründen yeniden hesaplanmaz.

`purchaseInvoice`, varsayılan context, yeni seçim/preview ve POST yanıtı aynı sıkı kontroldedir. Yalnız GET context/named GET çağrıları açık read-only yolu kullanır. Kaydedilmiş journal yanıtı tarihsel okuma yetkisi sayılmaz; fatura yeniden okuyucudan alınır. Ortak named GET helper'ı typed kimlik ve istenen→dönen fatura ID eşitliğini denetler; bozuk kimlikle GET dahi yapılmaz.

Son root koşusu **48/48 PASS, 0 skip**: `node --require ./scripts/ci/offline-guard.cjs --test` altında `workInbound.test.mjs`, `workPurchasePresentation.test.mjs`, `purchaseReference.test.mjs`, `workInboundFx.test.mjs`. Fiyat/tarih pozitifleri; missing/tampered/extra dayanak, yabancı kimlik/döviz, duplicate satır/ürün, miktar aşımı, kod/ad, toplam, seal/rate ve gelecek tarih negatifleri; POST varsayılan ret ve yanlış saved-ID yanıtı kapsandı. Bağımsız kaynak incelemesi GO; son Sites üretim build/syntax/diff temiz. Uzak tam source **c988ab606ff20826099c00181bc85f76db5e680f** / PR23; [PR39028258323](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39028258323) ve [push39028254830](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39028254830) completed SUCCESS. Bu exact kaynak CI’si sonraki belge HEAD’i veya çalışan TEST kurulumu değildir.

**Sınır:** Backend hâlâ güncel aktif ürün/birim/maliyet/kapsam bağını arar ve ürün kod/adını güncel join'den okur. Bu düzeltme genel tarihsel katalog/maliyet bağımsızlığı veya tarihsel ad snapshot'ı değildir. Mevcut çalışan ERPf5/CRM439b/denetleyici2bf0 değiştirilmedi; bu source henüz TEST'e kurulmadı. SQL/servis/rol/ticari yazı, yeni TEST, normal GUI veya insan kabulü yok. C02/C03/B05, ERP-UA11/32 ve 49/9/39/1 kısmi/bekliyor kalır;19/23/26–27/28/30 Ekim hedefleri aynı.
