# Melisa ERP Windows Desktop Kurulum Paketi

## Kapsam

Windows masaustu paketi, ERP web-admin arayuzunu Electron icinde calistirir.
Kurulum dosyasi derlenmis web arayuzunu tasir ve ayni bilgisayardaki
`http://localhost:4100` ERP API servisine baglanir.

Bu ilk paketleme adimi API'yi Windows servisine donusturmez. SQL Server,
veritabani, `.env.local`, JWT anahtarlari, yuklenen urun gorselleri ve diger
gizli/runtime veriler kurulum dosyasina alinmaz.

## Uretim

```powershell
cd apps/desktop
npm.cmd install
npm.cmd run dist:win
npm.cmd run check:package
```

Uretilen dosya:

```text
apps/desktop/dist/windows/Melisa-ERP-Setup-0.1.0.exe
```

## Kurulum Davranisi

- Kullanici bazli Windows kurulumu yapilir.
- Varsayilan konum `%LOCALAPPDATA%\Programs\Melisa ERP` altidir.
- Masaustu ve Baslat menusu kisayollari olusturulur.
- Uygulama tek instance olarak calisir.
- Paketlenmis web-admin yerel `5187` portundan yalnizca uygulama acikken sunulur.
- ERP API kapaliysa uygulama veri yazmadan acik bir baglanti hata ekrani gosterir.
- API yeniden calistirildiktan sonra `F5` ile tekrar baglanilir.
- `Melisa ERP > Sunucu / IP Ayari` ekraninda IP adresi yazilabilir.
- Yalnizca IP girilirse `http://` ve varsayilan `4100` portu otomatik eklenir.
- Adres `%APPDATA%\@melisa-erp\desktop\desktop-settings.json` dosyasinda
  saklanir; SQL veya parola icermez.

## Guvenlik ve Sinirlar

- Kurulum paketi su anda kod imzali degildir; Windows bilinmeyen yayinci uyarisi
  gosterebilir.
- API authentication ve permission kontrolleri masaustu kabugunda atlanmaz.
- Electron icinde ERP ticari kurali bulunmaz; ticari davranis API tarafinda kalir.
- Kurulumdan once ve sonra veri tabaninda migration, reset veya test verisi yazma
  islemi yapilmaz.
- API'nin Windows acilisinda otomatik baslamasi icin ayri bir servis/process
  manager plani ve operasyon onayi gerekir.

## Dogrulama

Asgari kabul kontrolleri:

1. `npm.cmd run check`
2. web-admin production build
3. `npm.cmd run check:package`
4. paketlenmis arayuz icin HTTP 200
5. `/api/health` icin `status=ok`
6. kurulu EXE'nin `%LOCALAPPDATA%\Programs\Melisa ERP` altindan acilmasi
7. masaustu ve Baslat menusu kisayollarinin bulunmasi
