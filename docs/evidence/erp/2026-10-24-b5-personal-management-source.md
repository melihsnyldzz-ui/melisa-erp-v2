# B5: kişisel hesap ve personel bağı — kaynak teslimi

24 Ekim 2026. Taban `5b616c1577d5d1318978e39d415a3ef111fd708c`, ayrı dal
`codex/b5-clean-personnel-20261024`. Bu teslim B5'in **ilk teknik halkasıdır**;
kurulu başarı veya B5'in tümü tamamlandı anlamına gelmez.

## Düzeltilen yol

Temiz TEST'in dış HTTP süzgeci normal kullanıcı/personel yönetim yazılarını
reddediyordu. Servislerin genel yazma koruması da bu hedefi kabul etmiyordu.
Personel ekranı ayrıca var olan bir hesabı seçmek yerine yeni kullanıcı adı ve
parola istiyordu. Şimdi mevcut yönetici ekranları, servisler, bcrypt, işlem
bütünü, ortak kullanıcı oluşturma çekirdeği ve denetim kaydı korunarak:

1. Semih normal oturumuyla yeni bir kişisel kullanıcı oluşturur.
2. Mevcut izinli görev rollerinden birini seçer: satış20, depo23, finans25 veya
   sayım26. Yönetici rolü verilmez; rol/izin tablosu üretilmez veya değiştirilmez.
3. Personel ekranında bu yeni hesabı seçer; `employee.userId` bağı bir kez kurulur.
4. Yalnız bu yolla yeni oluşturulmuş kayıtlar güncellenebilir/pasife alınabilir;
   parolaları normal yönetim yoluyla yenilenebilir. Kullanıcı adı pasifken de
   başka kişiye açılamaz.

Örnek hesaplar ve Semih bu yönetim yazılarında korunur. Eski örneği yeniden
adlandırma/kişiye benimsetme, mevcut personelin hesabını başka kişiye bağlama,
genel SQL yazma izni, rol düzenleme veya terminal cihazı atama yolu açılmaz.
Yeni kişi için kullanıcı adı/kişilik eşleşmesi kurulurken tüm aktif/pasif
hesapların çakışma kontrolü gerçek uygulama sahibinin görevidir.

## Kaynak sınırı

- HTTP admission yalnız4194 / clean20261022 ve belirtilen POST/PATCH yönetim
  yollarında. Normal auth ve `settings.manage` zorunlu; servis ve native SQL
  aynı Semih10018/rol28 kimliğini yeniden denetler.
- SQL üreticisi `scripts/canonical/clean-personnel-management-sql.mjs` yalnız
  metin üretir; import etmek SQL'e bağlanmaz. Mevcut clean intent/trigger/ready
  düzenini kullanır; kaynak ve environment kimliği tam eşleşmelidir.
- Yeni yönetim kaydı ve tek denetim kaydı aynı transaction içinde tamamlanır.
  Parola/hash intent veya audit içine yazılmaz. Audit/native ret halinde tüm
  işlem geri alınır. SQL Server AFTER trigger ile uyum için kullanıcı/personel
  INSERT sonucunda mevcut OUTPUT, tablo değişkenine OUTPUT INTO olarak alınır.
- Mevcut iş akışlarının SQL gövdeleri ve eski manifest kayıtları korunur. Yalnız
  ortak audit trigger'ına yönetim dalı ve değişen modüllerin readiness bağı eklenir.
- `clean_personnel_members` sadece bu yolla yeni açılmış ID'leri içerir. Örnek
  kullanıcıları bu tabloya ekleyen seed veya kişi/ad/ID listesi yoktur.
- Normal login mevcut bcrypt/JWT/SQL refresh yolunu kullanır. Tarihsel temiz
  kurulum kaynağı `runtime/prepare-credentials.ps1:14` zaten auth_refresh_tokens
  INSERT/UPDATE ve users(last_login_at) UPDATE tanımlar. Bu kaynak satırı okundu;
  güncel canlı yetkiler bu teslimde SQL üzerinden sorgulanmadı. E1 korumalı
  oturum/handoff ve Android kodları değiştirilmedi.

## Kontroller ve kanıtın sınırı

Yerel değişen yol: 17 test PASS,0 fail/skip; web-admin build PASS.

- 3 API admission/native witness kontrolü: yanlış hedef, sahte yönetici, izin
  eksikliği, yönetim dışı rota, hatalı witness ve protected kayıt reddi.
- 3 web model kontrolü: aktif-yeni-boşta hesap seçimi, mevcut hesabı bağlarken
  parola tekrar göndermeme, sınırlı görev rolü ve eski davranışın korunması.
- 3 SQL **kaynak** kontrolü: exact predecessor, transaction/guard bağı, eski
  audit gövdesinin korunması, eski iş aktörlerinin değiştirilmemesi.
- 5 gerçek Express/auth middleware/servis/core/bcrypt akışı, **bellek içi SQL**:
  yeni sentetik50101 kullanıcı→normal login→izinli okuma→60101 personel bağı→
  yeniden okuma; duplicate, anonim, yanlış rol, protected örnek, audit rollback,
  parola yenileme, bağı değiştirememe ve pasif hesaba401.
- 3 mevcut ortak kullanıcı çekirdeği kontrolü: genel hedef koruması ve duplicate/
  audit hata rollback davranışı değişmedi.

Test sunucusu yalnız offline guard'ın izin verdiği geçici port0 üzerindedir.
SQL Server'a, Vega'ya veya kurulu uygulamalara bağlantı yapılmadı. SQL metni
gerçek SQL Server'da parse/execute edilmedi; native trigger/procedure davranışı
bu testlerle kurulu doğrulanmış sayılmaz. Yeni kişisel kullanıcıyla satış,
mal kabul, sayım veya finans işlemi bu teslimde başarılı gösterilmedi.
Build'in mevcut lucide/chunk boyutu uyarıları sürer.

## Tek sonraki uygulama adımı

ERP sahibi exact kaynak/CI ve kendi güncel E1 değişiklikleriyle çakışma incelemesi
sonrası bu dar adayın normal yönetim API/UI ve metadata'sını kendi tek-owner
kurulum sırasına alır. Önce aynı temiz hedefte mevcut metadata önkontrolü ve
`buildCleanPersonnelManagementSql({probe:true})` ile rollback'li SQL doğrulaması
gerekir; bu kaynak teslimi onu çalıştırma yetkisi/kanıtı değildir. Probe mevcut
hedef veya predecessor farkında reddederse yeni genel izin açılmaz. Başarılı
owner kurulumu sonrası bir açık sentetik yeni kullanıcı ve personel bağı normal
ekrandan denenir; Semih ve eski örnekler korunur. Gerçek kişi hesabı oluşturma
ve özel parola teslimi bu offline çalışmada yapılmadı.

## B5'in sonraki zorunlu halkası: kişinin kendi işi

Bu PR mevcut örnek aktörlerin yerine başka kullanıcıyı sessizce koymaz. Yeni
rolü vermek tek başına satış/mal kabul/sayım/finansı çalıştırmaz. En dar devam:

1. `cleanPersonnelManagement.mjs` ve mevcut roles/permissions modeli: kullanıcının
   onayladığı ortak görev birleşimini tanımla; her personele admin verme. Angela
   ve İlker'in kapsamlarını ayrıca koru. Kişisel kayıt ile aktif çalışan bağı
   native üyelikten doğrulanmalı, sadece roleId yeterli sayılmamalı.
2. Satış: `cleanDirectSaleService.mjs`, `cleanOrderSaleScope.mjs` ve
   `scripts/canonical/clean-direct-sale-sql.mjs` içindeki Semih10018 dalını
   koruyarak aynı örnek müşteri/ürün/tarih/tutar/tekrar sınırlarında kayıtlı
   kişisel aktör dalı ekle. İşlemin creator/employee bağı kişinin kendi ID'sini
   taşımalı; yeni aktör adına Semih/örnek ID'si yazılmamalı.
3. Mal kabul/sayım/finans: `cleanStoreDayStore.mjs`, `cleanStoreDayScope.mjs`,
   `cleanFinanceRehearsalModel.mjs` ile `clean-store-day-cohort-sql.mjs` ve
   `clean-finance-rehearsal-sql.mjs` içindeki binder/trigger/constraint aktör
   koşullarını birlikte ele al. Örnek hedef ve miktar sınırları, görev ayrımı,
   başkasının kaydıyla işlem reddi ve idempotency korunmalı.
4. Aynı normal kişisel login'in kendi onaylı TEST işini tamamlaması, yanlış
   kişi/rol/pasif çalışan için401/403 ve eski örneklerin regresyonu anlamlı
   uçtan uca kanıtlanmadan B5 kapanmaz. CRM kişisel hesabı/müşteri ataması ve
   E1 kalıcı terminal oturumu ilgili sahiplerle ayrı eşleştirilir.

Genel writeGuard/auth/permission kapatma, yeni yönetim motoru, gerçek SQL yazısı,
runtime değişikliği, main merge, yayın veya insan kabulü yapılmadı.
