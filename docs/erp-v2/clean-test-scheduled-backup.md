# C5 — Temiz TEST düzenli SQL yedeği

24 Ekim 2026. **Kaynak teslimi; görev kurulmadı, yeni SQL yedeği alınmadı.**

Mevcut `scripts/canonical/goal7-test-backup.ps1` aracı yeni `Clean20261022`
profiliyle kullanılır. Eski Goal7 profili varsayılan olarak korunur. Yeni bir
yedek motoru, Windows servisi veya uygulama açılış görevi eklenmez.

| Ayar | Değer |
|---|---|
| SQL sunucusu | `Semih\MELISADEV` |
| Kaynak | `MELISA_ERP_CLEAN_TEST_20261022` |
| Ortam kimliği | `e662fd94-d797-4b3b-938a-d143ad758b67`; synthetic=1, actual_t1=0, external_operations=0 |
| Mevcut yedek üst dizini | `C:\Sirket\ERP\backups` |
| Yeni her çalışma | `CLEAN-20261022-C5-<UTC zaman>-<GUID>\CLEAN_TEST_COPY_ONLY.bak` |
| Görev adı | `Melisa-Clean-20261022-NightlyBackup` |
| Kaynak görevin zamanı | Her gün 03.00, Windows yerel saati |
| Başlangıç saklama tercihi | Bütün dosyaları koru; otomatik silme yok |
| Aynı anda ikinci çalışma | `IgnoreNew` |

Günlük 03.00 ve silmesiz başlangıç, kullanıcı adına seçilmiş geri alınabilir
teknik varsayımlardır. Kurulumda Windows saat diliminin Türkiye olması
doğrulanır. NAS/harici kopya hedefi seçilmiş değildir; yerel kopya bilgisayarın
veya diskin tamamen kaybına karşı bağımsız yedek sağlamaz.

Araç SQL'e Windows hesabıyla bağlanır; eski aracın mevcut SQL yetki kontrolü
korunmuştur. Görev tanımı `InteractiveToken` / `LeastPrivilege` kullanır,
parola saklamaz. **Windows kullanıcısı oturum açmamışsa çalışacağı iddia edilmez.**
Kaçırılan saatte `StartWhenAvailable` uygulanır; gerçek zamanlı çalışma ve
oturum kapalı davranışı ayrıca kabul gerektirir.

## Kaynak davranışı

- Temiz profil serbest sunucu, DB, ortam kimliği veya yedek yolu almaz.
- B7'nin kullanılmış exact temiz hedef/ortam SQL koşulu, yedek komutunun
  içinde de doğrulanır. Yanlış DB veya gerçek T1/dış işlem durumu reddedilir.
- Her çalışmada yeni GUID'li klasör oluşur. Eski yedek ve makbuzların üzerine
  yazılmaz. Klasör ACL'si mevcut runner ile sahip, SYSTEM, Administrators ve
  SQL hizmetine sınırlandırılır. Reparse üst dizinleri reddedilir.
- `COPY_ONLY`, `CHECKSUM`, `NOINIT`, exact başlık kimliği, `VERIFYONLY WITH
  CHECKSUM` ve dosya SHA256 aynı runner içinde kullanılır. Express'te sıkıştırma
  istenmez. Başarılı makbuz ancak hepsi geçtikten sonra `CreateNew` ile yazılır.
- Başarısız yeni dosya yerinde kalabilir; başarı makbuzu yoksa sağlam yedek
  sayılmaz. Önceki doğrulanmış yedekler korunur; otomatik temizlik yoktur.
- Bu araç restore, reset, veri aktarımı, eski görev kapatma veya uygulama
  restart işlemi yapmaz.

## ERP sahibinin sonraki adımı

Kaynak inceleme/CI sonrası bu tek runner dosyasını esas temiz TEST paketine
almak; ardından aynı Windows hesabının ve hedefin mevcut yetkisiyle `Preflight`
çıktısını doğrulamak. `Preflight` SQL'e yalnız okuma bağlantısı yapar; temiz
profilde dosya/klasör/yedek yaratmaz. Çocuk ajan bu komutu çalıştırmamıştır.

```powershell
powershell.exe -NoProfile -NonInteractive -File .\scripts\canonical\goal7-test-backup.ps1 -Profile Clean20261022 -Mode Preflight
```

Görev tanımı aynı araçtan, gerçek kurulum sahibi SID'si verilerek alınır.
Bu mod SQL'e bağlanmaz, dosya yazmaz ve görev kurmaz:

```powershell
powershell.exe -NoProfile -NonInteractive -File .\scripts\canonical\goal7-test-backup.ps1 -Profile Clean20261022 -Mode TaskDefinition -OwnerSid '<mevcut Windows sahibi SID>'
```

Tanım yalnız `C:\Sirket\ERP\clean\20261022\erp` içindeki bu runner'ı
`-Profile Clean20261022 -Mode Backup` ile çağırır. Gerçek görev kurma/etkinleştirme
ve ilk yedek, ERP sahibinin ayrı uygulama adımıdır. Aynı adlı görev varsa
üzerine yazılmadan kimliği incelenir; eski backup veya startup görevleri
devralınmaz. Bu kaynak teslimi kurulum yetkisi oluşturmaz.

C5'in uygulama kısmı ancak gerçek görev tanımı/owner/yerel saat ve en az bir
başarılı zamanlanmış çalışma makbuzu görülünce tamam sayılır. Mevcut C6 ayrı
hedefte geri açma işi de bu teslimle tamamlanmış olmaz.

## Kapsam ve doğrulama

Bu yalnız temiz TEST **SQL veritabanını** kapsar. CRM dosya/medya/ekleri,
uygulama paketleri, launcher'lar, özel ayarlar ve makineye bağlı korumalı
hesaplar kapsanmaz. B7 öncesi yedek de güncel tüm sistem kurtarma kanıtı değildir.

`node --test scripts/canonical/goal7-clean-backup.test.mjs` yalnız geçici örnek
dosyalar ve sahte SQL yanıtları kullanır: gerçek PS5 task tanımı, yanlış hedef
reddi, backup/header/VERIFYONLY hatalarında eski sağlam dosyaların değişmemesi,
başarı makbuzunun erken yazılmaması ve üzerine yazma reddi. Bu kontroller gerçek
yedek, restore veya zamanlanmış çalışma yerine geçmez.
