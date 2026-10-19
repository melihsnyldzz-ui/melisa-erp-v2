> Full-installation correction — 19 October: [actual full ERP/CRM/terminal inventory and infrastructure blocker](full-runtime-audit.md). Parent's hosted15:52–15:59UTC three-flow PASS is recorded there with its limited scope. This document's earlier localhost/source evidence does not establish full application installation or human acceptance.

# 19 Ekim — ERP09 / C01–C04–C05 ve CRM06 ortak sentetik Cloud kaynağı

[ERP PR55](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/55) ve [CRM PR20](https://github.com/melihsnyldzz-ui/melisa-crm/pull/20), her iki repoda `codex/cloud-shared-test-20261019`. ERP taban5ab4f84/PR23, CRM taban03a8609/PR19; yerel candidate19 ve PR31/32 değişmedi. Bu kaynak ve sentetik Cloud QA sonucudur; gerçek shared TEST kurulumu veya insan kabulü değildir.

Gerçek mevcut ERP receiving/sales/collections controllerları ve CRM CatalogBuilder/ERPOrderDialog/NativeOrderReceiptDisplay, ayrı Cloud girişinden **aynı sunucu SQLite/D1 API** ile çalışır. Ayrı localStorage iş veritabanları veya sahte ekranlar yoktur. Sabit küçük sentetik roller,2ürün/2müşteri/1tedarikçi; gerçek auth/SQL/config/servis/Windows/Vega/LIVE/T1 veya müşteri mesajına erişim yok.

## Gerçek tarayıcı sonucu

390×844 Chromium: personel15 ürün101 barkodunu okutup4adet saydı, kaydetti/gönderdi; İlker16 kabul etti,stok10→14. Angela17 gerçek CRM kataloğunda14gördü,2adet/25TRY satırla gerçek ERP diyaloğundan kalıcı sipariş taslağı oluşturdu. Yenileme ve sunucudan tekrar açma PASS;stok14/borç0. Personel15 aynı taslağı gerçek ERP satış fişine aktardı;tamamlama stok12/borç50TRY. İlker16 gerçek tahsilat ekranından20TRY kaydetti;kalan/borç30TRY. Sayfa ve tüm sunucu/SQLite yeniden açıldığında aynı kayıt;diğer personel18 sipariş/satışları göremez. [Makine sonucu](result.json):8doğrulanmış koşul,pageerror0,1sayım/1sipariş/1satış/1tahsilat/7journal. Ekranlar: [kabul](receiving-approved.png),[CRMtaslak](crm-draft.png),[tahsilat](partial-collection.png).

## Kod/test/inceleme

27 backend/HTTP/SQLite/D1/Worker testi,3ERP cloud adapter testi ve5CRM adapter testi PASS. D1 Worker testinde HER HTTP isteğinde yeni Worker/store/session handle açılır;cookie/CSRF/bearer,aynıUUIDreplay,stok/borç ve persisted session korunur. İki eşit tutarlı tahsilatın kayıtID'si ve bozuk/yinelenen sayım satırı kimliği regresyonları FAIL→PASS. Bağımsız kaynak incelemesi GO;iki ayrı cloud Vite build/offlineguard PASS. Tarayıcı runnerı ve tekrar üretim/paketleme komutları [kaynak README](../../../../apps/cloud-shared-test/README.md).

CI final teslimHEAD'i PR checklerinden ve son teslim makbuzundan ayrıca doğrulanır;eski checkpoint CI'si yeniHEADPASS sayılmaz. İlk afca0f4 CI'dequality/build/WindowsPASS,Gitleaksfullhistory26eşleşme vardı. 21benzersiz tarihsel fingerprint:5publicsource/manifestpin,15sentetikprovenancefixture,1fixedUUIDtest;bağımsız inceleme gerçek0/belirsiz0. Mevcut adaydalında zaten incelenmiş yalnız21exactcommit:file:rule:line kaydı yeniden kullanıldı;genelrule/pathallowlist veya scannerdeğişimi yok. YeniCloudkoduna credentialkonmadı.

## Yayın ve kabul sınırı

Owner-private yayın yapılmadı;buortamda zorunluSiteshelperları yok. Parent kendi desteklenenSites ortamında exact kaynak/WorkerESM ve proje köküdrizzle ağacını paketleyecek. Kaynakbuildscripti SQL+metadatajournalı artifactdrizzle dizinine verir;nativehelperbunu dist/.openai/drizzle içine taşımalı ve DB bindinginde iki tablo migrationla kurulmalı. Runtime schemaManaged=true;eksik şema503,DDL/seedmigrationu yok. Nativepaketleme/hostedaccess doğrulaması parenttaBEKLİYOR;Workerbundle tekbaşına tamamteslim değildir.

Bu üç çekirdek akış dışında genel finans hareketleri/tedarikçi ödemeleri, fotoğraf ve kaynak katalog servisi, eğitim rotaları bu ayrık Cloud girişine bağlı değildir. Gerçek Windows TEST, fiziksel telefon/terminal ve son toplu insan kabulü BEKLİYOR. Özgün49ERP/25CRM yaprağı ve kapanış sayıları değişmedi; yeniGoal/tracker yok.
