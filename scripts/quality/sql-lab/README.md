# Isolated commerce SQL acceptance

These manual scripts are deliberately excluded from `test:commerce`. They write synthetic test data only to a separately named SQL Server container, fixed loopback port 51433 and its own Docker volume. Production ERP and Vega configuration must not be used. The database name remains MELISA_ERP_V2 so the production write guard is exercised unchanged; the SQL server is separate.

The lab binding and fixtures live under ignored `temp/sql-lab/`. Random credentials are stored outside the repository in the user's private Codex backup directory. Never commit or print those files. Start refuses an occupied port, existing container or existing binding. Bootstrap checks the exact server machine name and refuses an existing database before schema creation. It applies reviewed migrations 0001–0014, disables the reference admin account and creates two synthetic products and one customer. A dedicated app login has only db_datareader/db_datawriter. Tests verify that it lacks CREATE TABLE, CONTROL and sysadmin permissions.

From the repository root, initial setup is `scripts/quality/sql-lab/start.ps1`, then `node scripts/quality/sql-lab/probe.mjs` after SQL is ready, then `node scripts/quality/sql-lab/bootstrap.mjs`. Do not rerun bootstrap against an initialized lab. An existing lab can be inspected with `node scripts/quality/sql-lab/inspect.mjs` and resumed only after its Docker labels, volume and loopback binding are verified.

`node scripts/quality/sql-lab/accept-terminal.mjs` executes the actual ERP service functions. The process rejects non-lab network connections, fetch, listeners and child processes. It verifies four parallel same-event requests, exact replay, payload/owner conflict, SQL-trigger failure after finalization and finance account reads. The failure trigger is scoped to this synthetic database and removed in finally. A fresh process can verify durable replay using the same command with `--replay-only`, including after restarting this lab's container. Each new full run deliberately creates one additional synthetic invoice; replay-only creates none.

`node scripts/quality/sql-lab/accept-native-driver.mjs` verifies real commit, rollback and both SQL boundary failures through the patched msnodesqlv8/ODBC driver. It uses the isolated SQL login, so this does not establish Windows integrated-authentication acceptance. Its probe table is synthetic and retained with the lab evidence.

The initial container used two dedicated networks because Docker did not publish the loopback port for an internal-only network. The corrected start script uses a dedicated bridge with inter-container communication disabled. No existing application network or data volume is attached. Restart policy is `no`; no Windows startup registration is created. Stop only the named lab container after testing, preserving its volume and credentials for later commercial UI acceptance.

Microsoft setup reference: [SQL Server Linux container quickstart](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker?view=sql-server-ver17). The tested image is pinned by digest in start.ps1 rather than relying on future changes to the latest tag.
# Web kabulü ek akışı

Mevcut laboratuvarı yeniden oluşturmayın. Önce yalnız `commerce-sql-20260908` konteynerinin etiketini, kendi volume'unu ve 127.0.0.1:51433 bağını doğrulayın; durmuşsa bu konteyneri başlatın ve `probe.mjs` ile kimlik doğrulayın.

- `prepare-web.mjs`: yalnız bir kez ayrı şifreli TEST-web hesabı oluşturur. Mevcut kayıt varsa durur; şifreyi yazdırmaz.
- `accept-product-schema.mjs`: yalnız laboratuvarda 0018'i transaction içinde iki kez uygular ve mevcut değerleri, bağlantıları, foreign key engelini kontrol eder.
- `serve-web-api.mjs`: gerçek createApp'i dış eylem engelleri ve SQL kimlik kontrolüyle 127.0.0.1:54100 üzerinde başlatır. `--probe-products` yalnız ürün sorgularını kontrol eder ve çıkar.
- Web-admin'i `VITE_API_BASE_URL=http://127.0.0.1:54100`, demo ve passwordless false, 127.0.0.1:54173 strict port ile başlatın. Kalıcı .env oluşturmayın. Tarayıcı oturumunu ve bu iki süreci test sonunda kapatın.
- `inspect-web.mjs purchase-draft|purchase-final|sale-draft|sale-final|finance-final`: belge senaryosunun ilgili aşamasında SQL değerlerini doğrular; sonraki aşamadan eski aşama kontrolü çalıştırmayın. `snapshot` yalnız okur, aşama kabulü değildir.

Tam UI adımları, beklenen rakamlar ve açık işler: `docs/erp-v2/commerce-web-sql-acceptance-20260908.md`. Her yeni ticari test yalnız bu ayrı SQL sunucusuna yazabilir. Test adı filtrelerinin raporlardan dışlanması genel rapor kabulü sayılmaz.
