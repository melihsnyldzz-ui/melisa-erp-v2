# Melisa ERP Desktop

Melisa ERP v2 icin Electron tabanli Windows masaustu kabugudur.

## Gelistirme

```powershell
cd apps/desktop
npm.cmd install
npm.cmd run start
```

Gelistirme modunda kabuk, calismiyorlarsa yerel API ve web-admin gelistirme
sunucularini baslatir ve `http://localhost:5173/` adresini acar.

## Windows Kurulum Dosyasi

```powershell
cd apps/desktop
npm.cmd run dist:win
```

Kurulum dosyasi su klasore yazilir:

```text
apps/desktop/dist/windows/Melisa-ERP-Setup-0.1.0.exe
```

Kurulum:

- baslat menusu ve masaustu kisayolu olusturur,
- derlenmis web-admin arayuzunu kendi icinde tasir,
- bilgisayardaki `http://localhost:4100` ERP API servisine baglanir,
- API kapaliysa veri yazmadan baglanti ekrani gosterir.

Uygulama menusu altindaki `Sunucu / IP Ayari` ekraninda adres serbestce
yazilabilir. `192.168.1.46` gibi yalnizca IP girilirse `http://` ve `4100`
portu otomatik eklenir. Kaydedilen adres
`%APPDATA%\@melisa-erp\desktop\desktop-settings.json` dosyasinda saklanir ve
uygulama yeniden acildiginda web-admin API isteklerinde kullanilir.

Kurulum paketine `.env.local`, SQL sifresi, JWT anahtari, yuklenen urun
gorselleri veya veritabani alinmaz. ERP API ayri calisan servis olarak kalir.

Paket kontrolu:

```powershell
npm.cmd run check:package
```

## Ortam Ayarlari

Varsayilanlar:

```text
MELISA_API_HEALTH_URL=http://localhost:4100/api/health
MELISA_DESKTOP_WEB_PORT=5187
```

Gelistirme icin `MELISA_WEB_URL` ile farkli bir web-admin adresi verilebilir.
