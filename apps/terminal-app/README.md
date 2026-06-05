# Melisa Terminal App v2

Android saha terminali icin Expo tabanli uygulamadir. Amac sade terminal UX, login, barkod okutma, urun/cari cache, offline queue, terminal satis submit ve manuel sync akisini Mini ERP backend ile calistirmaktir.

## Komutlar

```powershell
cd apps/terminal-app
npm install
npm run start
npm run start:lan
npm run start:tunnel
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
npm run start:lan
```

QR adresi `exp://192.168.x.x:8081` gibi LAN IP ile gelmelidir. Telefon baglanmazsa tunnel deneyin:

```powershell
npm run start:tunnel
```

Uygulama icinde Ayarlar ekranindan API adresi `http://PC_IP:4100` olarak kaydedilebilir. `/api` yazilsa bile uygulama cift `/api/api` yapmaz.

Local gelistirme modunda sifresiz test icin login ekranindaki `Local Acik Admin` butonu `open-admin` token'i ile giris yapar. Bu sadece backend tarafinda local open-admin kabul edildiginde calisir.

Web preview icin:

```powershell
npm run web
```

## Kontrol

Tek komutla terminal hazirlik kontrolu:

```powershell
npm run check:all
```

Bu komut Expo doctor, terminal API smoke, kilitli submit kontrolu ve web export kontrolunu calistirir. Kilitli submit kontrolu gercek satis yazmaz.

## Kapsam

- Local Acik Admin ile gelistirme girisi.
- Barkod scanner klavye/Enter uyumlu hizli input.
- API ve local cache uzerinden urun/cari arama.
- Yeni satis fisi, test fisi isaretleme ve terminal submit.
- API kapaliyken satisi offline queue'ya alma.
- Sync Merkezi ile bekleyenleri gonderme.
- Saha Testi ekraninda API/cache/queue/sync kontrolu ve local test notu.

## Saha Test Sirasi

1. Backend health: `http://PC_IP:4100/api/health`.
2. `npm run start:lan` ile Expo QR ac.
3. Expo Go icinden QR okut.
4. Ayarlar ekraninda API adresini test et.
5. Veri Guncelle ekranindan urun/cari cache indir.
6. Barkod okut ve urun bilgisini kontrol et.
7. Yeni Satis ekraninda pesin cari veya gercek cari sec.
8. Test fisi modu acikken deneme fisi gonder.
9. Wi-Fi kapali/offline iken satisi kuyruga al.
10. Wi-Fi geri gelince Sync Merkezi'nden bekleyeni gonder.
