# B5: kişisel hesapların günlük TEST işleri — kaynak teslimi

24 Ekim 2026. Ayrı dal `codex/b5-personal-work-20261024`, taban
`c4d4eb81f16e68787f1c420aa1d5d5776dfe8043` (PR58). PR58'in normal
kullanıcı oluşturma ve personel bağı halkasının devamıdır. **Kurulmadı; B5'in
tamamı veya gerçek personel kabulü olarak sayılmaz.**

## Sonuç ve sınır

Önceki normal yönetim yolu kişisel hesabı oluşturabiliyor, günlük işler ise
örnek kullanıcıların sabit kimliklerini bekliyordu. Mevcut servis, işlem motoru,
normal giriş ve SQL binder/trigger düzeni kişisel aktörün kendi kimliğiyle
çalışabileceği şekilde genişletildi. Sadece mevcut temiz, yapay TEST hedefi ve
onun mevcut sonlu ürün/müşteri/tedarikçi/tarih/tutar/para birimi kapsamı geçerli.

Mevcut tek-rol modelinde üç birleşik görev eklenir:

| Görev | Kaynak rolü | İzin verilen TEST işi |
|---|---|---|
| Personel | 30 / `clean_test_personnel` | Kendi satışını oluşturma/onaylama, kendi mal kabul sayımı, stok sayım taslağı |
| Uygulama yöneticisi | 31 / `clean_test_personnel_manager` | Personel işleri, normal yeni hesap/personel yönetimi, mal kabul/sayım incelemesi, finans/kasa |
| Muhasebe | 32 / `clean_test_personnel_finance` | Mevcut sınırlı tahsilat/ödeme/iptal ve kasa işleri |

Bu ID/kodlar yalnız kaynak tercihidir; gerçek çakışmada kurulum reddedilir.
SQL üreticisi üç rol/izin satır kümesini tanımlar, **kişisel kullanıcı veya
personel oluşturmaz**. Gerçek isim, kullanıcı ID'si veya parola yoktur.
Semih ve örnek hesaplar korunur; eski tek görevli seçenekler değiştirilmez.
Yeni birleşik günlük akış için yukarıdaki üç görev kullanılır.

Her kişisel okuma/yazma aktif kullanıcı + etkin rol + etkin personel + kayıtlı
`employee.userId` bağını aynı native transaction içinde yeniden kanıtlar.
JWT'deki rol tek başına yetki değildir. Satış ayrıca personel kartındaki
`canTerminalSale` iznini gerektirir. Mevcut izin anahtarları, işlem özeti,
istek kimliği, tek etki, audit, finiş ve geri alma kontrolleri korunur.

- Satış yalnız kendi belgesidir; başka kişinin UUID/belgesine erişim reddedilir.
- Personel yalnız kendi mal kabul/sayım taslağını görür ve ilerletir; yönetici
  inceleme yapabilir. Personel maliyet, finans ve stok düzeltme onayı alamaz.
- Kişisel muhasebe kendi tahsilat/ödemesini iptal eder. Yönetici yalnız kayıtlı
  kişisel aktörün işlemini inceleyebilir; eski örnek işlem kabulleri korunur.
- Normal yöneticinin hesap değişikliği yalnız PR58'in yeni kayıt kümesindedir;
  Semih veya örnek hesap başka kişiye atanamaz.

`scripts/canonical/clean-personnel-work-sql.mjs` metin üreten kaynak modülüdür.
İçe aktarma SQL'e bağlanmaz. 31 modül değişikliği mevcut işlem bağları ve bunların
hazır olma/hash bağı uyarlamalarıdır. Önceki mühürler değiştirilmez; eski
tanımlar ve constraint metinleri yeni immutable kaynak kaydında korunur.
Mevcut `CLEAN_STORE_DAY_20261022` kilidi ve tek atomik kurulum kullanılır.
Yeni genel izin/yazma motoru, cihaz servisi veya kurulum işi açılmaz.

## Doğrulama

- Değişen yolun 51 hedef kontrolü PASS: kişisel satışın oluşturma/onaylama/
  yeniden okuma/tekrar gönderimde tek etkisi; mal kabul sahipliği; stok sayım
  kapsamı; etkin personel, güncel izin ve hedef reddi; finans/para birimi/kasa
  bağları; native kaynak, eski örnek ve korumalı kayıt sınırları.
- Normal Express rota/auth/bcrypt/servis/core akışı 6 kontrol PASS: normal
  Semih oturumundan yeni yönetici ve bağlı personel, onun oturumundan yeni
  personel, normal giriş/okuma; yanlış rol, anonim/pasif kullanıcı, duplicate,
  örnek hesabı benimseme ve audit hatasında rollback.
- Microsoft ScriptDom TSql160Parser: 31 modül + kurulum + probe olmak üzere
  33 SQL kaynak girdisi, sıfır sözdizimi hatası. Sunucuya bağlantı yapılmadı.
- Yeni canonical kaynak testi mevcut CI listesine eklendi. API testleri mevcut
  CI'nin otomatik dosya toplamasına dahildir; exact head CI sonucu PR'de tutulur.

HTTP testi rastgele loopback portunda, SQL testleri bellekteki sentetik
50101–50104 kullanıcı/60101–60104 personel ile yürür. İşlem hesabı ve SQL taşıması
fixture'dır; gerçek SQL trigger çalışması veya asıl fatura motorunun SQL etkisi
kanıtlanmış değildir. ScriptDom da nesne çözümleme/kurulu izin/transaction
yürütme kanıtı değildir. Normal ekran ve cihaz kullanılmadı.

## ERP sahibinin sonraki tek adımı

E1 işiyle dosya çakışmasını ve exact CI'ı kontrol ederek PR58 + bu devamı kendi
kurulum sırasına alır. Mevcut temiz hedefte her iki metadata üreticisinin
rollback'li probe'u, güncel role/aktif-pasif kullanıcı çakışması ve native
predecessor/constraint uyumu doğrulanır; farklılıkta genel kontrol gevşetilmez.
Tek owner kurulumu ardından yeni açık sentetik kişisel hesap normal yönetim
ekranından açılıp personeline bağlanır. Normal girişten kendi satış/mal kabul/
sayım ve muhasebe işi, yanlış kişi/rol ve pasife alınma denemeleri gerçek SQL
transaction/trigger sonucu ve yeniden okuma ile kanıtlanır. Kaynak testlerini
bu kurulu kabulün yerine sayma.

Toplama/kolilemenin ayrı personel izni mevcut terminal yolunda henüz ayrı bir
anahtar değildir (`terminalCartonService` mevcut `sales.view` kullanır).
Mehmet/Turgay ve Angela için bu ayrım E1 sahibine açık bağımlılıktır; terminal,
Android/Keystore, kalıcı oturum, CRM ataması ve handoff dosyaları bu teslimde
değişmedi. Gerçek personel kimlik/hesap eşlemesi ve son cihaz/insan kabulü açıktır.
