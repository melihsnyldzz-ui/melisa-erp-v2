# ERP-COMPLETE01 — güvenli API günlükleme kaynak kanıtı

Tarih: 11 Ekim 2026. Aynı ERP-COMPLETE01 işinin ERP-DEC-048 güvenlik alt kapsamıdır; yeni teslim işi veya kullanıcı kabulü değildir.

## Karar, kaynak ve runtime ayrımı

- Kullanıcının doğrudan talimatı: hassas bilgi konusunu kontrol edip düzeltmek; diğer işleri bekletmeden bitirmek.
- Karar: [ERP-DEC-048](../../../../PROJECT_DECISIONS.md#erp-dec-048--11-ekim-2026--onaylı), commit `e4aa5ddbde8527e25f2c7f090011f4ae3284f749`; push ve kanonik sahip kabulü kayıtlı.
- Bu incelemede sabitlenen runtime kaynak tabanı: `9cc84ff96981ebc38d7292ffc01087f77441211e`.
- Kaynak yaması: `1a14a3303001d0d4f0b6ec2b48dc72b2361ad713`, `codex/security-safe-logs-20261011` dalı. Bu kayıt kaynak teslimini anlatır; yama henüz runtime paketine alınmadı/deploy edilmedi.
- TEST erişim sırlarının döndürülmesi ve gerçek runtime kontrolü kanonik ortam sahibinde sürer. Bu kaynak/sentetik kanıt, eski erişim sırlarının iptal edildiğini veya runtime gideriminin tamamlandığını kanıtlamaz.

## Değişiklik kapsamı

`apps/api/src/utils/logger.js`, `apps/api/src/middleware/requestContext.js`, `apps/api/src/middleware/errorHandler.js` ve `apps/api/src/utils/logger.test.mjs` ile sınırlı kaynak değişikliği:

- Yalnız sabit kanonik metadata alan adları tutulur. Bilinmeyen ad/değerler gizlenir; yalnız `omittedFields` sayacı görünür. Böylece sırın alan adına gömülmesi de çıktıya taşınmaz.
- Password/apiKey/cookie/authorization/connection-string gibi alanlar ve farklı yazım biçimleri değer veya değer parçası dökmez. Ham serbest metin, Error.message/stack ve query içerikleri loga verilmez.
- Hata kodları kaynakta bulunan sabit kodlar ve açık driver kodları izinlistesiyle; olay/kategoriler kapalı sabit kümelerle sınırlandırılır. Biçime uyan bilinmeyen metin de maskelenir. Mevcut yedi logger mesajı korunur.
- Sekiz değer içermeyen mevcut başlangıç uyarısı ayrı sabit `warningCode` değerlerine dönüştürülür; JWT/SQL/CORS/Nakliyat uyarıları ayırt edilir. Başka serbest uyarı metni kabul edilmez.
- `level/message/timestamp` metadata tarafından ezilemez. Getter ve uygulamaya ait `toJSON` çalıştırılmaz; circular/depth/entry sınırları, hostile proxy ve desteklenmeyen primitive değerler güvenli biçimde bastırılır.
- `requestId` UUID; yöntem, ortam, durum, süre ve diğer izinli alanlar sınırlı tip/biçimle kabul edilir. İstek log yolu module-private opaque yardımcı üzerinden yalnız server route şablonundan çözülür; doğrudan veya nested ham path stringi kabul edilmez.
- Public hata yanıtı, Retry-After, auth/rol/iş davranışı değiştirilmedi.

## Sentetik doğrulama

Testler console'a yazılan gerçek JSON satırını yakalar; gerçek erişim sırları yerine zararsız sentetik işaretler kullanır. SQL, sağlayıcı, gerçek müşteri veya özel env/config erişimi yoktur.

| Kontrol | Sonuç |
|---|---|
| Hassas alan yazım çeşitleri, nested yapılar, free text, Error/stack, bağlantı metni ve query; tam değer ve parça yokluğu | PASS |
| Güvenli tanılama alanlarının korunması ve metadata'nın ana mesaj/seviye/tarihi ezememesi | PASS |
| İzinregex'ine uyan uppercase/lowercase sentetik code/category/eventCode değerlerinin yine gizlenmesi | PASS |
| Sekiz başlangıç uyarısının farklı sabit kodlarla korunması; yeni uyarı metninin bastırılması | PASS |
| Yanlış tip/sınır ve UUID olmayan requestId değerinin güvenli kabul edilmemesi | PASS |
| Circular/depth, getter/toJSON, hostile proxy, BigInt/Symbol/non-finite değerlerin hata veya sızıntı üretmemesi | PASS |
| Sır içeren bilinmeyen alan adlarının gizlenmesi ve izinli alan adlarının kanonikleştirilmesi | PASS |
| Statik route şablonu, unmatched route ve ham/nested path kanallarının ayrılması | PASS |
| Mevcut yedi logger çağrısının statik mesajları ve kaynakta bulunan sabit hata-helper/assignment kodlarının korunması | PASS |
| Request/error middleware serialized çıktısı; public yanıt, x-request-id ve bounded Retry-After davranışının korunması | PASS |

Komutlar, depo kökünden:

```text
node --test apps/api/src/utils/logger.test.mjs
node --require ./scripts/ci/offline-guard.cjs --test apps/api/src/utils/logger.test.mjs
git diff --check
```

Hedefli ve guarded koşular **10/10 PASS**. Syntax kontrolleri ve bağımsız ikinci kaynak incelemesi PASS; ikinci incelemenin unknown-key, biçime uygun canary ve nested-path sentinellerinde açık blocker bulunmadı. Bu sonuçlar hosted CI, runtime dağıtımı veya kullanıcı kabulü yerine geçmez.

## Dar geçmiş tarama sınıflandırması

Root ve bağımsız inceleme, Gitleaks çıktısındaki **9 entry / 6 unique** tarihsel bulguyu sentetik provenance/source kimlikleri ve sabit public scopeKey olarak sınıflandırdı; erişim sırrı değiller. Kanonik `80829d8` ignore kaydında bu fingerprint'ler yoktu. Root yalnız bu altı exact tarihsel fingerprint'i açıklamasıyla `.gitleaksignore` içine ekledi; geniş dosya/dizin/rule hariç tutması yoktur. Bu belge işi ignore dosyasını değiştirmedi.

Scanner **Gitleaks v8.30.1**; resmi arşiv SHA doğrulaması root tarafından yapıldı. Dar ignore ekleriyle fetched yerel Git geçmişi ve tüm yerel ref'ler yeniden tarandı: **exit0 / 0 findings**. Output-safe kayıt ve redaction100 raporu `logger-source-scan-reviewed.json` olarak root'ta tutulur. Bu aşamada ignore ekleri henüz commitlenmedi; nihai teslim commit/head için son taramayı root ayrıca yapacaktır. Ara sonuç hosted CI veya her erişilemeyen uzak/unfetched kaynak için temizlik kanıtı değildir.

## Sınırlılıklar ve kalan iş

- Önceki araç/terminal çıktıları veya geçmiş loglar bu yamayla geriye dönük temizlenmez. Sır döndürme, eski access/refresh iptali ve protected-store teslimi ayrı kanonik runtime işidir; tamamlanma sonucu henüz bu kayıtta yoktur.
- Bu çalışma gerçek remote negative test yapmadı; log filtresi için kaynak/sentetik kanıttır. Düzeltilmiş runtime kimliği ve gerçek redacted-log sonucu deploy sonrası ayrıca kaydedilmelidir.
- Gitleaks tarihsel falsepositive sınıflandırması ve dar ignore ile ara tekrar taraması tamam; nihai teslim commit/head taraması root'ta bekler. Git/kaynak bütünü temiz, hosted secret-scan PASS veya geçmişte sır yok iddiası verilmez.
- Router mount/baseUrl ham verisi loglanmaz; aynı iç route şablonunu kullanan mount'ların log yolu ayrımı sınırlıdır. Method, doğrulanmış requestId ve sabit hata/olay kodları korunur. UUID olmayan requestId yalnız logda gizlenir; mevcut istek/header davranışı değişmez.
- Yeni statik logger mesajı/operasyon kodu veya güvenli metadata alanı eklenirken izinlistesi gözden geçirilmelidir; kaynak kapsam testi yeni statik hata kodlarını kayıtsız kabul etmez. Serbest tanılama ayrıntıları bilinçli olarak bastırılır.
- Merkezi logger dışındaki shell/araç çıktıları ve public hata yanıtları bu yamanın filtreleme kapsamı değildir. Özel config içeriğinin geniş dökümü güvenli hâle gelmiş sayılmaz.
- Yeni UI/personel kabulü yok; **49 / 9 tamam / 39 kısmi / 1 açık** ve **ERP-UA32 bekliyor** aynı. LIVE/Vega/T1, gerçek müşteriye mesaj ve ücretli hizmet işlemi yapılmadı.

[Güncel teknik durum](../../../../STATUS.md) · [Aynı pano işi](../../../../DELIVERY_BOARD.md) · [Finish planı](../../../../ERP_FINISH_PLAN.md)
