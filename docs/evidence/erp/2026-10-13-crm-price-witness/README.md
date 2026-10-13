# ERP04 / C09 — CRM siparişinde güncel ERP fiyatı

Durum: kaynak hazır; native SQL derleme/rollback tamam. Kalıcı native kurulum,
yeni paket aktivasyonu ve normal CRM ekranı doğrulaması henüz tamamlanmadı.
ERP-COMPLETE01 / ERP-DEC-053/054/055, ERP PR #23 ve CRM PR #3 kapsamında.

Yeni sipariş, ERP'nin onaylı manuel fiyat sürümünü ürün/birim/kademe/döviz
bağıyla taşır. Tek MANUAL satır varsa sürümlü sözleşme ve her manuel satırda
sürüm/kaynak fiyat kanıtı zorunludur. Eski SOURCE JSON sırası ve fingerprint
aynı kalır. Yeni istekte aktif manuel fiyat varken eski kaynak fiyatına
düşülemez; aynı UUID/body tekrarında kayıtlı tarihsel sonuç korunur.

CRM'nin ayrı SQL kimliği için üç dar native yordam ve immutable revision
kaydı hazırlanmıştır. Mevcut ürün/fiyat/finans tabloları veya eski yordamlar
değiştirilmez. Güncel fiyat kontrolü yeni yazıyla aynı transactiondadır;
tarihsel okuma/replay güncel pointer'a bağımlı değildir. Başlangıçta native
kimlik, izinler, tanım hashleri ve tam şema doğrulanmadan yetki kazanılmaz.
Eski create EXEC geçişte kaldırılır; eski müşteri/geçmiş okuyucuları korunur.
Kaynak NULL fiyat mevcut native metadata kapsamında desteklenmez; tahmin yok.

Hedefli offline kontroller: contract10, service17, context3, runtime5,
başlangıç2, paket31, compiler5 ve supervisor3: **76 PASS**, skip0.
Bağımsız kaynak incelemesi GO. Gerçek DB02 üzerinde 25 parent tanım hash'i
kanonik kaynakla eşleşti. Altı DDL aşaması native SQL'de derlendi, transaction
geri alındı; yeni nesne kalmadı. Bu, kalıcı uygulama veya insan kabulü değildir.

CRM sahibi uygulama source `5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36`
için immutable inactive paket teslim etti; root güncel özel config'e yeniden
bağlayıp native kanıtı tamamlayacak. Supervisor yalnız mevcut onaylı talep
issuer'ı ve dört sabit metadata anahtarını kabul eder; yeni kimlik/rol verilmez.
Paket projeksiyonu tek sonlu fiyat sözleşmesini içerir, SQL compiler'ı taşımaz.

Bu kaynak teslimi sırasında çalışan ERP `59c444f`, CRM `09ca1da`, native
`60e424b` korunur. TEST125, kabul edilmiş aktarımlar, LL/karantina, roller,
source fiyatları ve iki kayıtlık ERP manuel fiyat geçmişi değişmez.
Vega/LIVE/CRM mesajı/ücretli AI/main/T1 işlemi yok. İnsan kabulü bekliyor;
ERP04/C09 kısmi ve completeDelivery=false.

Ham native aday, SQL ve kayıt kanıtları yalnız repo dışındaki korumalı private
kanıt alanındadır; ticari satırlar ve özel ayarlar GitHub'a eklenmez.
