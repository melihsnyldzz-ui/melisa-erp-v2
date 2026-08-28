# WhatsApp CRM Operational Hardening

ERP CRM gelen kutusu varsayılan olarak yalnızca `open` durumundaki güncel konuşmaları gösterir. `resolved` geçmiş kayıtlar kalıcı olarak silinmez; kullanıcı durum filtresini `Tüm durumlar` veya `Çözüldü` seçerek geçmişe yeniden ulaşabilir.

Chatwoot konuşmaları içeride 25'li sayfalarla okunur; ERP CRM genel görünümü en fazla 20 sayfayı tek istekte birleştirebilir. Kullanıcı daha fazla konuşma yüklediyse üç saniyelik otomatik yenileme mevcut yükleme penceresini korur ve listeyi tekrar ilk sayfaya düşürmez.

Tarih: 2026-08-12

## Hedef

CRM ekranindaki gercek kullanim bosluklarini veri migration'i, canli mesaj veya saglayici cutover'i yapmadan kapatmak.

## Tamamlananlar

- ERP login, logout ve oturum zaman asiminda ikinci CRM kilit anahtari temizlenir.
- Ikinci CRM sifresi kaldirildi; web ve terminal `crm.view` yetkili ERP oturumuyla dogrudan acilir. Opsiyonel kilit yapilandirmayla geri alinabilir.
- Aktif `terminal_user` personeli CRM gelen kutusunu acabilir, mesaj yanitlayabilir ve operasyonel konusma islemlerini kullanabilir; bu varsayim finans veya sistem yonetimi yetkisi vermez.
- CRM kilit acma ve reddetme denemeleri yapilandirilmis PostgreSQL'de `crm_events` audit kaydi, diger durumda maskeli guvenlik logu uretir.
- Telefon ulkesi, bayragi ve ulke varsayimli dil bilgisi CRM API tarafinda `libphonenumber-js` ile uretilir. Kanitlanamayan telefonlar fail-closed kalir.
- Konusma belirli bir aktif ERP personel hesabina atanabilir; hedef personel ERP API'den tekrar dogrulanir.
- Konusma acildiginda okunmamis sayaci kalici temizlenebilir.
- Konusma `open`, `pending` ve `resolved` durumlariyla kalici yonetilir.
- `Yanit bekleyen` sayaci toplam okunmamis mesaj yerine son mesaji musteriden gelen acik konusmalari sayar.
- Inbox `limit`, `offset`, `hasNext`, `nextOffset` ve `total` ile server-side sayfalama dondurur.
- Ulke, durum ve okunmamis filtreleri; kompakt liste ve manuel daha-fazla-yukle akisi calisir.
- CRM calisma alani ekran yuksekligine sabitlenir; konusma listesi, mesaj gecmisi ve musteri ayrintilari sayfayi uzatmadan kendi panellerinde kayar.
- Mobilde sohbetten Musteri 360 paneline ve tekrar sohbete gecis vardir.
- Calismayan yanitla, yildizla ve sil aksiyonlari kaldirilmistir; hazir cevap secimi gercek bir acilir paneldir.
- ERP kataloglari salt-okunur secilir ve kontrollu mesaj taslagi hazirlanir. Harici gonderim insan onayi ve mevcut send kilitleri olmadan yapilmaz.
- Chatwoot konusma, mesaj, ek, temsilci, ekip, etiket, durum ve okunmamis bilgilerini ERP CRM DTO'suna donusturen salt-okunur adapter eklendi.
- `CHATWOOT_INBOX_READ_ENABLED=false` varsayilanidir. Acildiginda API erisimi basarisiz olursa `CHATWOOT_INBOX_FALLBACK_ENABLED=true` ile mevcut PostgreSQL gelen kutusuna geri doner.
- Chatwoot CRM kaynaginda atama ve durum Chatwoot konuşmasına, aşama özel alana, etiketler konuşma etiketlerine; not, görev, ürün ilgisi ve teklifler müşteriye gönderilmeyen özel CRM notlarına yazılır.
- ERP personeli ile Chatwoot temsilcisi `CHATWOOT_AGENT_PERSONNEL_MAP=ERP_USER_ID:CHATWOOT_AGENT_ID` biciminde acikca eslenebilir. Benzersiz kullanici adi/ad eslesmeleri salt-okunur onerilir; belirsiz eslesmeler bos birakilir.
- `/crm/integrations/chatwoot/personnel-map` aktif ERP personeli ile Chatwoot temsilcilerinin esleme durumunu salt-okunur dondurur.

## Bilerek Yapilmayanlar

- `WHATSAPP_PROVIDER` degeri degistirilmedi.
- Chatwoot sunucusunda temsilci, ekip, atama veya konusma kaydi degistirilmedi; Evolution ayarlari degistirilmedi.
- Gercek WhatsApp mesaji ya da katalog gonderilmedi.
- SQL migration, backfill veya ERP ticari veri yazimi yapilmadi.
- Dil bilgisi metin analiziyle kesin dil iddiasi degildir; `country-default` olarak etiketlenen operasyonel bir oneridir.

## Cutover Kapisi

Chatwoot'u tek mesaj kaynagi yapmak icin once salt-okunur Chatwoot inbox dogrulamasi, ERP kullanicisi ile Chatwoot agent esleme karari ve test numarasina exact-run gonderim onayi gerekir. Bu kapilar gecmeden Evolution geri donus yolu korunur.

## 2026-08-12 Yerel Salt-Okunur Aktivasyon

- `scripts/configure-whatsapp-crm-chatwoot-read.ps1` yerel Chatwoot hesap, gelen kutusu ve kullanici token bilgisini bulur; token degerini loglamadan WhatsApp CRM `.env.local` dosyasina yazar.
- Yerel kaynak `chatwoot-read-only` olarak etkinlestirildi; mevcut PostgreSQL kaynagi hata geri donusu olarak korunuyor.
- Chatwoot'ta 16 konusma bulundu. Varsayilan musteri gorunumunde 6 grup sohbeti filtrelenerek 10 bireysel konusma gosteriliyor.
- Bu 10 bireysel telefonun tamami mevcut yerel CRM telefon kayitlariyla eslesti.
- Gonderim, Chatwoot atamasi, durum degisikligi ve yerel is akisi mutasyonlari kapali kaldi.
- ERP'deki 4 aktif personel icin yerel Chatwoot temsilci hesabi olusturuldu ve WhatsApp gelen kutusuna uye yapildi.
- ERP kullanici kimlikleri Chatwoot ajan kimlikleriyle `.env.local` icinde acikca eslendi; gecici parolalar ve API anahtari loglanmadi.
- Temsilci olusturma betigi ikinci kez calistirildiginda `0` yeni temsilci uretti; kurulum idempotenttir.
- ERP temsilci secimi Chatwoot `/conversations/:id/assignments` API'sine baglandi. Yalnizca aktif ERP personeli ve acik esleme kabul edilir; diger kullanicilar fail-closed kalir.
- Chatwoot durum, aşama, not, görev, etiket, ürün ilgisi ve teklif mutasyonları CRM içinde kalıcıdır; ERP cari, stok, finans veya sipariş tablosuna yazılmaz.

## 2026-08-16 Canli Gonderim Rotasi

- Chatwoot gelen kutusu, konusma kimligi, mesaj gecmisi ve personel atama kaynagi olarak korunur.
- Giden WhatsApp mesaji Evolution v2.3.7 yerel Chatwoot koprusundeki LID/JID teslim sorunu nedeniyle Chatwoot webhook zincirine birakilmaz; korumali CRM send endpoint'i Evolution `sendText`/`sendMedia` API'sini dogrudan kullanir.
- Chatwoot'tan gelen sayisal konusma kimlikleri gecerli dis kaynak kimligi olarak kabul edilir ve yerel PostgreSQL UUID alanina yazilmaz.
- `WHATSAPP_PROVIDER=evolution`, `WHATSAPP_SEND_ENABLED=true`, `WHATSAPP_TEST_NUMBER_ONLY=false` ve acik canli onay birlikte gerekir. Gelen kutusu yine `chatwoot-read-only` kaynagidir.
- Grup hedefleri ve kanitlanamayan LID telefonlari fail-closed kalir. Bu geciste otomatik veya gercek test mesaji gonderilmedi.

## Anahtar Kelime Görsel Otomatik Yanıtı

- Gelen özel mesaj tam olarak `selam melisa` olduğunda yapılandırılmış tanıtım görselini gönderebilen kural eklendi.
- Büyük/küçük harf ve fazla boşluklar eşleşmeyi etkilemez; grup, yayın ve giden mesajlar kapsam dışıdır.
- Aynı hedefe varsayılan 24 saatlik bekleme uygulanır; yalnızca başarılı gönderim beklemeyi başlatır.
- Özellik varsayılan olarak kapalıdır. `WHATSAPP_AUTO_REPLY_ENABLED`, görsel yolu ve mevcut test/canlı gönderim korumaları birlikte sağlanmadan mesaj göndermez.
- Otomatik yanıt için ayrı Evolution instance adı zorunludur; diğer şirket hattından gelen webhook olayları `wrong-instance` olarak reddedilir.
