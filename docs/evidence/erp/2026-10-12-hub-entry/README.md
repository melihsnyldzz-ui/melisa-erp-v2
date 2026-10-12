# Mevcut Melisa Hub — Semih TEST girişi

Karar ERP-DEC-052. Hedef mevcut tarayıcı portalı `http://192.168.1.46:5234/melisa-hub/`; ayrı Windows programı iptal. Kaynak, çalışan paket ve insan kabulü ayrı tutulur.

Hub'ın yeşil ana düğmesi normal ERP'yi `ornek-akis.html?semih=1#stock` adresinde açar. Query yalnız görünüm niyetidir; oturum veya yetki vermez. İlk normal giriş, kullanıcıya parola sorulmadan korumalı TEST teslim kaydından ajan tarafından hazırlanır. Normal grant olmadan cookie oluşturulamaz. Cookie host-only, HttpOnly, SameSite=Strict ve dar auth path'indedir; yenileme sırrı URL, localStorage veya sessionStorage'a konmaz. JWT yalnız sayfanın belleğindedir. Bu HTTP TEST taşıması TLS veya Windows kullanıcı attestation kanıtı olarak sunulmaz.

ERP17 kaynak kimliği ve mevcut rolü, güncel parola/rol/izin fingerprint'i, exact DB02/copy ve normal session pair doğrulanır. Başka kullanıcının grant'i rotate/revoke öncesi reddedilir. Native15/16, kullanıcı rolleri ve ticari işlem guard'ları korunur. İlk grant normal parola doğrulamasından; restore/logout mevcut normal refresh motorundan gelir. Anonim LAN bootstrap veya yeni issuer yoktur.

Hub ve Çıkış düğmeleri mevcut taslak/gezinme korumasını kullanır. Çıkış normal grant ailesini iptal eder. CRM kendi issuer ve cookie'sini kullanır; ERP JWT'si CRM'ye gönderilmez. Semih CRM profili mevcut yedi kullanıcıyı değiştirmeden hazırlanmıştır; gerçek mesaj ve ücretli AI kapalıdır.

Root hedefli source kontrolü: `node --experimental-test-module-mocks --test` ile 13 ilgili test dosyası, **108 PASS / 0 FAIL / 0 SKIP**. İlk komuttaki mock flag eksikliği düzeltilmiş; başarılı sonuç `targeted-tests-final.txt` dosyasındadır. Backend ve frontend bağımsız source review sonuçları STATUS'ta kaydedilir. Bu sonuç çalışan ekran veya insan PASS değildir.

Özel kanıt alanı: `C:\Sirket\ERP\evidence\ERP-HUB-ENTRY-20261012\private`. Korumalı ilk giriş, runtime ayarları, grant/cookie/token veya ham CRM kayıtları Git'e eklenmez. ERP bekleyen performans dosyaları ve CRM'nin başka sahibine ait staged belgeleri bu teslimin dışındadır.

Çalışan paket, gerçek Hub→ERP/CRM ekranı, yenileme ve çıkış kanıtı teslim sonrası STATUS kaydında yer alacak. TEST125, ticari veriler, migration, LIVE/Vega/T1/main aynı; UA32 insan kabulü bekliyor.
