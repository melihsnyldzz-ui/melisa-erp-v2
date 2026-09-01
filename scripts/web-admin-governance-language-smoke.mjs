import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockScreenContent, mockScreenMetadata } from '../apps/web-admin/src/data/mockScreenData.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const files = {
  auditScreen: read('apps/web-admin/src/modules/settings/AuditLogScreen.jsx'),
  authScreen: read('apps/web-admin/src/modules/settings/AuthAdminScreen.jsx'),
  workspace: read('apps/web-admin/src/components/workspace/Workspace.jsx'),
  unauthorizedScreen: read('apps/web-admin/src/components/auth/UnauthorizedScreen.jsx'),
  loginScreen: read('apps/web-admin/src/components/auth/LoginScreen.jsx'),
  smartPanel: read('apps/web-admin/src/components/layout/SmartInsightsPanel.jsx'),
  appShell: read('apps/web-admin/src/components/layout/AppShell.jsx'),
  statusBar: read('apps/web-admin/src/components/layout/StatusBar.jsx'),
  viewOptions: read('apps/web-admin/src/config/viewOptions.js'),
  navigation: read('apps/web-admin/src/data/mockNavigationData.js'),
  sidebar: read('apps/web-admin/src/components/navigation/Sidebar.jsx'),
  auditApi: read('apps/web-admin/src/services/auditApi.js'),
  authAdminApi: read('apps/web-admin/src/services/authAdminApi.js'),
  mockScreenData: read('apps/web-admin/src/data/mockScreenData.js'),
};

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

addCheck(
  'audit log screen uses clear Turkish business language',
  files.auditScreen.includes('<strong>Denetim Günlüğü</strong>')
    && files.auditScreen.includes('<strong>Salt Okunur Kapsam</strong>')
    && files.auditScreen.includes('<strong>Kapsam Haritası</strong>')
    && files.auditScreen.includes('<strong>Denetim Kayıtları</strong>')
    && files.auditScreen.includes('Bu ekran yalnızca denetim kayıtlarını okur.'),
);

addCheck(
  'audit log screen has no prior damaged visible phrases',
  ![
    'Audit kayitlari',
    'Kritik islem izleri',
    'Read-only kapsam',
    'Guvenli izleme',
    'Tam coverage',
    'Kismi coverage',
    'Coverage haritasi',
    'Yazdir/PDF',
    'Filtreye uygun audit kaydi yok',
  ].some((text) => files.auditScreen.includes(text)),
);

addCheck(
  'audit technical statuses and raw evidence fields remain intact',
  ['covered', 'partial', 'actorName', 'action', 'entityType', 'source', 'reason', 'hasBeforeSnapshot', 'hasAfterSnapshot']
    .every((value) => files.auditScreen.includes(value)),
);

addCheck(
  'audit coverage and risk values have Turkish display mapping',
  ['sales', 'purchase', 'finance', 'stock', 'customer_supplier', 'import', 'auth_settings', 'crm_pipeline', 'terminal']
    .every((value) => files.auditScreen.includes(`${value}: {`))
    && files.auditScreen.includes("critical: 'Kritik'")
    && files.auditScreen.includes("high: 'Yüksek'")
    && files.auditScreen.includes("medium: 'Orta'")
    && files.auditScreen.includes('coverageAreaLabel(area)')
    && files.auditScreen.includes('coverageAreaDescription(area)')
    && files.auditScreen.includes('riskLabel(area.risk)')
    && files.auditScreen.includes('İşlem kodları (kayıt sayısı)'),
);

addCheck(
  'audit client remains GET-only',
  files.auditApi.includes("import { get } from './apiClient.js';")
    && files.auditApi.includes("get('/api/audit/logs', params)")
    && files.auditApi.includes("get('/api/audit/coverage')")
    && !/\b(post|patch|put|del|deleteRequest)\s*\(/.test(files.auditApi),
);

addCheck(
  'authorization screen uses business labels while keeping permission keys',
  files.authScreen.includes('son denetim kayıtları')
    && files.authScreen.includes('Giriş yapabilen hesap')
    && files.authScreen.includes('Sistem ayarlarını yönetme yetkisi gerekli')
    && files.authScreen.includes('Denetim kaydı ara')
    && ['settings.manage', 'sales.finalize', 'purchase.finalize', 'import.run']
      .every((value) => files.authScreen.includes(value)),
);

addCheck(
  'authorized user management endpoints remain unchanged',
  files.authAdminApi.includes("get('/api/auth-admin/overview')")
    && files.authAdminApi.includes("patch(`/api/auth-admin/users/${id}`, payload)")
    && files.authAdminApi.includes("post('/api/auth-admin/users', payload)")
    && files.authAdminApi.includes("patch(`/api/auth-admin/users/${id}/password`, { password })"),
);

addCheck(
  'workspace permission messages are clear Turkish',
  files.workspace.includes('çalışma alanı bağlantısı tamamlanmalıdır')
    && files.workspace.includes('Operasyon sağlığını görüntüleme yetkiniz yok.')
    && files.workspace.includes('Toplu alış girişini görüntüleme yetkiniz yok.')
    && files.workspace.includes('Peşin cari takibini görüntüleme yetkiniz yok.')
    && files.workspace.includes('Veri aktarımını çalıştırma yetkiniz yok.')
    && files.workspace.includes('Döviz kuru yönetimi yetkiniz yok.')
    && files.workspace.includes('Personel tanımları yönetimi yetkiniz yok.')
    && files.workspace.includes('Denetim günlüğünü görüntüleme yetkiniz yok.')
    && files.unauthorizedScreen.includes('Erişim Yetkisi Gerekli')
    && files.unauthorizedScreen.includes('Rol ve yetki kontrolü'),
);

addCheck(
  'login and workspace chrome use clear Turkish',
  files.loginScreen.includes('Güvenli yönetim girişi')
    && files.loginScreen.includes('Şifre')
    && files.appShell.includes('DEMO MODU: Gerçek veri bağlantıları kapalı; işlemler kaydedilmez')
    && files.statusBar.includes("isDemoMode ? 'Demo modu' : 'Bağlantı açık'")
    && files.statusBar.includes('<b>Veritabanı</b>')
    && files.statusBar.includes('<b>Oturum</b><span>Açık</span>')
    && files.sidebar.includes('Uygulama:')
    && files.sidebar.includes('Veritabanı:'),
);

addCheck(
  'view options use Turkish labels without changing option keys',
  files.viewOptions.includes("label: 'Özet bilgi kartları'")
    && files.viewOptions.includes("label: 'Başlık açıklamaları'")
    && files.viewOptions.includes("label: 'Bağlantı ayrıntıları'")
    && files.viewOptions.includes('Uygulama ve veritabanı bağlantı durumlarını göster/gizle')
    && ['darkMode', 'simpleMode', 'showSmartPanel', 'showKpis', 'showConnectionDetails', 'rowDensity']
      .every((key) => files.viewOptions.includes(`key: '${key}'`)),
);

addCheck(
  'workspace permission ids and screen ids remain unchanged',
  files.workspace.includes("'auth-overview':")
    && files.workspace.includes("'audit-log':")
    && (files.workspace.match(/permissionKeys: \['audit\.view'\]/g) || []).length >= 3
    && files.navigation.includes("screenId: 'audit-log'")
    && files.navigation.includes("id: 'audit-log'"),
);

addCheck(
  'navigation and guidance show consistent Turkish labels',
  (files.navigation.match(/Denetim Günlüğü/g) || []).length >= 2
    && files.sidebar.includes("'audit-log': 'Denetim Günlüğü'")
    && files.smartPanel.includes('WhatsApp hazırlık listesi')
    && files.smartPanel.includes('kayıt kesinleştirme veya canlı veritabanı yazımı yapmaz'),
);

addCheck(
  'legacy example screen data is explicitly marked as non-live synthetic content',
  mockScreenMetadata.synthetic === true
    && mockScreenMetadata.readOnly === true
    && mockScreenMetadata.writePerformed === false
    && mockScreenMetadata.liveApplicationUsage === false
    && mockScreenMetadata.notice.includes('şirket verisi değildir')
    && mockScreenMetadata.notice.includes('canlı uygulamada kullanılmaz'),
);

addCheck(
  'legacy example screen descriptions use clear Turkish business language',
  ![
    'terminal sync',
    '%75ini',
    'satış finalize',
    '%50si',
    'offline sync',
    'Sync kuyruğu',
    'Son sync',
    '1 offline',
    '13:55te',
    'Bekleyen sync',
    'Export:',
    'env dosyası',
    'Frontend',
    'Health endpoint',
    'Env kontrollü',
    'Se?ret',
    'Audit filtrele',
    'Finalize/cancel',
    'granular',
    'Audit görünümü',
    'Canlı secret',
  ].some((fragment) => files.mockScreenData.includes(fragment)),
);

const expectedLegacyScreenIds = [
  'stock-list',
  'product-card',
  'customer-list',
  'sales-invoice',
  'purchase-invoice',
  'catalog-list',
  'price-list',
  'stock-movements',
  'customer-movements',
  'customer-statement',
  'sales-offers',
  'sales-orders',
  'finance-overview',
  'collections-overview',
  'whatsapp-planner',
  'terminal-overview',
  'reports-overview',
  'definitions-overview',
  'settings-overview',
  'auth-overview',
];
addCheck(
  'legacy example identifiers remain stable',
  Object.keys(mockScreenContent).length === expectedLegacyScreenIds.length
    && expectedLegacyScreenIds.every((screenId) => Object.hasOwn(mockScreenContent, screenId))
    && ['STK-100245', 'SF-TASLAK-0301', 'AF-TASLAK-0401', 'TERM-01', 'dashboard.view', 'sales.finalize', 'purchase.cancel', 'audit.view']
      .every((value) => files.mockScreenData.includes(value)),
);

const mockScreenDataPath = resolve(repoRoot, 'apps/web-admin/src/data/mockScreenData.js');
const runtimeReferences = sourceFiles(resolve(repoRoot, 'apps/web-admin/src'))
  .filter((filePath) => filePath !== mockScreenDataPath)
  .filter((filePath) => readFileSync(filePath, 'utf8').includes('mockScreenData'));
addCheck(
  'legacy example data stays outside live application and network paths',
  runtimeReferences.length === 0
    && !/\b(?:fetch|post|put|patch|del|deleteRequest)\s*\(/.test(files.mockScreenData)
    && !files.mockScreenData.includes('/api/'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
