# Onaylı Ürün Kimliği ve Günlük Fiyat/Stok Snapshotı

## Amaç

Onaylanan 30 ürünün kimliğini, her gün değişebilecek fiyat ve stok bilgisinden ayırmaktır. Böylece fiyat veya stok değiştiğinde ürün seçimi, müşteri adları ve marka dağılımı yeniden onaylanmış gibi gösterilmez.

Bu ilk dilim yalnız yerel ve sentetik sözleşme provasıdır. Gerçek Vega bağlantısı, müşteri teklifi, fiyat onayı veya dış işlem değildir.

## Kurulan iki ayrı kayıt

### 1. Sabit ürün kimlik kaydı

Kayıtta yalnız şu bilgiler bulunur:

- Vega ürün kimliği ve stok kodu
- Kaynak ürün adı ve varsa sahibi tarafından onaylanmış müşteri adı
- Marka, kategori ve birim
- Paket içeriği kontrol durumu
- Ürün üyeliği ve kayıt bütünlüğü için ayrı hashler

Fiyat, para birimi, stok, kur, maliyet, marj, navlun ve müşteri bilgisi bu kayda alınmaz.

Onay kapsamı alan bazında tutulur: ürün üyeliği, 10 özel müşteri adı ve marka dağılımı onaylıdır. Kaynak ürün adı, kategori ve birim kaynaktan gelen metadata olup ayrıca sahibi tarafından onaylanmış ticari karar sayılmaz.

31 Ağustos onayından üretilen yerel kayıt:

- Kayıt kimliği: `ROSTER-F249D11F44D282E4`
- Kimlik kayıt SHA256: `f249d11f44d282e438bf92f01f9ba3dba09689b189f0118e7c71ccdcc2c7458a`
- Üyelik SHA256: `1619ed6021a8e2aa82cc6f4724b4c80af4a9bcb12a84d3895913bdbfd53ab53a`
- Ürün sayısı: `30`
- `7770 CONCEPT`: bloklu ve kayıtta yok
- `8023 CONCEPT`: onaylı kayıtta var

### 2. Günlük fiyat/stok gözlem snapshotı

Snapshot, kimlik kaydına kendi hash değeriyle bağlanır ve yalnız günlük kaynak gerçeklerini taşır:

- Ürün kimliği ve stok kodu eşleşmesi
- Kaynaktaki satış fiyatı ve para birimi
- Kaynaktaki stok gözlemi
- Rezerve stok ve aktiflik verisinin yakalanıp yakalanmadığı
- Kaynak, gün, alan eşleme ve tamlık kanıtı
- Ürün bazında gözlem veya teklif dışı kalma durumu

Sıfır stok ürünü listeden silmez; ürünü `NOT_QUOTABLE` yapar. Negatif, eksik veya sayı olmayan stok; geçersiz para birimi; eksik/fazla/tekrarlı ürün ve yanlış stok kodu bütün snapshotı durdurur. Bu göç kaynağında rezerve stok ve aktiflik gözlenmediği için ikisi de `NOT_CAPTURED` kalır; çağıranın sonradan değer eklemesi reddedilir.

31 Ağustos verisiyle yapılan sentetik sözleşme provası:

- Snapshot kimliği: `DAILY-20260831-F610B578D19583E0`
- Günlük snapshot SHA256: `f610b578d19583e0d9ffa11b9e53cf5ce952c841728e17966f8a3110c73b214e`
- Ham gözlem SHA256: `9e3e09f29fd9332f695626944fd713e5195834ce0daa45ee8bd4657b9adde7c3`
- Kanıt zarfı SHA256: `c7a885adcf27beba525b69479a58b13a7176290a9b62138935f99a58ec751f4c`
- Tamlık: `30/30`
- Canlı Vega okuması: yapılmadı
- Günlük fiyat onayı: `NOT_APPROVED`
- Müşteri-hazır fiyat kitabı: kapalı

## Tarih güvenliği

Komut gerçek `Europe/Istanbul` gününü kullanır; kullanıcı tarih giremez. 1 Eylül 2026 tarihinde 31 Ağustos gözlemiyle çalıştırıldığında `DAILY_SNAPSHOT_STALE` ile durduğu doğrulandı. Böylece eski veriye “bugünün fiyatı/stoku” etiketi verilemez.

## Onay sınırları

Mevcut şirket sahibi onayı yalnız 30 ürün üyeliğini, marka dağılımını ve onaylanmış müşteri adlarını kapsar. Aşağıdakiler hâlâ onaylanmamıştır:

- Vega fiyat, para birimi ve stok alan eşlemesi
- Günlük fiyat formülü, maliyet ve hedef marj
- Yuvarlama kuralı
- Gün içi geçerlilik ve tazelik süresi
- Rezerve stoktan düşme kuralı
- Belirli günlük snapshot ve fiyat kitabı
- Müşteriye teklif gönderme veya yayın

SHA256 değişikliği gösterir; dijital imza veya şirket sahibi onayı değildir. Günlük fiyat onayı ileride `identityRegistrySha256 + dailySnapshotSha256 + evidenceEnvelopeSha256 + businessDate` kapsamına bağlanmalıdır.

Günlük mantıksal hash satır sırasından bağımsızdır. Ham gözlem hash’i ayrıca `evidenceEnvelopeSha256` ile günlük hash, kaynak, gözlem zamanı ve iş gününe bağlanır. Böylece ileride süreçler arası kayıt açıldığında başka bir ham dosyanın aynı snapshotla eşleştirilmesi engellenebilir.

## Çalıştırma ve test

```powershell
node scripts/catalog/product_identity_daily_snapshot.mjs
node --test scripts/catalog/product_identity_daily_snapshot.test.mjs
node --test scripts/catalog/product_identity_daily_snapshot_live.test.mjs
```

Komut dosyası yalnız onaylı katalog dosyasını okur ve kırpılmış terminal özeti üretir. Ağ, veritabanı, dosya yazma, ERP/Vega yazması, teklif, sipariş, ödeme, stok ayırma, mesaj veya yayın yeteneği yoktur.

Yerel ve canlı kaynak sözleşmelerinin otomatik güvenlik paketi `24/24 PASS` verdi. Ayrı ekran veya API eklenmediği için bu dilimde tarayıcı doğrulaması uygulanabilir değildir.

## 1 Eylül canlı salt-okunur test sonucu

Şirket sahibi alan eşlemesini ve yalnız salt-okunur testi açıkça onayladıktan sonra gerçek Vega bağlantısı bir kez çalıştırıldı.

Onaylanan alan eşlemesi:

- Satış fiyatı: varsayılan/ana birimin `F0102TBLBIRIMLEREX.SATISFIYATI1` alanı
- Para birimi: aynı birimin `PB1` alanı
- Stok: `F0102D0007TBLSTOKHAREKETLERI` içindeki `GIREN - CIKAN` neti; hareket yoksa `F0102TBLSTOKLAR.KALAN` geri dönüşü
- Rezerve stok: `F0102TBLSTOKLAR.REZERV`, net stoktan otomatik düşülmeden ayrı gözlem
- Aktiflik: `STATUS=1`, `DELETED=0`, `IPTAL=0`

Canlı kanıt:

- İzin ön kontrolü: üç tabloda `SELECT` var, `INSERT/UPDATE/DELETE/ALTER/CONTROL` yok
- Tamlık: `30/30`
- Para birimi dağılımı: `17 TRY / 13 USD`
- Stok kaynağı: `30/30 PERIOD_MOVEMENT_NET`; `KALAN` geri dönüşü kullanılmadı
- Pozitif rezerve stok bulunan ürün: `0`
- Sıfır fiyat veya sıfır stok nedeniyle teklif dışı kalan ürün: `0`
- Snapshot kimliği: `DAILY-20260901-D06652D5E5327DDC`
- Günlük snapshot SHA256: `d06652d5e5327ddc5ba09b38909627d5343f790ac806f4507a1f67f7492c4c58`
- Ham gözlem SHA256: `1025aeb46a197051d120bcb9fc4a7a7e1d410f6e72589437602e5b673a56369c`
- Kanıt zarfı SHA256: `61774f76d778a8036d1c9d6bf26db784a055c4060ad4fde9ff00abaea2739a90`
- Günlük fiyat onayı: `NOT_APPROVED`
- Veritabanı/ERP/Vega yazması, dosya yazması, mesaj, teklif, sipariş, ödeme, stok ayırma veya yayın: yapılmadı

Bu kanıt süreç içi ve dijital imzasızdır; ticari fiyat onayı veya kalıcı üretim snapshotı değildir.

## Sıradaki kapı

Canlı salt-okunur kaynak testi tamamlandı. Sıradaki karar günlük fiyat politikasıdır:

- Kaynak satış fiyatı aynen mi kullanılacak, maliyet/marj formülü mü uygulanacak?
- Fiyat hangi kuralla yuvarlanacak?
- Günlük fiyat hangi saatte başlayıp bitecek?
- Teklif öncesi stok kaç dakika içinde yeniden okunmuş olmalı?
- Rezerve stok yalnız gösterilecek mi, ileride kullanılabilir stoktan düşülecek mi?

Bu kararlar ve belirli günlük fiyat kitabı sahibi onayı tamamlanmadan “günlük fiyat motoru çalışıyor”, “stok garanti”, “müşteriye hazır fiyat” veya “teklif gönderilebilir” denemez.
