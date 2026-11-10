# Yerel Muhasebe TEST hesabında insan tarafından parola yenileme

Kullanıcı 10 Kasım'da parola ekranını ajanın açmasını, yeni parolayı kendisinin girip kaydetmesini istedi. Önceki otomatik parola üretimi/korumalı aktarım hazırlığının reddi korunur. Bu araç o işlemi veya tarayıcıya credential aktarımını tekrarlamaz.

Sabit hedef `Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105`, DB5, GUID `c67f5317-9c0d-4831-aadd-fadc379a95d1`, ortam `eb2888c2-51cb-4570-a933-397cf7e62806`, schema7'dir. Yalnız etkin `erp_muhasebe_deneme`/30018 ve etkin, sistem dışı `desktop_accounting_test`/19 kabul edilir. Windows sahibi `SEMIH\Xaser`; native bağlantı sysadmin ve Shared memory olmalıdır. HTTP endpoint veya ağ dinleyicisi açılmaz.

Yerel WinForms penceresi parola kutularını maskeler. İnsan yeni parolayı iki kez girip **Parolayı kaydet** düğmesine basar. Ajan bu alanları doldurmaz, Kaydet'e basmaz veya `--apply` çağırmaz. Enter otomatik kaydetmez. Yeni parola 8–64 karakter, en fazla72 UTF-8 bayttır; değer normalleştirilmez. Parola üretilmez, eski parola veya hedef kullanıcının eski hash'i okunmaz; yeni parola dosyaya, rapora, komut satırına veya tarayıcıya aktarılmaz.

Pencere açılmadan `--prepare` yalnız native read-only transaction yürütür ve rollback yapar; güncel kullanıcı rowversion'ını bir saat geçerli hazırlığa bağlar. Kurulu7350a4fb/paket1995d9ed ve süreç/port kimliği tekrar doğrulanır. Kaynaklar pencere boyunca okuma kilidiyle tutulur; ortak schema sahiplik kilidi korunur. Bir binding dosyası root tarafından kaynak hash'leriyle sabitlenir; runtime veya kaynak değiştirilmez.

İnsanın Kaydet olayı aynı işlemde normal `resetManagedAuthPasswordCore` fonksiyonunu kullanır: bcrypt12, yalnız hedef kullanıcının password_hash/updated_at/updated_by/rowversion değişikliği, yalnız onun etkin refresh oturumlarının iptali ve bir audit. Role/grant, başka hesap, işletme ayarı veya ticari kayıt değişmez. Diğer kullanıcılar/oturumlar, rol/izin/ayar/kurulum ve iş tabloları önce/sonra hash'leriyle karşılaştırılır; eski audit satırlarının hash'i ve yeni tek audit doğrulanır. Sonuç belirsizse otomatik yeniden deneme yapılmaz.

Gerçek işlem/normal giriş ve GUI kabulü kaynak testinden ayrıdır. Başarılı parola kayıt sonucu normal ERP girişinin veya tahsilatın kabulü değildir. İnsan yeni parolasıyla normal ERP girişini tamamladıktan sonra Muhasebe ekranındaki kalan akış devam eder. Eski fatura20 tahsilatı ve ödeme7 tekrarlanmaz.

Kaynak doğrulama: `node --test scripts/desktop-empty/accounting-human-password-core.test.mjs` — sekiz saf injectable test. Yanlış hedef/kimlik/sürüm/rol ve insan onayı olmayan veya uyumsuz giriş hash/update öncesi reddedilir; aynı transaction, native sonucu ve hassas hata mesajlarının sızmaması doğrulanır. Testler SQL, gerçek parola veya UI açmaz.
