# B01 — mevcut günlük kayıtların salt okunur ana sayfa özeti

11 Ekim 2026. DB02'nin kabul edilmiş tarihli tabanı ve registered v4/v5 günlük kapsamı kullanıldı; yeni migration, ticari işlem, rol veya finansal açılış yapılmadı.

## Gerçek kaynak sonucu

- İlker16 ve personel15 normal, admin olmayan mevcut oturumlarla kaynak okuyucusu çalıştırıldı. Native SQL derlemesi/yürütmesi hata0; iki aktörün ikişer okuması tamamlandı.
- İş günü **09.10.2026**, okuma günü **11.10.2026** ayrı döner. Kaynak kayıtları bugünün Vega bakiyesi veya bugünkü işlem diye sunulmaz; mevcut kullanıcı ekranının iş günü dili korunur.
- Her iki aktörde kayıtlı2 tamamlanmış satış ve1 bekleyen mal kabulü bulundu. İlker'de satış/tahsilat/ödeme, sayım ve alış iadesi özeti; personelde yalnız kendi oluşturduğu işler ve mevcut yetkiler görünür.
- Personelin kendi satışını ofisin kesinleştirmesi, personel sahipliğini kaybettirmez. Başka personelin oluşturduğu kayıtlar bu nedenle açılmaz; sahiplik creation journal üzerinden korunur.
- Satış, tahsilat ve ödeme tutarları TRY/USD/EUR ayrı; mevcut normal API raporlarıyla4 kapsamın kayıt sayıları ve tutarları yuvarlamasız8hane karşılaştırmasında uydu. Ham tutarlar ve cari bilgileri private makbuzdadır.
- Onaylı source/profile/payload hash, copy/seal/request/actor/operation, immutable effect ve native satır eşitliği korunur. Günlük özet yalnız seçili çalışma kapsamıdır; eski kopyalanmış belgeleri genel mağaza günü toplamı yapmaz.
- Gerçek kasa/banka açılışı henüz bilinmiyor; kasa bakiyesi unavailable/NULL. Registered iş setinde bulunmayan satış iadesi NULL; bu alanlara sahte0 yazılmaz.

## Kontroller ve sınırlamalar

5 hedefli kaynak/başlatıcı/paket/session dosyası **91/91 PASS**,0fail/skip. Önceki90/90 sayımı yerine güncel suite budur; örtüşen test sayıları toplanmaz. Bağımsız kaynak incelemesi ve normal rollü native okuma yapılmıştır. Exact GET/SQL allowlist genişletilmeden yalnız yeni sabit günlük özet sorgusu eklenmiştir.

Native kaynak özetinin gerçek uçtan uca okuması rol16 için3138/2978ms, rol15 için2841/2854ms. Bunlar UI açılışı veya katalog hız kazancı değildir; integrity/readiness maliyeti dahil edilmiştir. Katalog HTTP regresyonu açık kalır.

Private kanıt: `daily-home-source-readonly-2026-10-11T085036940Z.json`, SHA256 `0f781940c18db3b1050ca240bd2cbfb74ef2217703b34565ac196c18721b48e7`; aynı dosyanın `-comparison.json` eki bağımsız mevcut API karşılaştırmasını içerir. Ticari POST0, persistent SQL writes0, rol/servis değişikliği0. Normal giriş ve mevcut TEST-only actor oturumu auth audit üretebilir.

Bu kaynak sonucu ortak a51b117 API/Hub'ın yeniden başlatıldığı anlamına gelmez. Immutable yeni paket ve geçici USB/loopback HTTP makbuzu ayrıca teslimde bağlanacaktır. Normal ERP HOME cihaz görseli önceki politika reddi nedeniyle NOT_RUN kalır; reddedilen URL açma işlemi başka yoldan denenmez. İnsan ERP-UA32 bekliyor; bu teknik sonuç genel ERP/LIVE kabulü değildir.
