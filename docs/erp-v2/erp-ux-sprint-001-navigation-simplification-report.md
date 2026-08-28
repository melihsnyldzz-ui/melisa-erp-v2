# ERP UX Sprint 001 - Navigasyon Sadelestirme

## Is Problemi

ERP'nin ust menusu, sol menusu ve ana sayfadaki hizli islemler ayni anda cok fazla secenek gosteriyordu. Bu durum kullanicinin aktif isiyle ilgisiz ekranlari elemesini zorlastiriyor, ozellikle fis girisi gibi sik kullanilan akislara gecisi yavaslatiyordu.

## Hedef

Mevcut yogun masaustu ERP yapisini koruyarak navigasyonu aktif module ve secilen calisma gorunumune gore baglamsal hale getirmek.

## Uygulanan Degisiklikler

- Ust moduller ile ekranlar arasinda merkezi `navigationSections` eslemesi kuruldu.
- Sol menu, arama kapaliyken yalnizca aktif module ait ekranlari gosterir hale getirildi.
- Menu aramasi tum yetkili ekranlarda arama yapmaya devam edecek sekilde korundu.
- Tekrarlanan sabit `Sik Kullanilanlar` blogu kaldirildi.
- Ust menu, secilen calisma gorunumunde hic kullanilamayan modulleri gizler hale getirildi.
- `Rol gorunumu` ifadesi kullaniciya daha acik olan `Calisma gorunumu` olarak degistirildi.
- Ana sayfa hizli islemleri Yonetici, Patron, Muhasebe, Depo ve Satis gorunumlerine gore filtrelendi.
- Calisma gorunumu degistiginde acik ekran yeni gorunumde yoksa kirli sekme kapatilmadan Ana Sayfa'ya gecis eklendi.
- Navigasyon smoke testi yeni bolum eslemelerini ve baglamsal menu davranisini denetleyecek sekilde genisletildi.

## Kapsam Disi

- Satis ve alis fislerinin alan yerlesimi
- Liste ekranlarinin kolon ve filtre standardi
- Kullaniciya ozel favoriler ve son kullanilanlar
- Kullanici tercihlerinin farkli bilgisayarlar arasinda senkronizasyonu
- Genel renk veya tema yenilemesi

## Kabul Kriterleri

- Sol menu aktif modul disindaki ekranlari arama yokken gostermez.
- Menu aramasi yetkili tum ekranlari bulabilir.
- Ust menu secilen calisma gorunumune uygun modulleri gosterir.
- Ana sayfa hizli islemleri secilen calisma gorunumune uygun olur.
- Calisma gorunumu degisimi bos bir sol panel birakmaz.
- Mevcut ekranlar ve sekmeler veri kaybi olmadan acilmaya devam eder.

## Dogrulama

- Web-admin production build
- Navigation smoke
- Layout smoke
- Action clarity smoke
- Canli tarayicida Yonetici ve Muhasebe gorunumu kontrolu

## Sonraki Sprint

ERP UX Sprint 002, satis fisini taslak ve kesinlesmis durumlara gore sadeleştirecek. Birincil veri giris alanlari gorunur kalacak; teknik aciklama, maliyet ve ikincil detaylar ihtiyaca gore acilan bolumlere alinacak.
