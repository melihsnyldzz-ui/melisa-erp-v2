import React, { useEffect, useMemo, useState } from 'react';
import { fetchAuthAdminOverview, updateAuthAdminUser } from '../../services/authAdminApi.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function boolLabel(value) {
  return value ? 'Evet' : 'Hayir';
}

function PermissionFlags({ permission }) {
  const flags = [
    permission.canView && 'gor',
    permission.canCreate && 'olu?tur',
    permission.canUpdate && 'duzenle',
    permission.canDelete && 'sil',
    permission.canApprove && 'onay',
  ].filter(Boolean);

  return <span className="status-pill">{flags.join(' / ') || '-'}</span>;
}

const fullAccessRoleCodes = new Set(['admin', 'owner_manager', 'owner_partner']);

const criticalLocks = [
  {
    label: 'Satış fişi kesinleştirme',
    detail: 'Satış belgesini ticari kayıt haline getirir.',
    keys: [{ key: 'sales.finalize', flag: 'canApprove' }, { key: 'sales_invoices.manage', flag: 'canApprove' }],
  },
  {
    label: 'Satış fişi iptal',
    detail: 'Stok ve cari ters hareket üretir.',
    keys: [{ key: 'sales.cancel' }, { key: 'sales_invoices.manage', flag: 'canApprove' }],
  },
  {
    label: 'Alış fişi kesinleştirme',
    detail: 'Stok girişini ve tedarikçi borcunu oluşturur.',
    keys: [{ key: 'purchase.finalize', flag: 'canApprove' }, { key: 'purchase_invoices.manage', flag: 'canApprove' }],
  },
  {
    label: 'Alış fişi iptal',
    detail: 'Stok ve tedarikçi cari ters hareket üretir.',
    keys: [{ key: 'purchase.cancel' }, { key: 'purchase_invoices.manage', flag: 'canApprove' }],
  },
  {
    label: 'Stok kartı / fiyat güncelleme',
    detail: 'Ürün kartı, barkod, fiyat ve görsel günceller.',
    keys: [{ key: 'product.edit' }, { key: 'product.update', flag: 'canUpdate' }, { key: 'products.manage', flag: 'canUpdate' }],
  },
  {
    label: 'Stok pasife alma',
    detail: 'Ürünün aktif satış/alış seçimini kapatır.',
    keys: [{ key: 'product.passive' }, { key: 'product.passive', flag: 'canUpdate' }],
  },
  {
    label: 'Tahsilat girişi',
    detail: 'Müşteri bakiyesini düşüren finans hareketi yazar.',
    keys: [{ key: 'finance.collection' }, { key: 'collections.manage', flag: 'canCreate' }, { key: 'customer.update', flag: 'canUpdate' }],
  },
  {
    label: 'Tedarikçi ödeme girişi',
    detail: 'Tedarikçi borcunu düşüren finans hareketi yazar.',
    keys: [{ key: 'finance.payment' }, { key: 'payments.manage', flag: 'canCreate' }, { key: 'purchase.draft.write', flag: 'canUpdate' }],
  },
  {
    label: 'Excel/CSV import',
    detail: 'Toplu ürün, cari ve tedarikçi aktarımı yapar.',
    keys: [{ key: 'import.run' }],
  },
  {
    label: 'Sistem ayarları / temizlik',
    detail: 'Demo temizliği ve sistem ayarlarını değiştirir.',
    keys: [{ key: 'settings.manage' }],
  },
];

const userColumns = [
  { label: 'Kullanıcı', key: 'username' },
  { label: 'Ad', key: 'displayName' },
  { label: 'Rol', key: 'roleName' },
  { label: 'Aktif', value: (row) => boolLabel(row.isActive) },
  { label: 'Son Login', value: (row) => formatDate(row.lastLoginAt) },
];

const auditColumns = [
  { label: 'Tarih', value: (row) => formatDate(row.createdAt) },
  { label: 'Kullanıcı', key: 'actorName' },
  { label: 'Aksiyon', key: 'action' },
  { label: 'Varlik', value: (row) => `${row.entityType || '-'} #${row.entityId || '-'}` },
  { label: 'Kaynak', key: 'source' },
  { label: 'Sebep', key: 'reason' },
];

const permissionColumns = [
  { label: 'Rol', key: 'roleName' },
  { label: 'Kod', key: 'roleCode' },
  { label: '?zin', key: 'permissionKey' },
  { label: 'Gor', value: (row) => boolLabel(row.canView) },
  { label: 'Olustur', value: (row) => boolLabel(row.canCreate) },
  { label: 'Duzenle', value: (row) => boolLabel(row.canUpdate) },
  { label: 'Sil', value: (row) => boolLabel(row.canDelete) },
  { label: 'Onay', value: (row) => boolLabel(row.canApprove) },
];

function isPermissionEntryAllowed(permission, flag) {
  if (!permission) return false;
  if (!flag) return true;
  return Boolean(permission[flag]);
}

function canRoleDoAction(roleCode, permissions, lock) {
  if (fullAccessRoleCodes.has(String(roleCode || '').toLowerCase())) {
    return true;
  }

  return lock.keys.some(({ key, flag }) => (
    permissions.some((permission) => permission.permissionKey === key && isPermissionEntryAllowed(permission, flag))
  ));
}

export function AuthAdminScreen({ permissions = [] }) {
  const [data, setData] = useState({ users: [], roles: [], permissions: [], auditLogs: [] });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState('');
  const [auditFilters, setAuditFilters] = useState({ search: '', action: '', source: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const canManageUsers = permissions.includes('settings.manage');

  const selectedUser = useMemo(
    () => data.users.find((user) => user.id === selectedUserId) || data.users[0] || null,
    [data.users, selectedUserId],
  );

  const visiblePermissions = useMemo(() => (
    selectedRoleCode
       ? data.permissions.filter((permission) => permission.roleCode === selectedRoleCode)
      : data.permissions
  ), [data.permissions, selectedRoleCode]);

  const selectedRole = useMemo(
    () => data.roles.find((role) => role.code === selectedRoleCode) || data.roles[0] || null,
    [data.roles, selectedRoleCode],
  );

  const criticalLockRows = useMemo(() => (
    criticalLocks.map((lock) => ({
      ...lock,
      allowed: canRoleDoAction(selectedRole?.code, data.permissions.filter((permission) => permission.roleCode === selectedRole?.code), lock),
    }))
  ), [data.permissions, selectedRole]);

  const visibleAuditLogs = useMemo(() => data.auditLogs.filter((log) => {
    const search = auditFilters.search.trim().toLowerCase();
    const action = auditFilters.action.trim().toLowerCase();
    const source = auditFilters.source.trim().toLowerCase();
    const haystack = [
      log.actorName,
      log.action,
      log.entityType,
      log.entityId,
      log.source,
      log.reason,
      log.createdAt,
    ].join(' ').toLowerCase();

    return (!search || haystack.includes(search))
      && (!action || String(log.action || '').toLowerCase().includes(action))
      && (!source || String(log.source || '').toLowerCase().includes(source));
  }), [auditFilters, data.auditLogs]);

  const auditActionOptions = useMemo(() => (
    [...new Set(data.auditLogs.map((log) => log.action).filter(Boolean))].sort()
  ), [data.auditLogs]);

  const auditSourceOptions = useMemo(() => (
    [...new Set(data.auditLogs.map((log) => log.source).filter(Boolean))].sort()
  ), [data.auditLogs]);

  async function loadOverview() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchAuthAdminOverview();
      const nextData = response.data || { users: [], roles: [], permissions: [], auditLogs: [] };
      setData(nextData);
      setSelectedUserId((current) => nextData.users.some((user) => user.id === current) ? current : nextData.users[0]?.id ?? null);
      setSelectedRoleCode((current) => current || nextData.roles[0].code || '');
    } catch (error) {
      setData({ users: [], roles: [], permissions: [], auditLogs: [] });
      setErrorMessage(`${error.message || 'Yetki verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function saveUserAccess() {
    if (!selectedUser) {
      setErrorMessage('G?ncellenecek kullan?c? se?in.');
      return;
    }

    if (!canManageUsers) {
      setErrorMessage('Kullanıcı yetkisi güncellemek icin settings.manage yetkisi gerekir.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await updateAuthAdminUser(selectedUser.id, {
        roleId: selectedUser.roleId,
        isActive: selectedUser.isActive,
      });
      setData(response.data);
      setMessage('Kullanıcı eri?imi güncellendi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Kullanıcı güncellenemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function updateSelectedUser(key, value) {
    setData((current) => ({
      ...current,
      users: current.users.map((user) => (
        user.id === selectedUser.id ? { ...user, [key]: value } : user
      )),
    }));
  }

  function exportUsers() {
    exportRowsToCsv({ filename: 'kullanicilar-yetkiler', rows: data.users, columns: userColumns });
  }

  function exportUsersExcel() {
    exportRowsToExcel({ filename: 'kullanicilar-yetkiler', title: 'Kullanıcılar ve Yetkiler', rows: data.users, columns: userColumns });
  }

  function printUsers() {
    printRowsReport({ title: 'Yetki ve Denetim', subtitle: `${data.users.length} kullan?c?`, rows: data.users, columns: userColumns });
  }

  function exportAuditExcel() {
    exportRowsToExcel({
      filename: 'audit-log',
      title: 'Audit Log',
      rows: visibleAuditLogs,
      columns: auditColumns,
    });
  }

  function printAudit() {
    printRowsReport({
      title: 'Melisa ERP - Audit Log',
      subtitle: `${visibleAuditLogs.length} kayit / filtreli denetim`,
      rows: visibleAuditLogs,
      columns: auditColumns,
    });
  }

  function exportPermissionsExcel() {
    exportRowsToExcel({
      filename: `izin-matrisi-${selectedRoleCode || 'tum-roller'}`,
      title: 'Rol ?zin Matrisi',
      rows: visiblePermissions,
      columns: permissionColumns,
    });
  }

  function printPermissions() {
    printRowsReport({
      title: 'Melisa ERP - Rol ?zin Matrisi',
      subtitle: `${selectedRoleCode || 'Tum roller'} / ${visiblePermissions.length} izin`,
      rows: visiblePermissions,
      columns: permissionColumns,
    });
  }

  function updateAuditFilter(key, value) {
    setAuditFilters((current) => ({ ...current, [key]: value }));
  }

  function clearAuditFilters() {
    setAuditFilters({ search: '', action: '', source: '' });
  }

  const activeUsers = data.users.filter((user) => user.isActive).length;
  const inactiveUsers = data.users.length - activeUsers;

  return (
    <main className="work-area dashboard-screen auth-admin-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Yetki ve Denetim</strong>
          <span>Kullanıcı, rol, izin matrisi ve son audit kay?tlar?</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportUsers}>CSV</button>
          <button type="button" onClick={exportUsersExcel}>Excel</button>
          <button type="button" onClick={printUsers}>Yazd?r/PDF</button>
          <button type="button" onClick={loadOverview}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yetki verisi API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi good"><span>Aktif kullan?c?</span><strong>{activeUsers}</strong><small>Login olabilen hesap</small></article>
        <article className="dashboard-kpi warn"><span>Pasif kullan?c?</span><strong>{inactiveUsers}</strong><small>Giri? kapal? hesap</small></article>
        <article className="dashboard-kpi info"><span>Rol sayisi</span><strong>{data.roles.length}</strong><small>Sistem ve operasyon rolleri</small></article>
        <article className={canManageUsers ? 'dashboard-kpi good' : 'dashboard-kpi warn'}><span>Kullanıcı yönetimi</span><strong>{canManageUsers ? 'Açık' : 'Kilitli'}</strong><small>settings.manage gerekli</small></article>
      </section>

      <section className="erp-panel critical-locks-panel">
        <div className="panel-title">
          <strong>Kritik İşlem Kilitleri</strong>
          <span>{selectedRole?.name || selectedRoleCode || 'Rol'} için hızlı yetki özeti</span>
        </div>
        <div className="critical-lock-grid">
          {criticalLockRows.map((lock) => (
            <article className={lock.allowed ? 'critical-lock-card allowed' : 'critical-lock-card blocked'} key={lock.label}>
              <span>{lock.allowed ? '● İzinli' : '● Kapalı'}</span>
              <strong>{lock.label}</strong>
              <small>{lock.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kullanıcılar</strong>
            <span>Rol ve aktiflik duzenleme</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Ad</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Son Login</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className={user.id === selectedUser?.id ? 'selected-row' : ''} onClick={() => setSelectedUserId(user.id)}>
                    <td>{user.username}</td>
                    <td>{user.displayName}</td>
                    <td>{user.roleName}</td>
                    <td><span className={`status-pill ${user.isActive ? 'status-finalized' : 'status-cancelled'}`}>{user.isActive ? 'Aktif' : 'Pasif'}</span></td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kullanıcı Kart?</strong>
            <span>Seçili kullanıcı erişimi</span>
          </div>
          {selectedUser ? (
            <div className="filter-grid">
              <label>
                Kullanıcı
                <input value={selectedUser.username} disabled />
              </label>
              <label>
                Ad
                <input value={selectedUser.displayName} disabled />
              </label>
              <label>
                Rol
                <select value={selectedUser.roleId} onChange={(event) => updateSelectedUser('roleId', Number(event.target.value))}>
                  {data.roles.filter((role) => role.isActive).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Aktif
                <select value={selectedUser.isActive ? '1' : '0'} onChange={(event) => updateSelectedUser('isActive', event.target.value === '1')}>
                  <option value="1">Aktif</option>
                  <option value="0">Pasif</option>
                </select>
              </label>
              {!canManageUsers && <div className="list-state">Bu ekranda izleme acik; kullan?c? rol/aktiflik degistirmek icin settings.manage gerekir.</div>}
              <button type="button" className="primary-button" onClick={saveUserAccess} disabled={isSaving || !canManageUsers}>
                {isSaving ? 'Kaydediliyor' : 'Kullanıcı Yetkisini Kaydet'}
              </button>
            </div>
          ) : <div className="list-state">Kullanıcı se?in.</div>}
        </section>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Roller</strong>
            <span>Rol bazli kullan?c? sayisi</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Kod</th>
                  <th>Kullanıcı</th>
                  <th>Sistem</th>
                </tr>
              </thead>
              <tbody>
                {data.roles.map((role) => (
                  <tr key={role.id} className={role.code === selectedRoleCode ? 'selected-row' : ''} onClick={() => setSelectedRoleCode(role.code)}>
                    <td>{role.name}</td>
                    <td>{role.code}</td>
                    <td>{role.userCount}</td>
                    <td>{boolLabel(role.isSystemRole)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>?zin Matrisi</strong>
            <span>{selectedRoleCode || 'Tum roller'} / {visiblePermissions.length} sat?r</span>
          </div>
          <div className="toolbar-row">
            <button type="button" onClick={exportPermissionsExcel}>?zin Excel</button>
            <button type="button" onClick={printPermissions}>?zin Yazd?r/PDF</button>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>?zin</th>
                  <th>Yetkiler</th>
                </tr>
              </thead>
              <tbody>
                {visiblePermissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>{permission.roleName}</td>
                    <td>{permission.permissionKey}</td>
                    <td><PermissionFlags permission={permission} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Son Denetim Kayitlari</strong>
          <span>Audit log / {visibleAuditLogs.length} filtreli kayit / toplam {data.auditLogs.length}</span>
        </div>
        <div className="filter-grid">
          <label>
            Audit ara
            <input value={auditFilters.search} onChange={(event) => updateAuditFilter('search', event.target.value)} placeholder="Kullanıcı, aksiyon, varl?k, sebep" />
          </label>
          <label>
            Aksiyon
            <select value={auditFilters.action} onChange={(event) => updateAuditFilter('action', event.target.value)}>
              <option value="">Tum aksiyonlar</option>
              {auditActionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
          <label>
            Kaynak
            <select value={auditFilters.source} onChange={(event) => updateAuditFilter('source', event.target.value)}>
              <option value="">Tum kaynaklar</option>
              {auditSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearAuditFilters}>Temizle</button>
          <button type="button" onClick={exportAuditExcel}>Audit Excel</button>
          <button type="button" onClick={printAudit}>Audit Yazd?r/PDF</button>
        </div>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Aksiyon</th>
                <th>Varlik</th>
                <th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {visibleAuditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.actorName}</td>
                  <td>{log.action}</td>
                  <td>{log.entityType} #{log.entityId || '-'}</td>
                  <td>{log.source}</td>
                </tr>
              ))}
              {visibleAuditLogs.length === 0 && (
                <tr>
                  <td colSpan="5">Filtreye uygun audit kaydi yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
