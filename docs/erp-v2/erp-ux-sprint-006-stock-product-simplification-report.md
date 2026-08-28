# ERP UX Sprint 006 - Stok Listesi ve Urun Karti Sadelestirme

## Is Problemi

Stok listesinde hizli arama, sekiz hizli filtre dugmesi, dokuz ayrintili alan ve sekiz toolbar komutu ayni anda gorunuyordu. Urun kartinda temel form, barkodlar ve on kolonlu fis hareket tablosunun surekli acik olmasi Stok 360 ozetini geri plana itiyordu.

## Hedef

Stok, fiyat, tedarikci ve hareket kurallarini degistirmeden kullanicinin urunu hizla bulmasini, stok durumunu gormesini ve gerektiginde ayrintiya ulasmasini saglamak.

## Uygulanan Degisiklikler

- Stok listesi temel satiri tek hizli arama, stok durumu, aktiflik ve temizleme komutuna indirildi.
- Stok kodu, barkod, urun adi, marka, kategori, tedarikci ve para birimi acilir ayrintili filtrelere tasindi.
- CSV, Excel, yazdirma, kolon ve pasif urun komutlari acilir diger islemler menusunde toplandi.
- Varsayilan stok tablosu 12 kolondan 8 temel kolona indirildi.
- Kullanici kolon tercihleri icin yeni v2 anahtari kullanilarak sade varsayilan gorunum etkinlestirildi.
- Stok listesindeki Urun 360 son fis hareketleri acilir bolume tasindi.
- Urun karti temel formu izleme modunda kapali, yeni kayit veya duzenleme modunda acik calisacak hale getirildi.
- Urun kartindaki uzun stok fis kullanimi ve hareket tablosu varsayilan olarak kapali hale getirildi.
- Degisiklikler ayri ve kapsamli bir stil dosyasinda tutuldu.

## Kapsam Disi

- Stok veya urun API davranisi
- Stok miktari, fiyat veya maliyet hesaplama kurali
- Tedarikci eslestirme kurali
- Urun kaydetme, pasife alma veya barkod yazma islemi
- Veritabani veya migration degisikligi

## Kabul Kriterleri

- Temel urun arama ve stok durumu ilk bakista gorunur.
- Ikincil filtre ve komutlar kaybolmadan ihtiyac halinde acilir.
- Stok listesi varsayilan olarak sekiz temel kolon gosterir.
- Stok 360 ozeti gorunur, son hareketler kontrollu acilir.
- Urun karti izleme modunda form ve uzun hareket tablosuyla ekrani doldurmaz.
- 1366x768 ve 1920x1080 ekranlarda kontrol cakismasi veya sayfa yatay tasmasi bulunmaz.

## Dogrulama

- Web-admin production build: basarili, 1.897 modul donusturuldu.
- Stock Product UX smoke: 12/12 basarili.
- Layout smoke: tum kontroller basarili.
- Action clarity regresyon smoke: tum kontroller basarili.
- Canli tarayicida stok listesi 8 varsayilan kolonla dogrulandi.
- Canli tarayicida ayrintili filtrelerin ve Urun 360 hareketlerinin kapali basladigi dogrulandi.
- Canli tarayicida urun karti formu ve stok fis kullanim tablosunun izleme modunda kapali basladigi dogrulandi.
- 1366x768 ve 1920x1080 kontrollerinde belge veya ekran yatay tasmasi bulunmadi.
- Kayit veya veritabani yazma islemi yapilmadi.

## Sonraki Sprint

ERP UX Sprint 007, rapor ve tanim ekranlarinda filtre, KPI ve tablo yogunlugunu azaltacak.
