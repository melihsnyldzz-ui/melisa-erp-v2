# K04-08: yerel müşteri kartını düzenleme sözleşmesi

Bu feature PR54 dce0fff4 müşteri master/contact CAS ve aynı-UUID recovery kararlarını, mevcut boş kurulumun V7 normal oturumuna bağlar. Kaynak, SQL izin kurulumu, paket, normal ekran ve insan kabulü ayrı kanıtlardır.

## Düzenlenebilir alanlar

name (1..250, yalnız boşluk olamaz), phone (NULL veya 0..50), city/country (NULL veya 0..100), customerType (customer/wholesale/retail/mixed). Metinler kontrol karakteri içermez; kırpma/örtük trim yoktur. Telefon için native NVARCHAR(50) ve kart okumasındaki50 sınırı kullanılır; eski create/contact updater40 sınırı yeni edit parametresine taşınıp eski51altı değerler kesilmez. Dokunulmayan NULL ile boş metin korunur; kullanıcı dolu nullable alanı temizlerse NULL gönderilir. Müşteri kodu, para birimi, hesaplar, bakiye, risklimiti, aktif/pasif, sourceKey ve ticari kayıtlar değişmez.

Müşteri ile tek bağlı customer party_entity adı/ülkesi aynı olmalıdır. Mevcut tutarsız/eski çoğul eşleşme sessiz düzeltilmez; işlem kapanır. Müşteri name/country ve entity name/country aynı transaction içinde tutarlı güncellenir.

## Sabit API ve shared sözleşmesi

Yeni shared dosya packages/shared/src/desktopCustomerEdit.mjs; backend sahibindedir.
- normalizeDesktopCustomerEditCommand(value): exact {requestId,expectedRevision,fields:{name,phone,city,country,customerType}}; UUIDv4 ve64hex lower-case canonical; dizi/getter/fazla key reddi; metinler kayıpsız.
- isDesktopCustomerEditContext(value,customerId): exact {customerId,revision,fields}; revision lower64hex; fields aynı alan/türler.
- isDesktopCustomerEditOutcome(value,actorId,customerId,requestId): COMMITTED exact {state,requestId,actorId,customerId,revision,replayed}; NOT_COMMITTED exact {state,requestId,actorId,customerId,resolution:'DURABLE_NO_COMMIT',reason:'REVISION_CONFLICT'|'FENCED_NO_COMMIT',replayed}.
- GET /api/desktop-customers/:id/edit-context -> {success:true,data:context}.
- POST /api/desktop-customers/:id/edit command ->200 COMMITTED,409 bound NOT_COMMITTED; diğer başarısızlıklar success:false ve yetkisiz veri yok.
- POST /api/desktop-customers/:id/edit/resolve aynı özgün command ile ->200 COMMITTED veya200 bound NOT_COMMITTED; customer UPDATE yapmaz, commit yoksa aynı UUID'yi kalıcı no-commit audit fence ile kapatır.
- Her endpoint mevcut normal session ve customer.view+customer.edit ister; aynı SQL transaction'da session/izin/aktör yeniden doğrulanır. Yanlış aktör/body/customer ile UUID reuse bound outcome üretmez, generic409/503; pending'i silme yetkisi vermez.

## Atomiklik ve günlük

SERIALIZABLE TX; UUID için mevcut system sp_getapplock Transaction lock deseni; source=desktop-customer-edit-v1 ve reason=canonical UUID ile audit lookup. Aynı UUID'nin eski committed/no-commit receipt kontrolü CAS'ten ÖNCE gelir. Eski başarılı receipt sonraki müşteri revision'ıyla karşılaştırılıp false conflict yapılamaz.

İlk update customer+entity UPDLOCK/HOLDLOCK; revision server SHA256 ile id/entity/gerçek customer row_version ve güncel alanlar/entity name-country üzerinden üretilir. expectedRevision mismatch -> customer değişmez; bir durable customer.card.not_committed audit fence. Eşleşme -> customer CAS WHERE row_version; yalnız izinli alanlar+updated_at/updated_by, entity name/country, customer.card.updated audit aynıTX. Sonuç readback/receipt doğrulanmadan commit yok. Spurious no-op update de tekUUID ile en çokbir customer rowversion; UI değişiklik yoksa Kaydet kapalıdır.

Audit after_json exact version/kind/actorId/customerId/requestId/payloadHash/command/outcome ve before_json yalnız düzenlenen alanları kapsar. payloadHash=SHA256 UTF8 JSON.stringify({actorId,customerId,command}) deterministic normalized order. COMMITTED receipt yalnız yeni revision ve outcome döndürür; frontend eski receipt alanlarını güncel karta uygulamaz, başarı sonrası fresh context/read yapar.

Resolve aynı UUID lock'ını alıp önce receipt okur; eksikse audit-only FENCED_NO_COMMIT kaydı yazar. Sonradan ulaşan aynı update bu fence'i aşamaz. Genel401/403/404/400/503, ağ hatası veya yapılamayan parse UNKNOWN'dur; bunlar tekrar gönderilmiş belirsiz isteği kesin silmez.

## İstemci ve normal ekran

Müşteri kartında mevcut customer.edit hakkıyla Düzenle. Ayrı edit-context mevcut strict card DTO'sunu bozmaz. Client controller {actorId,customerId,storage,locks,newId,transport} için origin+actor+customer tek pending slot, persist-before-send, WebLock; submit(command) create fresh UUID, resolve() aynı body; context(). Bekleyen/UNKNOWN işlemde UUID/body ve alanlar değişmez. İptal yalnız hiç gönderilmemiş dirty formu kapatır, POST yapmaz; pending İptal/sayfa/hesap değişimiyle silinmez. UNKNOWN'da Sonucu doğrula görünür ve eski komutu resolve eder; otomatik yeni UUID/rebase/overwrite yok.

Core facade customerEditor(customerId) mevcut actor/session/generation sınırını context/submit/resolve öncesi/sonrası denetler. UI canLeave/requestClose edit dirty/busy/pending'i kapsar. Eski kart/capability/session cevabı dirty veya pending edit'i ezemez. Kaydet sonrası fresh kart ile hesap/geçmiş panelleri kontrollü yenilenir. Düzenlenmemiş NULL/boş alanlar formda görünüşü aynı olsa da canonical değerini korur.

## Gerekli dar TEST SQL izin farkı

Mevcut business customer.view/edit rollerinde değişiklik yok. V7 dedicated SQL writer role için müşteride UPDATE(name,phone,city,country,customer_type,updated_by), party_entities üzerinde UPDATE(name,country) gerekir: toplam8column grant, mevcut updated_at izni kullanılır. V5/V6 manifestleri genişletilmez; V7 manifest/guard aynı8kolonu açıkça bekler. DDL/tablo/yeni SQL veya business hesap/rol yok. Root ayrı exact-target plan ve bağımsız inceleme ile bu8kolonu rollback rehearsal/readback dahil kurar; SQL/root runtime eylemleri yalnız root'tadır. Şu an GRANT/SQL uygulanmış değildir.

## Kabul

Aynı kartın iki normal editörü aynı revision ile açılır; A başarılı update, B eski revision ile409/no-commit ve A değişikliği korunur. İptal sıfır POST ve native fark0. Başarılı update yanıtının kontrollü kaybında pending aynıUUID/body kalır; normal Sonucu doğrula committed receipt'i getirir, tek revision/audit ile sonuç doğrulanır. Gerçek lostACK taşıma yolu desteklenmezse source/synthetic yerine gerçekGUI PASS yazılmaz. PR54 demo ve K04-01 create evidence tekrar çalıştırılmadan desen/temel olarak kullanılır; fiş/ödeme/cihaz/209 tekrarları yok. İnsan kabulü son toplu kabulde açık kalır.
