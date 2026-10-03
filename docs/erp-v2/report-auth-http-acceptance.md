# Dönem raporu HTTP oturum kabulü

Komut: `node --test scripts/quality/report-auth-http.test.mjs`

Gerçek Express dashboardRoutes, authMiddleware, authService JWT doğrulama, permissionCatalog, controller ve rapor servisi birlikte çalışır. Yalnız config/SQL verisi ve logger test sınırlarıdır. Diğer servis istemcileri yüklenmez; sadece dönem raporu GET isteği çağrılır. Loopback geçici port test sonunda kapanır. Hiçbir canlı credential veya veritabanı kullanılmaz.

10 senaryo: eksik token, bozuk token, yanlış imza, süresi dolmuş token, pasif kullanıcı, bulunamayan kullanıcı, ADMIN JWT iddiasına rağmen rapor yetkisi olmayan kullanıcı, yetkili kullanıcı, aynı JWT için kaldırılan yetki, kullanıcı veritabanı hatası. Reddedilen bütün isteklerde rapor sorgusu sayısı değişmez. İlk dört durumda kullanıcı sorgusu da çalışmaz. Yetkili istek 200 döner; geri alınan yetki aynı token ile 403 döner.

2026-09-10: HTTP test PASS; syntax/scoped ESLint PASS; API166source roots/0diagnostics. Ürün kodu değişmedi; önceki build kaydı geçerli. Bu SQL sürücüsü/production izinleri veya bütün rol matrisinin kabulü değildir. Test loopback kullandığı için network-deny commerce paketine eklenmedi; yukarıdaki açık komutla çalıştırılır.
