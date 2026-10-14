# ERP04 / C09 — CRM siparişinde güncel ERP fiyatı

Durum: dar native V3 kurulumu ve sınırlı kimlikle fiyat kanıtı tamam; tam yeni
CRM paket başlangıcı import bağımlılığında kapandı. Eski sağlıklı runtime geri
açıldı. Yeni paket ve normal CRM ekranı doğrulaması henüz tamamlanmadı.
ERP-COMPLETE01 / ERP-DEC-053/054/055, ERP PR #23 ve CRM PR #3 kapsamında.

## Kesinti sonrası güncel kapsam — 14 Ekim 2026

21 iş tablosunun satır sayıları ve tam satır hashleri, 13 Ekim 17:22 kesinti
öncesi kanıtıyla aynı. İki TEST DB online; mevcut CRM talepleri, fiyat sürümleri
ve journal korundu, bekleyen intent yok. Kontrol bütün veritabanı tablolarını,
disk dosyası bütünlüğünü veya tarayıcıdaki kaydedilmemiş çalışmayı kapsamaz.
Özel kanıt `power-audit-20261014` alanında kalır; ham ticari satır GitHub'a girmez.

e3bc144 paketindeki CRM başlangıcı, genel auth/database importlarının ERP-only
compiler grafiğine gitmesinde kapandı. Mevcut paket allowlist'i genişletilmedi.
Beş modülde yalnız önceden doğrulanıp kaydedilmiş CRM bağlamı varsa ERP-only
import seçilmez; ortam bayrağı veya ham JSON yetki yaratmaz. Genel ERP yazıcı,
admin, claim ve isolated runtime getter/register yolları CRM'de kapalı kalır.
Normal ERP aynı bağlam/scope doğrulamalarını yükler. Gerçek allowlist kaynak
projeksiyonunda DB01, fiyatlı DB02, hatalı native proof, yalnız env bayrağı ve
normal ERP AsyncLocalStorage scope için 5 offline kontrol PASS; bağımsız GO.
Listener testte memory mock'tur, gerçek SQL/runtime veya insan kabulü değildir.

Canonical feature startup'ın saf pin listesi için alış referansı doğrulayıcısı
aynı ifadelerle saf modüle çıkarıldı; servis aynı fonksiyonu re-export eder.
12 kesin statik bağımlılık eklendi. Dinamik/harici import yasağı değişmedi,
bütün pinler için eksik dosya/hash olumsuzları ve compatibility eşliği
sınandı: 16 hedefli kontrol PASS, bağımsız GO. Eski stok render ve native
satış/iptal fixture'ları 4/4 ve 11/11 PASS; üretim işlemi yeniden yapılmadı.

Exact eski 35 izin ve eski görev eylemleri geri alındı. 14 Ekim 10:40 civarı
altı gerçek core süreç guard'ı, ERP/Hub/native health ve kapalı CRM provider
health doğrulandı: ERP59c444f / CRM09ca1da / native60e424b, DB02/copye16b70f0,
actualT1=false. Yeni kaynak çalışan bu eski pakete karıştırılmaz.

Güncel korumalı yedek ve yeni immutable paket aktivasyonu sonraki adımdır.
11 Ekim DB02 tam yedeği 13 Ekim fiyat değişikliklerini içermez; ayrı cihaz
kopyası doğrulanmış değildir. Yeni kaynak CI sonucu exact teslim head'inde
raporlanır; 9e06'nın Sites fixture FAIL'i kaynakta düzeltildi, eski ödeme
engeli bu run için sebep değildir. Normal MANUAL taslak/readback, kaynak
eşitliği/replay olumsuzları ve insan kabulü ayrı bekler. Önceki fiyat GUI,
inverse ve restore provaları yeniden yapılmaz.

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
