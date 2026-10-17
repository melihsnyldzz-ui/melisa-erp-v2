# Dört görevli izole Android çalışma yüzü

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
