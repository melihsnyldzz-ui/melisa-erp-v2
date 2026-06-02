import React, { useEffect, useMemo, useState } from 'react';
import { fetchAuthAdminOverview, updateAuthAdminUser } from '../../services/authAdminApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

function boolLabel(value) {
  return value ? 'Evet' : 'Hayir';
}

function PermissionFlags({ permission }) {
  const flags = [
    permission.canView && 'gor',
    permission.canCreate && 'olustur',
    permission.canUpdate && 'duzenle',
    permission.canDelete && 'sil',
    permission.canApprove && 'onay',
  ].filter(Boolean);

  return <span className="status-pill">{flags.join(' / ') || '-'}</span>;
}

export function AuthAdminScreen() {
  const [data, setData] = useState({ users: [], roles: [], permissions: [], auditLogs: [] });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedUser = useMemo(
    () => data.users.find((user) => user.id === selectedUserId) || data.users[0] || null,
    [data.users, selectedUserId],
  );

  const visiblePermissions = useMemo(() => (
    selectedRoleCode
      ? data.permissions.filter((permission) => permission.roleCode === selectedRoleCode)
      : data.permissions
  ), [data.permissions, selectedRoleCode]);

  async function loadOverview() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchAuthAdminOverview();
      const nextData = response.data || { users: [], roles: [], permissions: [], auditLogs: [] };
      setData(nextData);
      setSelectedUserId((current) => nextData.users.some((user) => user.id === current) ? current : nextData.users[0]?.id ?? null);
      setSelectedRoleCode((current) => current || nextData.roles[0]?.code || '');
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
      setErrorMessage('Guncellenecek kullanici secin.');
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
      setMessage('Kullanici erisimi guncellendi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Kullanici guncellenemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function updateSelectedUser(key, value) {
    setData((current) => ({
      ...current,
      users: current.users.map((user) => (
        user.id === selectedUser?.id ? { ...user, [key]: value } : user
      )),
    }));
  }

  function exportUsers() {
    exportRowsToCsv({
      filename: 'kullanicilar-yetkiler',
      rows: data.users,
      columns: [
        { label: 'Kullanici', key: 'username' },
        { label: 'Ad', key: 'displayName' },
        { label: 'Rol', key: 'roleName' },
        { label: 'Aktif', value: (row) => boolLabel(row.isActive) },
        { label: 'Son Login', value: (row) => formatDate(row.lastLoginAt) },
      ],
    });
  }

  const activeUsers = data.users.filter((user) => user.isActive).length;
  const inactiveUsers = data.users.length - activeUsers;

  return (
    <main className="work-area dashboard-screen auth-admin-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Yetki ve Denetim</strong>
          <span>Kullanici, rol, izin matrisi ve son audit kayitlari</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportUsers}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Yetki ve Denetim')}>Yazdir</button>
          <button type="button" onClick={loadOverview}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yetki verisi API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi good"><span>Aktif kullanici</span><strong>{activeUsers}</strong><small>Login olabilen hesap</small></article>
        <article className="dashboard-kpi warn"><span>Pasif kullanici</span><strong>{inactiveUsers}</strong><small>Giris kapali hesap</small></article>
        <article className="dashboard-kpi info"><span>Rol sayisi</span><strong>{data.roles.length}</strong><small>Sistem ve operasyon rolleri</small></article>
        <article className="dashboard-kpi info"><span>Izin satiri</span><strong>{data.permissions.length}</strong><small>Role bagli yetki matrisi</small></article>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kullanicilar</strong>
            <span>Rol ve aktiflik duzenleme</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Kullanici</th>
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
            <strong>Kullanici Karti</strong>
            <span>Secili kullanici erisimi</span>
          </div>
          {selectedUser ? (
            <div className="filter-grid">
              <label>
                Kullanici
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
              <button type="button" className="primary-button" onClick={saveUserAccess} disabled={isSaving}>
                {isSaving ? 'Kaydediliyor' : 'Kullanici Yetkisini Kaydet'}
              </button>
            </div>
          ) : <div className="list-state">Kullanici secin.</div>}
        </section>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Roller</strong>
            <span>Rol bazli kullanici sayisi</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Kod</th>
                  <th>Kullanici</th>
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
            <strong>Izin Matrisi</strong>
            <span>{selectedRoleCode || 'Tum roller'} / {visiblePermissions.length} satir</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Izin</th>
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
          <span>Audit log / ilk 80 kayit</span>
        </div>
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanici</th>
                <th>Aksiyon</th>
                <th>Varlik</th>
                <th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.actorName}</td>
                  <td>{log.action}</td>
                  <td>{log.entityType} #{log.entityId || '-'}</td>
                  <td>{log.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
