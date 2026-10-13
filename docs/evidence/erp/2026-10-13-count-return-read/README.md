# ERP13 / C10–C11 — mevcut sayım, alış iadesi ve ters kayıt görünümü

13 Ekim 2026; ERP-DEC-050/053 ana devam kapsamında. Yeni sayım, iade, iptal, onay, replay, inverse, stok/cari/finans hareketi veya restore yapılmadı. Tarihsel kabul edilmiş Goal3/Aşama4 işlem kanıtları kendi DB/source/kapsamlarıyla korunur; tekrar işletilmez.

## Çalışan sürüm

Uygulama source **0bf8f7df584fe975f912af7dea3507e41c1eebd2**, immutable **CANONICAL-COMPLETE-TEST-20261011-0bf8f7d**, 1876 dosya, manifest SHA256 **8d4f77c234db50bf85cce6c89937a471b5ef7a45040832660a42302957bc8a8c**. Web5234/API4184/native4186; Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02; copy e16b70f0-4057-428b-9abc-6bbcaf35fe82; actualT1/externalOperations/automaticJobs=false. Özgün TEST125 ve bütün önceki veri teslimleri korunur. CRM09ca/nativeOrder60e ve CRM sahibinin11staged dosyası aynı. Installer/v22 APK HTTP200; APK bytes/hash aynı, yeni cihaz kabulü değildir.

## Dar ekran düzeltmesi

- Normal sayım listesi, geçmişi ve salt okunur inceleme, iptal edilmiş kaydın **Geri alma gerekçesi** alanını özgün satır gerekçesinden ayrı gösterir. API'nin mevcut top-level reason alanı kullanılır; veri üretilmez veya değiştirilmez.
- İade geçmişi aynı kayıtlı geri alma gerekçesini özgün Açıklama'dan ayrı gösterir. Görünüm finans alanlarını sunucu rol projection'ının dışına çıkarmaz.
- İptal edilmiş sayım incelemesinde yeni uygulama öneren eski genel not yerine tarihsel/salt okunur açıklama vardır. Submit kapalı ve **Salt okunur kayıt**, mevcut yerel kapatma düğmesi **Kapat** olur.
- Boş, eksik veya beklenmeyen gerekçe tahmin edilmez: **Geri alma gerekçesi kayıtlı değil.** HTML escape uygulanır. Lab varsayılanı, pending, writer, journal, UUID/body, rol/izin ve hesaplama değişmez.
- Mevcut sayım anındaki sistem/fiziksel/fark ile sonraki hareketlerden oluşmuş güncel stok ayrı korunur. Eski sayım miktarı bugünkü stok olarak sunulmaz.

## Gerçek salt okunur teknik kanıt

Root17/17 hedefli test; source High GO, syntax/build ve dar secret scan0. Değişiklik5 frontend/test dosyasıdır; API/native/backend/SQL dosya değişimi0, startup225/CSS9 hashleri aynı. Kaynak incelemesi yalnız code GO'dur; insan kabulü değildir.

Normal16 ve personel15 ile dört count/purchase GET payloadı önce/sonra aynı (requestId doğal değişimi ayrı). Personel DTO'su mevcut sunucu redaction'ıyla doğrulanır; finans/stock.adjust/purchase.cancel yetkisi verilmez. Yeni ticari POST0; kendi normal auth giriş/çıkışı ayrı.

Parametreli ve sonlu15 native SELECT recordset önce/sonra aynı: mevcut iki taslak, özgün/ters stock ve supplier hareketleri, bir source alış faturası ve satırı/kabul-birim bağı, tek product/account ve journal/audit/roles. Kayıtlı mevcut sayım ve iade ters bağlantıları kontrol edildi; özgün+ters miktar/borç etkileri net0, sonraki güncel stok/hesap korunur. Bu okuma yeni replay veya inverse provası değildir; bütün DB'nin her satırının eşitliği iddia edilmez.

Canonical top-level reason native ters kayıt/journal gerekçesiyle eşleşir; özgün payload gerekçesi ayrı. Count result_json içinde nested reversal.reason vardır; return DTO'sunda yoktur. Görünüm ikisinde de mevcut top-level alanı kullanır.

Gerçek Chrome'da normal16 sayım listesi→Sayımı incele→Kapat ve İadeler→Açıklama→Yenile; personel15 salt okunur/finans gizli görünümü kontrol edildi. Üç hedefli genişlik, yenileme ve mevcut kapanmış kayıtların onay düğmelerinin kapalı olması private browser-proof içindedir. Kapanmış düğmenin kapalı görünmesi yeni yetkisiz POST403 testi sayılmaz. Fiziksel cihaz veya insan denemesi yapılmadı.

Private kanıt: C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261013\private\c10-count-return. before/after-api.json; before/after-native.json; verification.json; browser-proof.json/ekranlar; running-proof.json; root-targeted-tests.txt; source/delivery CI kanıtları. Ham isim/tutar/gerekçe/DTO/SQL/ekranlar GitHub'a yüklenmedi.

Yeni uninstalled build artefaktı ilk yanlış prefix'ten doğru0bf8f7d klasörüne aynı releases kökü içinde manifest doğrulanarak taşındı; çalışan eski paket ve arşivlere dokunulmadı. Build log tarihsel ilk adı korur; final manifest/source/path yukarıdadır. Paket kaynak commit'i ile sonraki doküman teslim commit'i ayrıdır.

## Genel kapsam ve insan kabulü

Goal3 TEST71/count39–return40 ve önceki Stage4 native yazma/replay/inverse kanıtları tarihsel kendi ortamlarıyla korunur. Bu güncel iki kapanmış kaydın READ doğrulaması genel FX/çok satırlı iade veya migration batch committed inverse'i kapatmaz. Personel–İlker–muhasebe gerçek kimlik matrisi ve geniş işletme kapsamı açık.

C10/C11🟡; ERP-UA15/16/18/32 **bekliyor**. 49toplam/9tamam/39kısmi/1açık aynı; completeDelivery=false. Yeni kullanıcı/rol/grant/parola değişimi yok. Source altı hostedCI FAILURE: ödeme/harcama nedeniyle başlamadı. Yerel testler CI veya insan PASS değildir. Genel ERP/LIVE tamamlandı denmez.

[Sayım](http://192.168.1.46:5234/ornek-akis.html#count) · [İadeler](http://192.168.1.46:5234/ornek-akis.html#returns). Mevcut ters kayıtla kapanmış satırları inceleyip Yenile; yeni işlem gerekmez. Dal codex/erp-finish-20261004 / PR23. LIVE/Vega/T1/main/CRM geliştirme/mesaj/ücretliAI/migration/temizlik yok.
