# Dört görevli izole Android çalışma yüzü

## 24 Ekim — E1 temiz TEST kaynak profili; kurulum değildir

**Sonraki kaynak halkası:** ERP'nin mevcut normal refresh store'u exact clean profil ve mevcut kimliklerle18hedef testte uyarlandı; runtime state/ACL/API-web kurulumu henüz yapılmadı. Çalışan eski web'e yeni APK'yı bağlayarak korumalı oturum kabulü verilmez. Pasif worktestRelease APK/lint derlemesi ve v2imza doğrulandı;45.326.137bayt/SHA22AB8FDDF1276B0CB3A4BF0C2A1F3C925C0380821D41B9F1B7692E12FA2935F6. Cihaza kurulmadı; aynı kişi CRM/koli/fiziksel kullanım ayrı bekler. Aşağıdaki eski store sınırı, uyarlama öncesi kaynak inceleme bulgusudur.

`-PworkOrigin=http://192.168.1.46:5244` açık build seçeneği temiz ERP5244 / CRM62800 çiftini seçer. LAN API okumaları mevcut ERP web proxy'sinden geçer;4194/4196 veya CRM iç servisleri LAN'a açılmaz.127.0.0.1:5244 yalnız geliştirme seçeneğidir ve yerel4194 kullanır. Eski5234/62700 profili ve varsayılan build seçimi korunur; eski porttan yeni profile otomatik geçiş veya vault taşıma yapılmaz. Yeni profil eski home-summary/personel-bootstrap yolunu açmaz.

Android korumalı ERP/CRM kasaları tam origin ile ayrı anahtar kullanır; önceki kurulum kasası devralınmaz. Yeni web eşlemesi5244→62800 ve Android bridge allowlist'i aynı sabit çifti tanır. Desteklenmeyen native origin veya eksik bridge tarayıcı deposuna düşmez. Parola/token URL'ye, cihazlar arasında veya ERP ile CRM arasında kopyalanmaz; normal sunucu auth/refresh/revoke ve mevcut roller yetkilidir.

31web hedef testi ve15Kotlin sözleşme testi gerçek Android derlemesiyle geçti. İlk offline derlemede pinli Android plugin önbellekte yoktu; projenin mevcut resmi registry'lerinden aynı sürümler çözülüp hedefli derleme geçti. Sürüm/politika/lisans atlatma yapılmadı. Bu sonuç normal cihaz girişi, sunucu refresh'i, aynı kişiyle CRM geçişi, koli adapteri, fiziksel okuma veya insan kabulü değildir. Mevcut protected refresh store eski Shared hedefe sabittir; temiz hedefte normal refresh/kimlik devri ayrıca doğrulanmalıdır. Eski koli copy kimliği yeni temiz hedef için değiştirilmedi. Kaynak profili bütün E1 akışını çalışır ilan etmez; APK/kurulum makbuzu ayrıca gerekir.

### Aşağıdaki5234/62700 kayıtları önceki profilin sözleşmesidir

Candidate.18-t2'nin mevcut native akışları korunur. Debug varyantının uygulama
kimliği `com.melisaerp.nativeterminal.worktest`, başlatıcısı `WorkTasksActivity`'dir.
Release başlatıcısı, kimliği, Room/Vault verisi ve eski imzalı APK değiştirilmez.
Eski `source-provenance.json` tarihli başlangıç kanıtıdır; yeni çalışma kaynak
manifesti `worktest-source-provenance.json` içinde ayrı tutulur.

Ana yüz dört iş sunar: Mal kabul, Satış, Koli hazırlama, Müşterilerim. Bunlar gerçek
`terminal.html?worktest=1` yüzünün `goods / sales / packing / crm` rotalarıdır.
Sahte ürün, satış fişi, tedarikçi, müşteri veya sohbet üretmez. Auth/token Android'e
aktarılmaz; kullanıcı mevcut normal oturum ile girer. API ve görev rolleri mevcut
ERP/CRM tarafından doğrulanır. Mal kabulde personel sayar ve İlker'e gönderir;
personel bu yüz üzerinden yeni bir onay yetkisi kazanmaz.

Varsayılan cihaz origin'i `http://192.168.1.46:5234`, API'si aynı hostta `4184`,
CRM'si `62700`'dır. Kurulmuş APK bu adreslere şirket Wi-Fi'sinden doğrudan bağlanır;
USB yönlendirmesi kullanmaz. `http://127.0.0.1:5234` yalnız açık geliştirme build
seçeneğidir. Android yapılandırması servis başlatmaz veya yönlendirme kurmaz;
bilgisayar tarafındaki kalıcı servisler ve gerçek LAN erişimi ana koordinatörce
ayrıca doğrulanmalıdır. Onaylı LAN çifti `http://192.168.1.46:5234` / `4184`'tür.
`-PworkOrigin` başka bir değer alırsa build reddedilir. Koli metadata yolları
aynı origin'de yalnız `/api/terminal-cartons/receipts` ve `/receipts/<sayısal-id>`
ile sınırlıdır; ticari stok/finans hareketi üretme yetkisi değildir.

Ana sayfa okuyucusu yalnız APK'nın exact onaylı origin'indeki
`/api/terminal-worktest/home-summary` adresine, ana gezinme dışında,
query/fragment içermeyen GET ile ulaşabilir. Diğer host/portlar, alternatif yollar
ve bütün yazma yöntemleri bu namespace için kapalıdır. CRM'nin geçici personel
oturumu endpoint'i LAN'a açılmaz; mevcut normal kullanıcı oturumu gerekir.
Bu bağlantı mevcut normal aktör ve native izin
kontrolünü kullanır; yeni oturum veya ticari yetki oluşturmaz.

Bir WebView görevler arasında korunur. Mevcut ekranın kayıt/sonuç kontrolü
geçişi engelliyorsa Android menüsü bu engeli aşmaz. Arka planda veya gezinirken
barkod biriktirilmez. Barkod metindir; sıfırlar korunur. Sabit barkod alanına
`input` ve `Enter` olayı iletilir; şifre/giriş alanı tarama almaz. Tekrarlanan
600 ms içindeki aynı okuma engellenir. JS auth köprüsü, dosya erişimi, keyfi URL,
harici pencere ve SSL hatasını kabul etme yoktur.

Worktest ayrı `MelisaNativeWorkTestV1` DataWedge profili kullanır. Mevcut
`MelisaNativeV1` profilinin uygulama listesi değiştirilmez; MDM/default profil
ve güvenlik ayarları değiştirilmez.

Offline kaynak kontrolü (JDK17, mevcut Android SDK36):

```powershell
.\gradlew.bat --offline --no-daemon testDebugUnitTest assembleDebug
```

Derleme ve unit sonuçları fiziksel barkod veya insan kabulü değildir. Cihaz
kurulumu/giriş/okuma ana koordinatörce ayrıca doğrulanır. Mevcut altı web görevi
silinmez; dört yeni Android işinin tamamlandığı eski altı menüye bakarak ilan
edilemez.

Varsayılan LAN APK için [kısa kurulum rehberi](INSTALL-WORKFLOW.md). Kaynakta LAN
adresinin seçilmiş olması, sunucu servislerinin kalıcılaştırıldığı veya cihazın
Wi-Fi'den uçtan uca doğrulandığı anlamına gelmez.
