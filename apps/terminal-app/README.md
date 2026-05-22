# Melisa Terminal App v2

Android depo terminali icin Expo tabanli foundation uygulamasidir. Bu sprintte amac sade terminal UX, login, barkod input, urun lookup, local cache, offline queue ve sync status temelini kurmaktir.

## Komutlar

```powershell
cd apps/terminal-app
npm install
npm run start
npm run android
npm run doctor
```

## Ortam Ayarlari

`.env.example` icindeki degerler:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:4100
EXPO_PUBLIC_DEVICE_NAME=Depo Terminal
EXPO_PUBLIC_TERMINAL_CODE=TERM-V2-001
```

Fiziksel Android cihazda `localhost` cihazin kendisini gosterecegi icin API adresi LAN IP olarak verilmelidir. Android emulator icin gerekirse `http://10.0.2.2:4100` kullanilabilir.

## Faz 1 Kapsami

- Mevcut `/api/auth/login`, `/api/auth/logout`, `/api/products` endpointleri kullanilir.
- JWT access token ve refresh token cihazda saklanir.
- Barkod scanner klavye/Enter uyumlu hizli input olarak calisir.
- API kapaliyken lookup denemesi local queue'ya yazilir.
- Urun cache ve cari cache foundation AsyncStorage uzerinde tutulur.
- Sync status ekrani online/offline durumunu, pending queue sayisini ve cache ozetini gosterir.

## Bu Sprintte Yok

- Gercek terminal satis finalize.
- Offline invoice commit.
- Odeme/tahsilat.
- Stok sayim.
- Websocket veya image upload.
- Vega DB baglantisi.
