# ERP12 / C08 — mevcut günlük finans okuması

13 Ekim 2026. ERP-DEC-050/053 ana devamı içindeki salt okunur teknik alt kapsam. Yeni tahsilat/ödeme/önizleme/iptal, stok/cari/finans yazması veya eski işlem/replay provası yok. Gözlenen güncel panel arızası yok; uygulama kodu, paket, runtime/config, izin veya ticari veriler değiştirilmedi.

## Son çalışan paketle bağlantı

ERP source **f2f922af81be6a1852f49ee7a6cf5c6bdb7a1477**, **CANONICAL-COMPLETE-TEST-20261011-f2f922a**, 1876 dosya, manifest SHA256 **2840ecbeaa17c84cd452e78de5738ee2ab494d36f7bb35756c26ce513857e26a**. Web5234/API4184/native4186, Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02, copy e16b70f0-4057-428b-9abc-6bbcaf35fe82, actualT1=false. [Son paket/servis kimliği](../2026-10-13-purchase-receipt/README.md) korunur; bu okuma turunda yeni paket üretmek veya restart gerekmedi. TEST125, CRM09ca/native60e ve CRM sahibinin11staged kaydı değişmedi. SourceCI'nin altı hesap/ödeme engeli kaydı aynı exactsource'a aittir; yeni doküman HEAD ayrı kontrol edilir.

## Normal ekranda doğrulanan

- **Tahsilat:** mevcut sonlu günlük kapsamın iki TRY fişi, açık/kısmi durum, kaydedilen tahsilat, fişin kalan tutarı ve cari bakiyenin ayrı olması; Yenile aynı seçimi ve değerleri korur.
- **Kasa ve banka hareketleri:** müşteri girişi ve tedarikçi çıkışı doğru hesap/dövizle okunur; TRY/USD/EUR ayrı. USD/EUR sıfırları yalnız gösterilen hareket kapsamındadır. Net hareket toplamı hesabın mevcut bakiyesi veya açılışı değildir; ekran bunu açıklar. Banka hesabı bağlı değil ifadesi görüldü.
- **Tedarikçi Ödeme:** mevcut ödeme tarihi, yönü, tutarı/dövizi, hesap ve mal kabulü→alış faturası→ödeme bağı; Yenile sonrası aynı geçmiş. Ödeme mevcut borca etki etmiş, ikinci stok etkisi olduğu ileri sürülmedi veya yeni işlem yapılmadı.
- **Yetki:** normal personel15 ödeme görüntülemesinden403 ve anlaşılır UI mesajı alır. Diğer mevcut satış/tahsilat okumaları kendi izinli kapsamıyla korunur; genel finans yetkisi verilmedi.16 mevcut yetkili günlük kapsamı okur.
- İşlem kayıtlarının tarihi9Ekim; bugünkü işlem veya güncel Vega bakiyesi diye sunulmaz. Deneme kaydı etiketli hesabın görünen native bakiyesi gerçek mağaza açılış kabulü değildir.

## Bağımsız API/native kanıtı

17 GET slotunun önce/sonra payloadı aynı: 16 başarılı ve 1 aynı yetki reddi; requestId doğal değişimi ayrı.409 kapsam reddi0.16aktörünün iki günlük fişi ana C08 kapsamıdır;15'in ekSOURCE fiş okumaları yalnız mevcut readonly uyum kanıtıdır. Toplam7native başlık, **1 mevcut tahsilat / 1 mevcut ödeme / 1 hesap** bağlantısı doğrulandı; bu sayılar toplanıp işlem veya ürün toplamı yapılmaz.

Parametreli, sonlu native SELECT: fatura/collection link→müşteri hareketi→kasa defteri ve ödeme→tedarikçi hareketi→alış faturası/kabul→aynı kasa hesabı. Kendi tutar/döviz/yönü ve copy/request/actor/operation journal bağları kontrol edildi. Exact4/8 metin hassasiyeti; dokuz recordset ve digest önce/sonra aynı. Yeni ticari etki0; bütün DB'nin her satırının kontrolü iddia edilmez.

Bu güncel kayıtlarda tahsilat/ödeme ters kaydı sayısı0; yeni inverse veya replay çalıştırılmadı. [Goal3](../2026-10-06-finops/README.md) ve [Aşama4](../2026-10-09-stage4/README.md) kabul edilmiş native ters kayıt/prova kanıtları kendi eski DB/sürüm/kapsamlarıyla korunur; bunlar yeni ters kayıt yapılmış gibi sunulmaz.

Private kanıt: C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261013\private\c08-finance. before/after-api.json, before/after-native.json, verification-v2.json, browser-proof.json ve ekranlar. İlk private SQL207 probe'daki desteklenmeyen finance kolonu kaldırıldı; yalnız okuma probu değişti. İlk verifier, tradeNULL/paymentkayıtlı numeric opening alanlarını aynı varsaydığı için durdu; v2 iki gerçek DTO sözleşmesini ayrı doğrular, sealedUNKNOWN/insanfalse şartlarını korur. Başarısız artefaktlar saklandı; uygulama hatası veya ticari düzeltme değildir. Ham tutar/isim/DTO/ekranlar GitHub'a yüklenmedi.

## Açık kalan genel C08 ve insan kabulü

Mühürlü hesapta **openingVerified=false / UNKNOWN / openingHumanAccepted=false** korunur; numeric başlangıç tanığı gerçek açılış olmaz. Daha önceki39hesap matematiksel analizindeki gerçek açılış0/39 kaydı tarihsel işletme engelidir; bu tur39hesap yeniden hesaplanmadı, fiziksel sayım/ekstre alınmadı.

Gerçek kullanılacak kasa/banka ve döviz, aynı tarihli kasa sayımı/banka ekstresi, devir/yoldaki işlem ve ayrı sayısal onay gerekiyor. Banka bağlantısı, gerçek gün sonu kapanışı ve genel işletme/döviz kapsamı açık. Günlük hareket paneli hâlen sonluTRY/defaultmüşteri kapsamındadır; genişSOURCE/müşteri/döviz kombinasyonu bu alt kapsamdan kanıt almaz. Ödeme geçmişinde saklanan kur snapshotları gösterilmiyor; ödeme hesabı seçimi ayrıca gerçek açılış kabulü sunmaz. Bunlar genel kapsam/presentation sınırları, gözlenen panel regresyonu değildir.

C08/B06🟡; ERP-UA14/UA32 ve diğer insan kabulleri bekliyor.49toplam/9tamam/39kısmi/1açık ve completeDelivery=false aynı. Güncel kod değişmediğinden eskioffline/prova testleri tekrarlanmadı; yeni kanıt gerçek okuma ve native eşleştirmedir. LIVE/Vega/T1/main/CRM geliştirme/mesaj/ücretliAI/temizlik yok.

[Tahsilat ve hareketler](http://192.168.1.46:5234/ornek-akis.html#collections) · [Tedarikçi Ödeme](http://192.168.1.46:5234/ornek-akis.html#supplier-payments). Mevcut fişi/ödeme geçmişini inceleyip Yenile; yeni işlem gerekmez.
