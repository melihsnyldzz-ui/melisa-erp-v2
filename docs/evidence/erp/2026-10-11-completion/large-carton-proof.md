# 200 çeşitli fişte koli hazırlama — 11 Ekim 2026

ERP-COMPLETE01 / ERP-DEC-044–047. Aynı terminal işi; işletme/cihaz veya insan kabulü tamamlanmış sayılmaz. Önceki iki adetlik satış/koli ve korumalı oturum kanıtları tekrar uygulanmadı. TEST125, DB02 native ticari verisi ve mevcut koli journal'ı değiştirilmedi.

## Dar ekran değişikliği

Kod/ürün adı araması baştaki sıfırları metin olarak korur. Önce50 satır, gerektiğinde sonraki50 gösterilir. Fişin gereken/toplanan/kalan miktarları filtreden bağımsız ve birim+çarpan ayrı grupludur. Seçili koli ve özet görünür; son okutulan satır öne gelir, adedini düzeltmeye doğrudan ulaşılır. Yeni koliye geçildiğinde aynı fişte devam edilir. Yerel değişiklik eski ortak READY sonucunu tamamlanmış göstermiyor.

Satır düzenleme itemId+seçili koliID ile bağlıdır. Mevcut birim/miktar, kaynak kimliği, izin, UUID/pending/CAS/replay ve journal korumaları değişmedi. QA modülü üretim ekranına import edilmez veya kendiliğinden server başlatmaz.

Root hedefli kaynak kontrolleri17/17, bağımsız UI13/13 ve QA kaynak incelemesi GO.200satırlı controller testi son satırın miktarını iki koli arasında düzenleyip DRAFT kaydediyor; bütün200satır READY/native fiş kabulü değildir. Ayrı FileStore fixture testi200farklı ürün×24=4800ADET, iki koli/save/reopen/replay/farklıUUIDbody reddini doğrular; yalnız sentetik metadata kanıtıdır.

## Gerçek fiş ve cihaz sınırı

Salt okunur native incelemede var olan200satırlı fiş193farklı ürün içerir; mevcut `work_sales_links`/sealedpreview/kaynak bağı yoktur. Üretim okuyucusuna sahte bağ eklenmedi ve kaynak guard gevşetilmedi. Mevcut terminale bağlı finalized fişlerde en fazla2satır vardır;200çeşitli normal native fiş kanıtı hazır değildir.

5294 üzerinde ayrı QA sunucusu normal mevcut aktör15/isolated_test_sales kimliğini API `/auth/me` ile her istekte doğruladı.200farklı ürün kaynağı açıkça sentetik; ilk198satır24'er adetlik tek koliye API metadata seed'iyle hazırlandı. Bu198satır cihazda tek tek toplanmış sayılmaz. Journal yalnız private `large-carton-device-proof-v1/journal`; gerçek `runtime/carton-packing-db02` alanına yazılmaz. SQL/finans/stok etkisi yok. Proof ekranı Chrome için ayrı yüzdür; kurulmuş v22 APK kanıtı diye sunulmaz.

**Cihaz NOT_RUN:** Zebra Chrome'da proof ekranını açan ADB komutu araç politikası tarafından yürütülmeden reddedildi. Alternatif araç/komutla bu ret aşılmadı.5294prova süreci kapatıldı; cihazda ürün arama/okutma/düzeltme/yeni koli/kaydet/yeniden aç sonucuna PASS verilmez. Sadece seed198/200 DRAFT vardır; son48adet tamamlanmamıştır. Normal APK/TEST5234 önceki çalışan tuple'ında korunur. Bu kontrollü hazırlık UI200cihaz kapanış ölçütünü karşılamaz.

Kaynak/build/gerçek çalışan paket aşağıdaki teknik teslim kaydında ayrı yazılır. Yerel17PASS/bağımsızreview hostedCI veya insan kabulü değildir. Eğitim ZIP'i/video capture pinleri aynı; yeni koli yerleşimi ve200cihaz adımları eski videolarda gösterilmiş sayılmaz. Önceki training HTML politika reddi korunur. ERP-UA32 ve49/9/39/1 değişmez.

## Çalışan paket teslimi — 12 Ekim 2026

Uygulama source **4b08fdce70b30c781dffafb47c73749bbf80fe01**; paket `CANONICAL-COMPLETE-TEST-20261011-4b08fdc`, manifest SHA256 `b3f44150d8d433012c023d05b7d789b99d9566bba19eef1f36d639144f6907eb`. İlk build yalnız yeni artifact adıyla üretildi; mevcut paket allowlisti için aynı yeni artifact exact path kontrolüyle COMPLETE adına alındı. Hiçbir eski paket taşınmadı; 1828 manifest dosyası bağımsız olarak doğrulandı, baseline rebuild aynı. Yeni operation/native config önceki 571d döndürülmüş configleriyle byte eşit; sır geri alma yok.

Mevcut iki Windows logon görevinin yalnız action pinleri yenilendi; principal/trigger/settings korundu. Root exact PID/creation/parent/owner kontrolüyle yalnız ilgili izole TEST süreçlerini kapattı. Yeni API4184/native4186/web5234 source4b; CRM09ca ve native-order60e aynı DB02/copyId/actualT1=false ile çalışır. TEST125/LIVE dahil40 korunan süreç değişmedi. İlgili dokuz web/terminal JS-CSS dosyası LAN HTTP200 ile paketten byte karşılaştırıldı; yeni koli kontrolü normal `terminal.html` bundle'ında bulunur. Bu HTTP kanıtı yeni görünümün gerçek Zebra ergonomi kabulü değildir.

Mevcut dedicated normal aktör15 ile desteklenen login→me→refresh→me→logout→401 doğrulandı; admin/rol genişletme yok. Yeni ticari SQL yazması0, migration/restore0, gerçek koli journal SHA aynı. 5294 fixture listener kapalı. Kesilen QA sürecinin kendi geçici parent oturumunun logout'u ayrıca kanıtlanamadı; yeni normal smoke oturumu düzgün kapatıldı. Bütün cihaz grantleri iptal edildi iddiası yok.

Kurulum: `http://192.168.1.46:5234/install.html`; normal terminal: `http://192.168.1.46:5234/terminal.html?worktest=1#packing`. Mevcut v22 APK/buildf3d aynı; APK değişikliği gerekmeyen merkezi web ekranı güncellendi. Yerel kısa rehber: `C:\Sirket\ERP\deliveries\ERP-TERMINAL-20261011\Koli-toplama-kisa-rehber-4b08fdc.md`. Önceki 38f tabanlı ZIP/video pinleri tarihli teslim olarak korunur; yeni yerleşim veya200cihaz adımları için güncel video sayılmaz.

Application4b Gitleaks dar commit taraması0bulgu/diff-check temiz; mevcut exact false-positive politikası genişlemedi. [Push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38174295168) ve [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38174298446) jobs steps=[]; GitHub annotation ödeme/harcama engeli bildirir. HostedCI PASS yok. Son belge teslim commit'i ve onun CI sonucu root makbuzunda uygulama source'tan ayrı tutulur.

**Kalan tek büyük fiş doğrulaması:** gerçek Zebra'da arama/son ürün adedi/iki koli/save/reopen ve buna bağlı güncel kısa video. ADB açılışı yürütülmeden politika tarafından reddedildi; başka araçla aşılmadı. Mevcut normal native200çeşit fiş guard kanıtı da hazır değildir; sentetik fixture bunu sağlamış sayılmaz. Yeni ana görev veya ticari prova otomatik başlamaz.


## 12 Ekim — gerçek kaynaklı 200 ürün okuması / yazmasız kapsam

HOME teslimi204b63f çalışan DB02 üzerinde root, normal15/me ve exact package/config/copy/low-privilege kimliğiyle yeni dar salt okunur önkontrol yaptı. İlk source-option batchlerinin EREQUEST vermesi tüm ürünlerin stoksuz olduğunu göstermez; private ilk sonuç korunup yorum `READ_VALIDATION_BLOCKED / NOT_ASSESSED` olarak düzeltildi. Bilinen tek ürün native context geçti;2/200 karışık seçim aynı51904/class16/line30/v2 ürün-drift korumasıyla reddedildi. İlgili ODBC hatada originalError.info yok; exact mesaj eşleşmesi doğrulanmadığından API error mapper veya native guard değiştirilmedi.

Mevcut sealed kaynak seçenekleri ve aynı native stok koşulu tek bulk SELECT ile önseçildi. Hiçbir miktar yuvarlanarak aday yapılmadı; NULL/missing/negatif/exact3 uyuşmazlığı mevcut predicate ile ayrı kaldı. Bu kaynak okuması yazma izni veya bütün alanlar uygun demek değildir.

| Döviz | Kaynak seçenek | En az1 adet stok adayı | En az24 adet stok adayı | Mevcut stok koşulunda ret | Pozitif1/2/200 native context |
| --- | ---: | ---: | ---: | ---: | --- |
| TRY |516|204|60|46|Üçü de READ_VERIFIED|
| USD |642|361|189|96|Üçü de READ_VERIFIED|
| EUR |0|—|—|—|Uygun kaynak müşteri hesabı yok|

TRY veUSD pool'ları aynı ürünleri içerebilir; sayıların toplamı tekil ürün sayısı değildir. Her pool'da native kart missing0 ve stok unknown0; ret sayısı tek başına tümünün negatif olduğu iddiası değildir. Pozitif adaylar ardından mevcut200 context okuyucusunun kaynak/birim/maliyet/fiyat/hold/rol/immutable pin korumalarından geçti; guardlar gevşetilmedi. Private numeric SQL teşhis wrapper'ının msnodesqlv8 transaction callback davranışı aynen korundu; uygulama kodu veya çalışma servisi değiştirilmedi.

Private `readonly-candidates/{result,interpretation,native-context-diagnostic-result,native-positive-candidates-result,native-error-shape-result}.json` root geri okumasıyla tamam; her kendi normal oturumu logout oldu. Ticari yazma/SQL DML0; yeni satış/fiş/koli/migration/grant0.200 çeşit birlikte okunabiliyor;200×24 mevcut gerçek stokla kanıtlanamadı. Fiyat toplamı/20000 sınırı,200 kalem preview/finalize/koli writer/replay ve gerçek cihaz/videosu henüz bu kanıtın kapsamı değildir. Önceki193çeşit eski fişe sahte kaynak linki yapılmadı, ADB politika reddi alternatif yöntemle aşılmadı, insanUA32 bekler.
