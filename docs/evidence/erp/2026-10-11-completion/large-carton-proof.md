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

Kaynak/build/gerçek çalışan paket ve sonheadCI sonucu sonraki teknik teslim kaydında ayrı yazılır. Yerel17PASS/bağımsızreview hostedCI veya insan kabulü değildir. Eğitim ZIP'i/video capture pinleri aynı; yeni koli yerleşimi ve200cihaz adımları eski videolarda gösterilmiş sayılmaz. Önceki training HTML politika reddi korunur. ERP-UA32 ve49/9/39/1 değişmez.
