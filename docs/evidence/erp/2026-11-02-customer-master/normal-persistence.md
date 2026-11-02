# C06/B03 — normal ERP müşteri kalıcılığı kaynak bağlantısı

Görev `ERP-C06-NORMAL-PERSISTENCE-20261102-2034`. Bu teslim **kaynak/offline ve sentetik normal UI provasıdır**. Kurulu5244, SQL ve servisler değiştirilmedi; gerçek kalıcılık ve insan kabulü değildir.

## Doğru hedef ve kaynak dalı

Normal ERP: WEB5244 → API4144/native4146 → `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`.2011saltokunur connector/publicmanifest kanıtı korunur. DB02 kullanıcı tarafından seçilmiş hedef değildir; veri başkaDB'ye taşınmaz. Shared-copy guardları ve eski v1/v2 sözleşmeleri değişmedi.

- `customerMasterCanonicalRuntime.mjs`: yalnız mevcut canonical bootstrap'ın exact hedef, mevcut scoped satışprincipal,4144/erp/writes, SQLtrustedfalse, sysadmin/control/LIVEaccess0 bağını kabul eder. Config/credential okumaz, yeni principal veya bağlantı stringi üretmez. Mevcut pool/driver kullanılır. JSON flag veya kopyalanmış runtime nesnesi normal admission yerine geçmez.
- `customerMasterCanonicalBinding.mjs`: store/service/card okuyucusunu explicit prepared binding olarak döndürür. Üretim API bootstrap'ına otomatik bağlanmaz; global service'in unavailable/503 varsayılanı korunur.
- `customerMasterSqlStore.mjs`: aynı transaction, typed parametre, aktör/rol, replay/CAS/audit ve committed read receipt mekanizmasının exact canonical dalı. Normal source `dbo.usp_read_customer_cards` ve aynı transaction'da **finalParty + mevcut currentFinance** proof'ları kullanılır. Normal hedefte currentFinance context eksikse admission kapanır; opening-only tutar gerçek bakiye yerine geçmez. Context transaction boyunca değişirse rollback olur.
- `customerMasterCanonicalSql.mjs`: normal scope metadata SQL **metinleri**, executor/installer/GRANT yok. UUID'ye özel36karakter/lowercase copy dönüşümü normal scope'a taşınmaz; tam scope hem projection JSON hem applock anahtarında aynen kullanılır.
- Model/service/projection/form v3: `target + scopeKey + admissionHash`, sahtecopyId/seal değildir. Bu scope immutable kaynak/customer/party/account/döviz kimliğiyle projection/journal/audit bağındadır. v1/v2 pending işaretleri normal v3 hedefe taşınamaz. Tarayıcıya yalnız scope/UUID/aktör/card kimliği saklanır; form gövdesi/adı/token saklanmaz.

Kaynak/native customer kartı, source bağlantısı, finans hesapları, hareketler ve hold değişmez. Yerel kod/ad/tür projection ayrı tutulur. Contact formu original kimlikle bağlanır ve yerel yeni adı ezmez. TRY/USD/EUR ayrı, exact bakiye hassasiyeti korunur.

## Koşullu native metadata gereksinimi

Gerçek syscatalog/effective permission dökümü **henüz yok**. Desteklenen `get_runtime_status({})` yalnız runtime ve verifiedreadonly SQL identity döndürür; `query`, `database`, `objects` veya metadata sorgu parametresi yoktur. Commercial ERPconnector Vega veri kümelerine yöneliktir, TESTsyscatalog aracı değildir. Yanlışconnector, CLI/socket/alternatifWindows-SQLidentity, credentialokuma veya yeni accesshelper ile bu sınır aşılmadı.

Gereken mevcut desteklenen readonlymetadata bağı: aynı normalDB üzerinde bu üç nesne ve native referanslar için sys.columns/sys.indexes/sys.foreign_keys/sys.default_constraints/sys.check_constraints ve effective object/column HAS_PERMS SELECT sonuçları. Metadata visibility yokluğu, obje yokluğu değildir. Bu eksik kaynak/offline dalını durdurmadı.

Önerilen şema aynı normalDB'de, **koşullu**:

| Nesne | Normal scope / bağ |
|---|---|
| dbo.customer_master_local_v1 | scope_key nvarchar128 BIN2 + customer_id bigint PK; identity_hash char64; code50/name250/type30; version>0; updated_by; UQ(scope_key,customer_code); nativecustomers(id) FK |
| dbo.customer_master_requests_v1 | scope_key+UUID PK; customer/actor/identityhash/bodyhash/canonicalbody/committedversion; scope+customer FK→local |
| dbo.customer_master_audit_v1 | scope_key+UUID PK/FK→request; customer/actor/bodyhash/before/after/UTCcreated_at |

Scope her nesnede yalnız exact normal hedef sabitiyle CHECK edilir. Stage4copy manifest FK'sı veya uydurma copy kaydı yok. Journal/audit append-only. Schema gate kolon tür/byteuzunluk/nullability, scope BIN2, PK/UQ/FK enabled/trusted/cascade olmaması, native code/name/type ve code collation eşliğini denetler. DDL üretimi actual source customer_code collation parametresi olmadan reddedilir; DBdefault collation tahmin edilmez. Bu SQL metinleri çalıştırılmadı; mevcut tablo/izin varlığı iddia edilmez.

Minimum conditional app izinleri: local SELECT/INSERT + yalnız customer_code/customer_name/customer_type/version/updated_by kolonUPDATE; requests/audit SELECT/INSERT; gerekli normal C06/final/current reader EXEC ve definition visibility, native source/actor/role/permission/hold için exactSELECT. Identity/scope/customerkey, native kart/ledger/account DML ve journal/audit UPDATE/DELETE gerekmez. İzinler sorgulanmadan GRANT ihtiyacı kesinleşmiş sayılmaz; sysadmin/DBCONTROL istenmez.

Gerçek kullanım öncesi actual metadata ile frozen karşılaştırma, gerekiyorsa dar native migration/izin için ayrı somut bakım, explicit bootstrap binding, paket ve gerçek native transaction/replay/rollback/ACK-loss/permission kanıtı gerekir. Bu kaynak teslimi kurulum yetkisi veya gerçek müşteri kaydı değildir.

## Doğrulama

-190hedef test PASS/0skip, offline guard açık. Yeni10canonical test normal reader/final/currentfinancesi, exact scope, üç ayrı bakiye, yanlışDB/login/yetki/port/context, schema/guard/source/finance drift, CAS/UUIDbody/actor/card mismatch, originalcode reservation, teklik, rollback, ACKloss ve GETrecovery, normalUIv3pending/contact/viewer senaryolarını kapsar.
- Driver double SQL Server değildir. SQL applock/collation/DDL/permission/native transaction davranışına gerçek motor PASS verilmez. Bağımsız review UUID36karakter scope kesilmesi P2'sini buldu; iki exact dönüşüm düzeltildi ve SQL metni regresyonuyla kapandı. Son readonly SOURCE GO; yeni somutP1/P2 yok.
- Guardlı Sites build geçti:12,29sVite/13,408stoplam. Kalite ve exactfeature CI sonuçları mevcut PR54/STATUS'ta ayrıca kaydedilir; eski3379CI bu kaynak yerine sayılmaz.
- Normal `createWorkCustomers` + üretimcontroller/service/typedadapter ve yalnız sentetikdriver GUI: kaydet,refresh,yeniadlaara,000155/Toptan,contactaç-iptal,boşadret,mükerrerkodret,ACKloss,reload+explicitGETrecovery,viewer.
- GUI3POSTdenemesi/2localrevizyon/2journal+audit; boşad POST0, mükerrerPOST1fakatwrite0, GETrecovery yeniPOST0/ikinci etki0. İki originalkart ve exactTRY/USD/EUR bakiyeleri aynı kaldı. Mevcut satış geçmişi sentetik harness'te kapsam dışında/403 olarak açıkça gösterilir.
- Kendi izole prova URL'si geçici loopback `customer.html`; privateapp kaydı gerçek port/PID'yi tutar. Normal5244URL veya kalıcı çalışan sürüm diye sunulmaz. Prova sonunda yalnız kendi app/tab kapanır.

Private kanıt: `C:\Sirket\ERP\evidence\ERP-C06-NORMAL-PERSISTENCE-20261102-2034` (test/buildlogları, before/after/counters, AX/screenshot, review ve source/CI receipt). Ticari veri veya sır GitHub'a konulmadı. Seçilmiş Library tasarım sadakati, fiziksel cihaz ve insanUA bu tur yapılmadı; özgün49/25sayaçlar değişmedi.
