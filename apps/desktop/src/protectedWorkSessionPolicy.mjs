export const worktest = Object.freeze({
  origin: 'http://127.0.0.1:5234', url: 'http://127.0.0.1:5234/terminal.html?worktest=1#home', erpUrl: 'http://127.0.0.1:5234/ornek-akis.html#home',
  api: 'http://127.0.0.1:4184', native: 'http://127.0.0.1:4186',
  copyId: 'e16b70f0-4057-428b-9abc-6bbcaf35fe82', database: 'MELISA_ERP_CRM_SHARED_TEST_20261009_02', server: 'Semih\\MELISADEV',
});
const fail = () => { throw new Error('WORKTEST_PROTECTED_SESSION_UNAVAILABLE'); };
export function worktestMode(env, platform) {
  if (env.MELISA_DESKTOP_ISOLATED_WORKTEST === undefined) return null;
  if (env.MELISA_DESKTOP_ISOLATED_WORKTEST !== 'true' || platform !== 'win32' || !/^[a-f0-9]{40}$/.test(env.MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT ?? '')) fail();
  return Object.freeze({sourceCommit: env.MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT});
}
export function approvedWorktestPage(raw) {
  try {
    const u=new URL(raw);
    if(u.origin!==worktest.origin || u.username || u.password) return false;
    const route=u.hash.slice(1)||'home';
    if(u.pathname==='/terminal.html')return u.search==='?worktest=1' && ['home','goods','sales','packing','crm'].includes(route);
    return u.pathname==='/ornek-akis.html' && u.search==='' && ['home','stock','approvals','sales','receipts','customers','collections','goods','purchases','suppliers','supplier-payments','count','returns','reports','settings'].includes(route);
  } catch { return false; }
}
export function approvedWorktestNavigation(details, mainFrame) {
  if(details.isMainFrame === true) return approvedWorktestPage(details.url);
  try {
    const u=new URL(details.url);
    return details.isMainFrame === false && details.frame?.parent === mainFrame && u.origin === 'http://127.0.0.1:62700' && u.pathname === '/' && !u.username && !u.password && [...u.searchParams.keys()].sort().join(',') === 'erpOrigin,terminal' && u.searchParams.get('terminal') === '1' && u.searchParams.get('erpOrigin') === worktest.origin;
  } catch { return false; }
}
export function assertWorktestSender(event, window) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.sender.isDestroyed() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame || !approvedWorktestPage(event.senderFrame.url) || !approvedWorktestPage(event.sender.getURL())) fail();
}
export function assertWorktestHealth(records, sourceCommit) {
  if (!Array.isArray(records) || records.length !== 3) fail();
  const ports = [5234,4184,4186];
  records.forEach((h,i) => {
    if (h?.ok !== true || h.environment !== 'ISOLATED_TEST_COPY' || h.port !== ports[i] || h.databaseName !== worktest.database || h.copyId !== worktest.copyId || h.sourceCommit !== sourceCommit || h.actualT1 !== false) fail();
    if (i && (h.serverName !== worktest.server || ['sysadmin','databaseControl','liveDatabaseAccess','originalDatabaseAccess'].some(k => h[k] !== 0) || h.externalOperations !== false || h.automaticJobs !== false || h.writes !== (i === 1) || h.sqlReadOnly !== (i === 2))) fail();
  });
}
export function validateWorktestSession(value, identity = null) {
  if(identity && (identity.userId!=='17'||identity.username!=='erp-semih-test-20261012'||identity.role?.id!=='2'||identity.role?.code!=='admin'||!/^[a-f0-9]{64}$/.test(identity.fingerprint??'')))fail();
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== 'accessToken,expiresAt,refreshToken,userId,username') fail();
  for (const k of ['accessToken','refreshToken','userId','username']) if (typeof value[k] !== 'string' || !value[k].length || value[k].length > (k.endsWith('Token') ? 8192 : 160) || /[\u0000-\u001f\u007f]/.test(value[k])) fail();
  if (!(identity ? value.userId === identity.userId && value.username === identity.username : ['15','16'].includes(value.userId)) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0) fail();
  return {...value}; // Identity/role/expiry authority remains the existing fresh refresh + /me flow.
}
export function validateWorktestCall(action, value, identity = null) {
  if (!['get','put','clear'].includes(action) || (action !== 'put' && value !== undefined)) fail();
  return action === 'put' ? validateWorktestSession(value,identity) : undefined;
}
