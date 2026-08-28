# Melisa Terminal App v2

Android saha terminali icin Expo tabanli uygulamadir. Amac sade terminal UX, login, barkod okutma, urun/cari cache, offline queue, terminal satis submit ve manuel sync akisini Mini ERP backend ile calistirmaktir.

Yazi girisi olan ekranlar ortak klavye-guvenli kaydirma davranisini kullanir. Android `adjustResize` ile pencereyi kucultur; odaktaki alan klavyenin arkasinda kalirsa uygulama alani otomatik olarak klavyenin ustune kaydirir ve yazilan deger gorunur kalir.

## Komutlar

```powershell
cd apps/terminal-app
npm install
npm run start
npm run start:lan
npm run start:tunnel
npm run field:info
npm run android
npm run doctor
npm run check:all
```

## Ortam Ayarlari

`.env.example` icindeki degerler:

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.47:4100
EXPO_PUBLIC_DEVICE_NAME=Depo Terminal
EXPO_PUBLIC_TERMINAL_CODE=TERM-V2-001
EXPO_PUBLIC_APP_ENV=development
```

Fiziksel Android cihazda `localhost` cihazin kendisini gosterecegi icin API adresi LAN IP olarak verilmelidir. Expo LAN modunda app dev server host IP'sinden otomatik `http://PC_IP:4100` tahmini yapar. Android emulator icin gerekirse `http://10.0.2.2:4100` kullanilabilir.

## Telefon / Expo Go

Backend PC'de calisirken telefon ayni Wi-Fi aginda olmali. Once API'nin LAN'dan acildigini kontrol edin:

```text
http://PC_IP:4100/api/health
```

Sonra terminal app'i LAN ile baslatin:

```powershell
cd apps/terminal-app
npm run field:info
npm run start:lan
```

QR adresi `exp://192.168.x.x:8081` gibi LAN IP ile gelmelidir. Telefon baglanmazsa tunnel deneyin:

```powershell
npm run start:tunnel
```

Giris ekranindaki `Sunucu / API adresi` alanindan adres giris yapmadan once degistirilebilir,
kaydedilebilir ve test edilebilir. Protokol yazilmazsa uygulama `http://` ekler; emulator icin
`10.0.2.2:4100`, fiziksel telefon icin `PC_IP:4100` kullanilabilir. Kaydedilen adres sonraki
acilislarda korunur. Ayarlar ekranindan da ayni adres yonetilebilir. `/api` yazilsa bile uygulama
cift `/api/api` yapmaz.

Local gelistirme modunda sifresiz test icin login ekranindaki `Local Acik Admin` butonu `open-admin` token'i ile giris yapar. Bu sadece backend tarafinda local open-admin kabul edildiginde calisir.

Web preview icin:

```powershell
npm run web
```

## Android Studio

Yerel Android projesi `apps/terminal-app/android` klasorundedir. Android Studio'da
bu klasoru acin. Ekranlar ve is akislari `apps/terminal-app/src`, Android'e ozel
Gradle, manifest ve cihaz ayarlari ise `apps/terminal-app/android` altinda duzenlenir.

Komut satirindan debug APK olusturmak icin:

```powershell
cd apps/terminal-app/android
.\gradlew.bat :app:assembleDebug
```

APK `app/build/outputs/apk/debug/app-debug.apk` konumuna yazilir. Bu proje Windows'ta
uzun dosya yollarinda Expo native derlemesinin takilmamasi icin CMake gecici derleme
onbellegini kisa sistem temp yolunda tutar.

Uygulama simgesi ve acilis ekrani Melisa Baby marka dosyalarini kullanir. Expo kaynaklari
`src/assets/branding` altindadir; native Android ikon ve splash kaynaklari `android/app/src/main/res`
altinda tutulur. Marka gorseli degistirilirse iki kaynak grubu birlikte guncellenmelidir.

## Kontrol

Tek komutla terminal hazirlik kontrolu:

```powershell
npm run check:all
```

Bu komut Expo doctor, terminal API smoke, kilitli submit kontrolu ve web export kontrolunu calistirir. Kilitli submit kontrolu gercek satis yazmaz.

## ERP Bilgisayarindan Fis Yazdirma

Yeni Satis ekranindaki `Fisi Yazdir` islemi once satisi API'de kesinlestirir, sonra kesinlesen
fis kimligini ERP bilgisayarina gonderir. Yazdirma telefonda degil, API'nin calistigi Windows
bilgisayarda gerceklesir. Yazici adi ayarlanmamissa Windows varsayilan yazicisi kullanilir.

API ortami:

```text
TERMINAL_RECEIPT_PRINT_ENABLED=true
TERMINAL_RECEIPT_PRINT_MODE=windows
TERMINAL_RECEIPT_PRINTER_NAME=
```

Yazdirma basarisiz olsa bile kesinlesen satis geri alinmaz; terminal ekrani fisin kaydedildigini
ve yalnizca cikti adiminin basarisiz oldugunu ayri olarak bildirir. Sadece kesinlesmis satis
fisleri yazdirilir ve istek/tamamlanma kayitlari audit log'a yazilir.

## Kapsam

- Local Acik Admin ile gelistirme girisi.
- Barkod scanner klavye/Enter uyumlu hizli input.
- API ve local cache uzerinden urun/cari arama.
- Yeni satis fisi, test fisi isaretleme ve terminal submit.
- API kapaliyken satisi offline queue'ya alma.
- Sync Merkezi ile bekleyenleri gonderme.
- Saha Testi ekraninda API/cache/queue/sync kontrolu ve local test notu.

## Saha Test Sirasi

1. `npm run field:info` ile PC IP ve API health durumunu gor.
2. Backend health: `http://PC_IP:4100/api/health`.
3. `npm run start:lan` ile Expo QR ac.
4. Expo Go icinden QR okut.
5. Ayarlar ekraninda API adresini test et.
6. Veri Guncelle ekranindan urun/cari cache indir.
7. Barkod okut ve urun bilgisini kontrol et.
8. Yeni Satis ekraninda pesin cari veya gercek cari sec.
9. Test fisi modu acikken deneme fisi gonder.
10. Wi-Fi kapali/offline iken satisi kuyruga al.
11. Wi-Fi geri gelince Sync Merkezi'nden bekleyeni gonder.
