# İçeriğe bağlı fotoğraf teslimi — 2026-09-10

VERIFIED ürün görseli artık /uploads/verified-products/{SHA256}--{filename} yoluyla sunulur. İstek sırasında sabit yerel ve boyutu sınırlı kaynak dosya okunur, hash karşılaştırılır ve tam o buffer gönderilir. Ayrı sendFile okuması yoktur. Dosya değişirse409; kayıp veya hatalı yol404; desteklenmeyen içerik415; yazma405. Route normal /uploads statik servisinden önce tutulur ve hata durumunda fallback yapmaz. no-store/nosniff ve içerikten JPEG/PNG/WebP MIME kullanılır. HEAD gövdesizdir. Ham kaynak dosya/analiz URL'si korunur.

PDF yalnız VERIFIED + hash + aynı hash'i taşıyan yeni URL eşleşmesini kabul eder. Terminal ürün projeksiyonu da yeni URL'yi alır. Bu bir fotoğraf kimliğine yeni onay verme veya raw dosyaya erişim yetkisi değiştirme işlemi değildir; var olan onayın içerik revizyonunu bağlar. Eski ham URL'ler analiz/diğer mevcut işlevler için korunur; public katalog henüz yeni filtreye geçirilmedi.

171 commerce/15PDF/web-regression PASS. API155/web187 typecheck sıfır tanı; scoped lint/build PASS, mevcut lucide/bundle uyarıları. Gerçek Express HTTP fixture: arşivlenmiş fotoğrafın test kopyası200 ve aynıSHA,HEAD0gövde; test dosyasını değiştirdikten sonra409 ve statikfallback dosyası sızmıyor; query404/POST405. 5HTTP kontrolü. Kaynak fotoğraf değiştirilmedi; operatör onayı uygulanmadı. Ayrı6isteklik PB→ERP→PDF sentetik zincir yeniden geçti. Sunucular kapandı. Koruma66/2182/6/0. İndeks8853/28097, mevcut28parsepartial; değişen kaynaklar doğrudan incelendi.

Açık: public katalog/site gateway yeni URL ve inceleme politikasını tüketmeli; native terminal görsel ve gerçek PDF kaydet yolu yeni kontratla doğrulanmalı. Mevcut fotoğraf revizyonunun geri alınması, daha önce indirilmiş içeriği geri çağırma garantisi değildir. Canlı deploy/merge yok; genel hedefIN_PROGRESS.

Kanıt: audit/commerce-no-messaging-20260908/verified-image-http/acceptance.json.