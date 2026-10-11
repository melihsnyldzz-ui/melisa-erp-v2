# 200 farklı ürün / iki koli — gerçek native prova — 12 Ekim 2026

ERP-COMPLETE01 / ERP-DEC-044–047, mevcut kontrollü sentetik DB02 kapsamı. Normal dedicated personel15 kullanılır; admin veya yeni izin yoktur. TEST125, kaynak aktarımları, eski belgeler, roller, LL ve holdlar korunur. Kaynaklı işletme kartlarının izole kopyası, güncel Vega veya fiziksel mağaza sayımı değildir.

## Yazma öncesi kanıt

Çalışan kaynak204b63f, API4184/native4186/web5234, exact DB02/copy/low-privilege kimliği doğrulandı. Uygun pozitif stok adayları mevcut native seçili satış okuyucusundan tekrar geçti. TRY200 seçiminin belge toplamı mevcut sınırı aşar; sınır yükseltilmedi. USD200 seçimi mevcut döviz, fiyat kademesi, ADET/1, stok, karantina ve belge tutarı korumalarıyla önizlendi.

Tek immutable private plan: **200 farklı ürün,199 satır×1 +1 satır×24 =223 adet**, iki koli için24=23+1. Plan SHA256 `c82cbbab554047804740798a5092edfa7b2c21a80a09924ab838b4238dc0395b`. UUID/gövdeler,200 ürünün tam before-image'ı, seçilen carinin döviz hesapları/ana kartı, kasa/banka/tedarikçi tabloları, eski request journal ve koli kayıtları private tutulur. Ham isim/kimlik/barkod/tutar veya kaynak dosyalar Git'e alınmaz.

## İlk gerçek deneme ve geri okuma

Bağımsız kaynak review GO alan private helper ile normal API üzerinden aynı planın taslak çağrısı yapıldı. Client90s sınırında sonuç alınamadı; bu anda başarısızlık veya rollback ilan edilmedi. İlk authoritative request okuması `ISOLATED_COPY_BUSY` döndü; işlem sürerken ikinci kayıt açılmadı. Sonraki okuma404/`ISOLATED_COPY_REQUEST_NOT_FOUND` ve bağımsız tam before-image karşılaştırması **aynı** sonucunu verdi. Eski journal/koliler ve seçilmiş ürün/cari/finans/tedarikçi içerikleri değişmeden kalmıştır. İlk çağrının native transaction denemesi yapılmadı veya bütün SQL yazmaları0 diye sunulmaz; ticari commit/ikinci etki kanıtlanmadı.

Normal API logunun static router yolu `/work-sales/drafts` ile okunmasında gerçek503/`WORK_UNAVAILABLE` bulundu. SQL mesajı, sorgu, parametre, stack veya sır çıktıya taşınmadı. Mevcut normalizer'ın200 immutable satırdaki saf, yazmasız karşılaştırması:

| Kontrol | Sonuç |
| --- | ---: |
| Preview adı ile mühürlü kaynak adı birebir aynı |200|
| Native normalizer'ın sondaki boşluğu değiştirerek ürettiği ad |2|
| Değişen stok kodu / maliyet |0 /0|
| Ara toplam / genel toplam / tarihli TRY karşılığı |Üçü aynı|

`normalizeSalesItem` ürün adını trim eder; native fiş okuyucusu adın immutable preview ile tam eşitliğini ister. İki kaynak adının bu dönüşümü mevcut sıkı geri okuma koşulunu kesin olarak ihlal eder. Kaynak ürün kartı/adı değiştirilmez; doğrulanmış selectedSOURCE fiş snapshot'ında tam kaynak adı korunmalıdır. Bu teşhis henüz düzeltilmiş native200 satışın kabulü değildir.

## Liste performansı

Gerçek normal15 HTTP tanığı: native5 fiş listesi11.057s, tek fiş6.381s; packing3 finalized fiş listesi10.196s, aynı fiş7.094s. Normal yeşil tarayıcıda ilk liste okuması hata verdi; Yenile sonrasında fişler geldi ama eski hata yazısı kaldı. Başarılı ve doğrulanmış refresh sonrası eski hata temizlenir; pending journal uyarısı ve bütün kilitler korunur.14 controller kontrolü ve bağımsız review GO; çalışan paket sonucu ayrıca kaydedilir.

Mevcut paketin yazmasız faz ölçümü iki listede10.833/10.608s: outer READY1.49/1.46s, owner context3.32/3.67s, üç selected native context toplam5.33/5.03s. Üç seçimin grupları farklıdır; aynı seçime cache koymak bu mevcut ölçümde kazanım sağlamaz.12s upstream sınırı, SERIALIZABLE, güncel rol/hold/kimlik/fiyat/source proof kaldırılmaz. Performans açığı açık kalır.

## Dar kaynak değişikliği ve kapanma ölçütü

Yeni motor, tablo, TYPE veya guard değişikliği yok. Mevcut branded selectedSOURCE invocation ve hesap doğrulamasından sonra exact ürün kimliği/adı kaynakla eşleşirse snapshot adı korunur; genel normalizer aynıdır. Aynı trusted selectedSOURCE dalında çok satırlı kalemler mevcut kolonlara parametreli OPENJSON ile tek INSERT olarak yazılabilir; genel akış seri kalır. Mevcut trigger/intent/UUID/stock/currency/effects guardları bütün satırları denetler.

INSERT SELECT'in ordinal ORDER BY'si identity hesaplama sırasını belirler; fiziksel insertion veya OUTPUT sırası varsayılmaz. Native getter yine ID'ye göre okur. [Microsoft INSERT belgesi](https://learn.microsoft.com/en-us/sql/t-sql/statements/insert-transact-sql?view=sql-server-ver17#limitations-and-restrictions). Bu teknik dayanak gerçek200 satırın SQL/preview sırasını kontrol etmenin yerine geçmez.

Kapanma: controlled rollback/native ID→ürün→quote/fiyat/birim/ad eşitliği; sonra aynı plan/UUID ile normal API draft/finalize;223 stok etkisi ve yalnız seçilen USD cari etkisi; tam diğer alan koruması; iki kolide23+1, READY/kalan0/reload/replay; normal ekran kanıtı. Snapshot/hash eşitliği garanti edilmeden tekrar yazma yok. Yeni runtime, uygulama source ve belge teslim commit'i ayrı kaydedilir.

Private kaynaklar `readonly-candidates` içindeki plan, progress, request/before-image/normalization/timing sonuçlarıdır. Tarihsel yedek referansı mevcut before-image veya yeni inverse provaları yerine geçmez. Eski193 farklı ürünlü fişe sahte link eklenmedi. Önceki ADB politika reddi aşılmadı;200 cihaz ve yeni video **NOT_RUN/NOT_UPDATED**, ERP-UA32 insan kabulü bekliyor.49/9/39/1 aynı. LIVE/Vega/T1/main/CRM/gerçek WhatsApp/ücretli AI işlemi yok.
