import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  authRoutes: 'apps/api/src/routes/authRoutes.js',
  authAdminRoutes: 'apps/api/src/routes/authAdminRoutes.js',
  terminalRoutes: 'apps/api/src/routes/terminalRoutes.js',
  authService: 'apps/api/src/services/authService.js',
  authAdminService: 'apps/api/src/services/authAdminService.js',
  terminalAuth: 'apps/terminal-app/src/services/authService.js',
  terminalLogin: 'apps/terminal-app/src/screens/LoginScreen.js',
  webAuthAdmin: 'apps/web-admin/src/modules/settings/AuthAdminScreen.jsx',
};

const source = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')])),
);

assert.match(source.authRoutes, /get\('\/auth\/terminal-users'/, 'Terminal user list route is missing');
assert.match(source.authRoutes, /post\('\/auth\/terminal-login'/, 'Terminal login route is missing');
assert.match(source.authService, /TERMINAL_DEVICE_NOT_ACTIVE/, 'Inactive or unregistered devices must be rejected');
assert.match(source.authService, /e\.is_active = 1/, 'Only active personnel should be selectable');
assert.match(source.authService, /INNER JOIN dbo\.employees e ON e\.user_id = u\.id/, 'Every active personnel login must come from the employee account link');
assert.doesNotMatch(source.authService, /AND e\.can_terminal_sale = 1/, 'Personnel list must not require a separate terminal assignment flag');

assert.match(source.authAdminRoutes, /post\('\/auth-admin\/users'.*settings\.manage/, 'ERP user creation must require settings.manage');
assert.match(source.authAdminRoutes, /patch\('\/auth-admin\/users\/:id\/password'.*settings\.manage/, 'Password reset must require settings.manage');
assert.match(source.authAdminService, /bcrypt\.hash\(password, 12\)/, 'New passwords must be hashed');
assert.match(source.authAdminService, /auth_refresh_tokens[\s\S]*revoked_at/, 'Password reset must revoke existing sessions');
assert.doesNotMatch(source.authAdminService, /afterSnapshot:\s*\{[^}]*password\s*[,}]/, 'Plain passwords must never be written to audit');

assert.match(source.terminalAuth, /\/auth\/terminal-login/, 'Terminal must use the protected terminal login endpoint');
assert.match(source.terminalAuth, /\/auth\/terminal-users/, 'Terminal must load selectable ERP users');
assert.doesNotMatch(source.terminalAuth, /\/auth\/local-passwordless-admin/, 'Terminal must not call passwordless admin login');
assert.doesNotMatch(source.terminalLogin, /Local Acik Admin/, 'Passwordless admin button must not be visible');
assert.match(source.terminalLogin, /Baglanti ayarlari/, 'Connection settings panel is missing');
assert.match(source.terminalLogin, /settingsOpen \?/, 'Connection settings must be collapsible');
assert.match(source.terminalLogin, /selectedUsername \?/, 'Password area must open only after selecting personnel');
assert.match(source.terminalLogin, /Programa Gir/, 'Terminal login action is missing');
assert.match(source.webAuthAdmin, /Yeni ERP Kullanıcısı/, 'ERP user creation panel is missing');
assert.match(source.webAuthAdmin, /Şifreyi Değiştir/, 'ERP password reset action is missing');

assert.match(source.terminalRoutes, /terminal\.sync\.run/, 'Terminal read routes must accept terminal sync permission');
assert.match(source.terminalRoutes, /terminal\.sales\.create/, 'Terminal sales routes must accept terminal sales permission');

console.log('PASS terminal user login smoke');
