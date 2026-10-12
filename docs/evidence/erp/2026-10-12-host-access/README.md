# Melisa Host korumalı TEST erişimi — dar çalışma

12 Ekim2026. Kullanıcının iletilen doğrudan talimatı yalnız Host üzerinden ERP/CRM korumalı girişidir. Ana ERP-COMPLETE01 Goal ve diğer işler paused; CRM ajanı, migration, eğitim ve ticari prova yeniden başlamaz. Host/port/yerleşim, mevcut servisler/veriler ve roller korunur.

Başlangıç: ERP source73f4b85 / Hub5234 / API4184 / native4186, CRM09ca /62700–04/native60e. Exact DB02/copy e16b70f0-4057-428b-9abc-6bbcaf35fe82, actualT1false; bütün listener'lar başlangıçta canlı. CRM repo0424ac7 içindeki11 staged başka-sahip belge/kanıt dosyası korunur.

Gerçek Windows istemcisi normal terminal adresinde `Bağlantı bekleniyor` gösteriyor; bu başarılı giriş değildir. Mevcut Windows korumalı ERP kayıt dosyası yok. Önceden hazırlanan IPC tanısı yalnız schemaVersion/stage/action/time kaydeder; credential/error/stack/path/user/token içermez. Fixed userData altı no-reparse kontrolü, create-new0600/fsync, best-effort kayıt, original generic ret, FIFO ve sender/health/vault guard'ları korunur. Root ve bağımsız reviewer22/22 hedefli test PASS/0skip; kaynak GO. Gerçek arıza aşaması yeni istemci çalıştırılmadan bilinmiyor.

Kimlik ayrımı: ERP protected grant/vault ve sealed operasyon profili yalnız15/personel ile16/İlker. Bu ID'leri Semih diye aliaslamak uygun değildir. ERP'de doğrulanmış normal Semih kimliği/rolü kanıtlanmadı; desteklenmeyen kullanıcı yönetimi yolu veya yeni geniş izin açılmayacak. CRM normal `crm-semih-test-20261012` / patron / doğrulanmış agent2 hazırlığı ayrı protected DPAPI kaydıyla mevcut; handoff aktiffalse. Bu CRM kimliği ERP kimliğini veya yetkisini üretmez.

Bu kayıt tanı hazırlığıdır; Semih girişinin, DPAPI yeniden açılışının, ERP–CRM geçişinin veya çıkış/iptalin tamamlandığını ileri sürmez. Parola istenmez; paylaşılan hesap reseti, statik HTML/URL tokenı, kimliksiz LAN yönetici girişi, finans/stok/satış/migration yazması yok. Sonuç gerçek ekran ve normal identity/revoke kanıtı ardından ayrıca yazılır.
