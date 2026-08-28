# ERP UX Sprint 002 - Satis Fisi Sadelestirme

## Is Problemi

Satis fisinde cari ve urun girisi, teknik fis alanlari, karar kartlari, genis urun tablosu ve tum toplamlar ayni anda gorunuyordu. Bu durum temel satis girisini yavaslatiyor ve kesinlesmis fislerde artik kullanilamayan kontrolleri ekranda tutuyordu.

## Hedef

Satis fisini durumuna gore iki amaca ayirmak:

- Taslak: cari sec, urun ekle, miktari duzenle, kaydet veya kesinlestir.
- Kesinlesmis: belgeyi oku, maliyet/kar ayrintisini incele, yazdir, disa aktar veya iptal et.

## Uygulanan Degisiklikler

- Taslak ve kesinlesmis fis toolbar komutlari duruma gore ayrildi.
- Ilgisiz veya kullanilamayan butonlar pasif gostermek yerine ilgili durumda gizlendi.
- Kesinlesmis ve iptal edilmis fislerde satis giris paneli kaldirildi.
- Tekrarlanan urun secim kutusu kaldirildi; barkod/urun aramasi tek giris noktasi oldu.
- Pesin satis carileri istege bagli acilan bolume alindi.
- Uc buyuk karar karti tek satirlik cari, urun ve fis baglam ozetine donusturuldu.
- Yeni fis acildiginda onceki cari/urun aramasi, secili urun ve miktar sifirlanir hale getirildi.
- Fis no, tarih, cari, para birimi ve bakiye ana ozette tutuldu.
- Kur, iskonto ve aciklama istege bagli acilan fis ayarlari bolumune alindi.
- Urun tablosundan tekrar eden barkod ve para birimi kolonlari kaldirildi.
- Maliyet ve kar kolonlari kesinlesmis fislerde kullanici istegiyle acilir hale getirildi.
- Satir islemleri standart ikon butonlarina donusturuldu.
- Toplamlar varsayilan durumda adet, satir ve genel toplamla sinirlandi; ayrintilar acilir hale getirildi.
- Satis fisine ozel responsive stil ve otomatik UX smoke testi eklendi.

## Kapsam Disi

- Satis fiyati, stok, cari veya kur is kurallarinin degistirilmesi
- API ve veritabani degisikligi
- Alis fisi ve toplu alis ekrani
- Yeni satis yetkisi veya onay mekanizmasi

## Kabul Kriterleri

- Taslak ekraninda temel satis girisi ilk bakista anlasilir olur.
- Kesinlesmis fis giris kontrolu gostermez.
- Urun tablosu varsayilan durumda yedi temel kolonu gosterir.
- Maliyet ve kar bilgileri kaybolmaz, istege bagli acilir.
- Kur, iskonto ve aciklama alanlari erisilebilir kalir.
- Mevcut kaydetme, kesinlestirme, iptal, Excel ve yazdirma davranislari korunur.
- 1366x768 ve 1920x1080 masaustu gorunumlerinde kontroller birbirine girmez.

## Dogrulama

- Web-admin production build
- Sales invoice UX smoke
- Invoice boundary smoke
- Layout smoke
- Canli tarayicida taslak satis fisi kontrolu

## Sonraki Sprint

ERP UX Sprint 003, alis fisi ve toplu alis ekranlarini ayni görev odakli yaklasimla sadelestirecek.
