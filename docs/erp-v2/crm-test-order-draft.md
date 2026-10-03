# CRM sipariş taslağı — sınırlı TEST sözleşmesi

4 Ekim 2026. Kanonik ERP kaynak: `codex/crm-order-draft-20261004`, [PR #21](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/21). Günlük ERP paketinin yerine geçmez; LIVE deployment değildir.

## Kimlik ve kapsam

- API yalnız `127.0.0.1:62404`; sağlık `/test-health`, `environment=CANONICAL_TEST`, `purpose=crm-order-draft-only`.
- DB tam olarak `MELISA_ERP_SIRKET_TEST_20260929_01`, sunucu `SEMIH\MELISADEV`. Mevcut scoped TEST writer, sysadmin/control/LIVE erişimi olmadan kullanılır.
- Müşteri yalnız `593 / TEST-V70-20260929-C`, CRM konuşma `55`, peer `905387217733`. Gerçek müşteri yerine mevcut sentetik TEST müşteri kullanılır.
- İlk doğrulanmış eşleme: `vega-161466`, `41140 SÜPERMİNİ`, `BÜYÜK ÇİÇEKLER 2 Lİ TAKIM`, `TRY 196` → native ürün `301982`, source_record_key `VEGA2026/F0102TBLSTOKLAR/161466`. Başka ürün kendiliğinden izinli olmaz.
- Kaynak ürünler/fotoğraflar salt okunur; ticari master kart değiştirilmez. Fiyat canlı piyasa, stok veya teslim garantisi değildir.

## Normal akış ve sözleşme

CRM `62400` → 7733 → Dosya ekle → Katalog → TRY → ürün seç → Sipariş taslağı. Mevcut ERP hesabıyla giriş gerekir; parola değişikliği/yeni hesap/passwordless fallback yok.

Native giriş `/api/auth/login`; context `GET /api/test/crm/orders/context`; create `POST /api/test/crm/orders/drafts`; read `GET /api/test/crm/orders/drafts/:requestId`. Native bearer ve ayrı `X-CRM-Authorization` zorunlu; native sales.view/sales.create ve CRM konuşma erişimi/send yetkisi doğrulanır. CRM proxy `62403` sabit native origin ve sağlık kimliğini kontrol eder.

Create gövdesi: UUID requestId, string conversationId `55`, customerId `593`, exchangeRate ve items. Her satır sourceId, exact stockCode, quantity, unitPrice, currency içerir. TRY kuru 1; tek para birimi, 1–50 satır, tam sayı 1–9999 miktar; fiyat en fazla 1 milyon, kur en fazla 10000, toplam/TRY tutarı en fazla 10 milyar. Native ürün/CRM güncel fiyat/kapsam birebir eşleşmelidir.

Receipt: database, UUID, native id/documentNo, draft, müşteri, para birimi/kur/toplam, satırlar ve `erpPersisted=true`, `testOnly=true`, `stockEffect=false`, `ledgerEffect=false`. Private payload hash response'a çıkmaz. Ayrı GET aynı kaydı doğrulamadan UI başarılı saymaz.

UUID, değişmeyen payload ve iki aktörün kimliği kayıtta birlikte tutulur. Aynı UUID+payload tek kayda döner; farklı payload 409. Form kapanınca/yenilenince aynı istek önce okunur; yalnız kesin 404 aynı UUID ile retry açar. Belirsiz hata yeni istek oluşturmaz. Parola/token sessionStorage'a yazılmaz; yeniden giriş mevcut ERP hesabıyla yapılır.

## Kurulum, restart ve geri dönüş

Önce repo origin/HEAD, port sahibi, TEST DB/user/guard ve paketin dosya hash'leri doğrulanır. API entry point `apps/api/start-crm-order-test.mjs`, argüman repo dışındaki mutlak private config yoludur. Private SQL/JWT ayarları çıktı/Git'e alınmaz. API kendi kimlik ve ağ denetimini uygular; yalnız bu süreçte doğrulanmış CRM gateway 62401'e erişim açılır. Günlük native/ERP route policy değiştirilmez.

DDL `infra/sql/test-crm-order-draft-20261004.sql`: yalnız adlandırılmış TEST DB, mevcut müşteri593/writer, boş ürün scope, UUID request/line tabloları, üç procedure ve dar EXECUTE izinleri. Writer'a native tablo DML yetkisi eklemez. Eşleme ayrı doğrulanmış source/native tam anahtar+ad/fiyat/para birimi ve evidence SHA256 ile provision edilir; benzer kod/adla tahmin yapılmaz.

Audit uyarlaması `infra/sql/test-crm-order-audit-20261004.sql`: mevcut paylaşılan TEST audit guard'ın gövdesini koruyarak yalnız doğrulanmış yeni CRM draft audit INSERT'ini ekler. UPDATE/DELETE, yanlış UUID/hash/aktör/kapsam ve karma batch izinli olmaz. Trigger disable/drop edilmez.

Kurulu API paketi `C:\Sirket\ERP\releases\CRM-ORDER-DRAFT-TEST-20261004-02`, source `4fb9eab26cb770a46a9e985ddd64e02b996f2d6f`. Kimlik `C:\Sirket\ERP\runtime\crm-order-draft\owned-process.json`, loglar `C:\Sirket\ERP\logs\crm-order-draft-20261004`. SQL fix ve kanıtlar ayrıca kaydedilir. Süreç CRM supervisor'a bağlı değildir; Windows açılışı garantisi yok.

Restart gerekiyorsa owned-process PID/başlangıç zamanı/komut satırı/release ve 62404 listener sahibi birlikte eşleştirilir; yalnız o süreç durdurulur. Aynı hash doğrulanmış entry point/private config ile gizli başlatılır, sağlık DB/source/purpose kontrol edilir. Günlük 4144/4146/5194 ve LIVE servisleri durdurulmaz. Geri dönüş: yalnız bu ayrı süreci durdur; eski FULL_TEST yazıcısına dönme. Kurulmuş tablolar/taslaklar/audit kanıtları silinmez, TEST ticari veri reset/restore yapılmaz.

## Gerçek kabul

Normal CRM'de mevcut ERP hesabıyla 2 × 196 = 392 TRY draft, ayrı read, kapanma/yeniden açmada aynı UUID/native id, tek sipariş/satır ve audit doğrulanmalıdır. Başlangıç ürün stok 96, TEST müşteri bakiye0, müşteri için sipariş0; stok/bakiye/movement etkisi olmamalıdır. Yanlış/mixed audit INSERT engeli gerçek TEST transaction içinde rollback ile denetlenir. Kod/build/CI veya sağlık tek başına kabul değildir; güncel sonuç STATUS.md ve CRM_STATUS.md içindedir.

4 Ekim 2026 sonuç: normal UI login/create/read ve kullanıcı kabulü PASS. Native id4, 2 adet / 392 TRY; aynı UUID replay tek order/audit. Yanlış hash ve mixed audit insert engellendi. Stok96/bakiye0, yeni stok/cari hareket0. Ayrı UUID ile ikinci 1 adet / 196 TRY TEST taslağı gözlendi. Audit SQL a3fa8fc ayrıca kuruldu; mevcut guard kuralları korunur. Gerçek browser reload sonrası yeniden giriş bu tur denenmedi.
