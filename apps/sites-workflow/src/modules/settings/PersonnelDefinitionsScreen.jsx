import React, { useEffect, useMemo, useState } from 'react';
import {canManageCleanRecord,availablePersonnelAccounts,personnelLoginFields} from './personnelManagementModel.mjs';
import {
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import {
  createPersonnelEmployee,
  fetchPersonnelOverview,
  updatePersonnelEmployee,
} from '../../services/personnelApi.js';
import { resetAuthAdminUserPassword } from '../../services/authAdminApi.js';
import { normalizeSearchText } from '../../utils/searchText.js';

const JOB_TITLES = ['Yönetici', 'Satış Temsilcisi', 'Kasiyer', 'Depo Personeli', 'Muhasebe'];

function suggestedEmployeeCode(employees = []) {
  const highest = employees.reduce((max, employee) => {
    const match = String(employee.employeeCode || '').match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PRS-${String(highest + 1).padStart(4, '0')}`;
}

function emptyForm(employeeCode = '') {
  return {
    employeeCode,
    fullName: '',
    phone: '',
    department: '',
    jobTitle: '',
    userId: '',
    loginUsername: '',
    loginPassword: '',
    canTerminalSale: true,
    canChangeSalePrice: false,
    maxSaleDiscountPercent: 0,
    isActive: true,
  };
}

function toForm(employee) {
  return {
    employeeCode: employee?.employeeCode || '',
    fullName: employee?.fullName || '',
    phone: employee?.phone || '',
    department: employee?.department || '',
    jobTitle: employee?.jobTitle || '',
    userId: employee?.userId ? String(employee.userId) : '',
    loginUsername: employee?.username || '',
    loginPassword: '',
    canTerminalSale: employee?.canTerminalSale !== false,
    canChangeSalePrice: Boolean(employee?.canChangeSalePrice),
    maxSaleDiscountPercent: Number(employee?.maxSaleDiscountPercent || 0),
    isActive: employee?.isActive !== false,
  };
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}

export function PersonnelDefinitionsScreen() {
  const [overview, setOverview] = useState({ employees: [], users: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');

  const selectedEmployee = useMemo(
    () => overview.employees.find((employee) => employee.id === selectedId) || null,
    [overview.employees, selectedId],
  );

  const filteredEmployees = useMemo(() => {
    const term = normalizeSearchText(search);
    return overview.employees.filter((employee) => {
      if (statusFilter === 'ACTIVE' && !employee.isActive) return false;
      if (statusFilter === 'PASSIVE' && employee.isActive) return false;
      if (!term) return true;
      return normalizeSearchText([
        employee.employeeCode,
        employee.fullName,
        employee.username,
        employee.phone,
        employee.department,
        employee.jobTitle,
      ].join(' ')).includes(term);
    });
  }, [overview.employees, search, statusFilter]);

  const manageable=canManageCleanRecord(overview.cleanPersonnel,'employee',selectedId);
  const linkableUsers=availablePersonnelAccounts(overview,selectedId);
  const existingOnly=overview.cleanPersonnel?.existingAccountRequired===true;

  const activeCount = overview.employees.filter((employee) => employee.isActive).length;
  const terminalReadyCount = overview.employees.filter(
    (employee) => employee.isActive && employee.userId && employee.username,
  ).length;

  function clearNotices() {
    setMessage('');
    setErrorMessage('');
  }

  function applyOverview(data, preferredId = selectedId) {
    const next = data || { employees: [], users: [] };
    setOverview(next);
    const nextSelected = next.employees.find((employee) => employee.id === preferredId) || null;
    if (nextSelected) {
      setSelectedId(nextSelected.id);
      setForm(toForm(nextSelected));
    } else {
      setSelectedId(null);
      setForm(emptyForm(suggestedEmployeeCode(next.employees)));
    }
  }

  async function loadOverview() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchPersonnelOverview();
      applyOverview(response.data);
    } catch (error) {
      setErrorMessage(`${error.message || 'Personel bilgileri okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  function selectEmployee(employee) {
    setSelectedId(employee.id);
    setForm(toForm(employee));
    setPasswordOpen(false);
    setNewPassword('');
    setPasswordRepeat('');
    clearNotices();
  }

  function startNewEmployee() {
    setSelectedId(null);
    setForm(emptyForm(suggestedEmployeeCode(overview.employees)));
    setPasswordOpen(false);
    setNewPassword('');
    setPasswordRepeat('');
    clearNotices();
  }

  async function saveEmployee() {
    if(!manageable){setErrorMessage('Bu kayıt bu personel yönetimi kapsamında değiştirilemez.');return;}
    if(existingOnly&&!form.userId){setErrorMessage('Kullanıcı Yönetimi ekranında açtığınız kişisel hesabı seçin.');return;}
    if (!form.employeeCode.trim() || !form.fullName.trim()) {
      setErrorMessage('Personel kodu ve ad soyad zorunludur.');
      return;
    }
    if (!selectedId && !form.userId && !form.loginUsername.trim()) {
      setErrorMessage('Terminal girişinde kullanılacak kullanıcı adını yazın.');
      return;
    }
    if (!selectedId && !form.userId && form.loginPassword.length < 8) {
      setErrorMessage('İlk şifre en az 8 karakter olmalıdır.');
      return;
    }

    setIsSaving(true);
    clearNotices();
    try {
      const payload = {
        employeeCode: form.employeeCode.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        department: form.department.trim(),
        jobTitle: form.jobTitle.trim(),
        ...personnelLoginFields({...form,selectedId}),
        canTerminalSale: Boolean(form.canTerminalSale),
        canChangeSalePrice: Boolean(form.canChangeSalePrice),
        maxSaleDiscountPercent: Number(form.maxSaleDiscountPercent || 0),
        isActive: Boolean(form.isActive),
      };
      const response = selectedId
        ? await updatePersonnelEmployee(selectedId, payload)
        : await createPersonnelEmployee(payload);
      const savedEmployee = response.data.employees.find(
        (employee) => employee.employeeCode === payload.employeeCode,
      );
      applyOverview(response.data, savedEmployee?.id || selectedId);
      setMessage(selectedId
        ? 'Personel bilgileri güncellendi.'
        : 'Personel oluşturuldu ve terminal giriş listesine eklendi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Personel kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function changePassword() {
    if(!manageable){setErrorMessage('Bu mevcut hesap bu adımda değiştirilemez.');return;}
    if (!selectedEmployee?.userId) {
      setErrorMessage('Bu personele bağlı bir giriş hesabı bulunmuyor.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== passwordRepeat) {
      setErrorMessage('Yeni şifreler birbiriyle aynı değil.');
      return;
    }

    setPasswordSaving(true);
    clearNotices();
    try {
      await resetAuthAdminUserPassword(selectedEmployee.userId, newPassword);
      setNewPassword('');
      setPasswordRepeat('');
      setPasswordOpen(false);
      setMessage(`${selectedEmployee.fullName} için şifre değiştirildi. Açık terminal oturumları kapatıldı.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Şifre değiştirilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <main className="work-area dashboard-screen personnel-definitions-screen">
      <section className="personnel-hero">
        <div className="personnel-hero-copy">
          <span className="personnel-hero-icon"><Users size={22} /></span>
          <div>
            <strong>Personel Yönetimi</strong>
            <span>Personel oluşturun, bilgilerini ve terminal giriş şifresini yönetin.</span>
          </div>
        </div>
        <div className="personnel-hero-actions">
          <button type="button" onClick={loadOverview} disabled={isLoading}>
            <RefreshCw size={15} /> Yenile
          </button>
          <button type="button" className="primary" onClick={startNewEmployee}>
            <Plus size={16} /> Yeni Personel
          </button>
        </div>
      </section>

      <section className="personnel-summary-grid">
        <article><span>Toplam personel</span><strong>{overview.employees.length}</strong><Users size={18} /></article>
        <article><span>Aktif personel</span><strong>{activeCount}</strong><CheckCircle2 size={18} /></article>
        <article><span>Terminalde görünen</span><strong>{terminalReadyCount}</strong><ShieldCheck size={18} /></article>
      </section>

      <div className="personnel-boundary-note">
        <ShieldCheck size={16} />
        <span>Aktif kaydedilen her personel otomatik olarak terminal giriş listesinde görünür. Terminal cihazı seçmeniz veya atama yapmanız gerekmez.</span>
      </div>
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="personnel-workspace">
        <div className="erp-panel personnel-list-panel">
          <div className="personnel-panel-heading">
            <div><strong>Personeller</strong><span>{filteredEmployees.length} kayıt gösteriliyor</span></div>
          </div>
          <div className="personnel-filter-row">
            <label className="personnel-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, kod, kullanıcı adı veya görev ara"
                aria-label="Personel ara"
              />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ACTIVE">Aktif personeller</option>
              <option value="PASSIVE">Pasif personeller</option>
              <option value="ALL">Tüm personeller</option>
            </select>
          </div>
          {isLoading ? (
            <div className="list-state">Personel bilgileri yükleniyor...</div>
          ) : (
            <div className="personnel-card-list">
              {filteredEmployees.map((employee) => (
                <button
                  type="button"
                  key={employee.id}
                  className={`personnel-list-card ${selectedId === employee.id ? 'selected' : ''}`}
                  onClick={() => selectEmployee(employee)}
                >
                  <span className="personnel-avatar">{initials(employee.fullName)}</span>
                  <span className="personnel-list-main">
                    <strong>{employee.fullName}</strong>
                    <small>{employee.jobTitle || employee.department || 'Görev belirtilmedi'}</small>
                  </span>
                  <span className="personnel-list-account">
                    <small>{employee.employeeCode}</small>
                    <strong>{employee.username ? `@${employee.username}` : 'Giriş hesabı yok'}</strong>
                  </span>
                  <span className={`status-pill ${employee.isActive ? 'success' : 'passive'}`}>
                    {employee.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </button>
              ))}
              {!filteredEmployees.length && <div className="list-state">Filtreye uygun personel bulunamadı.</div>}
            </div>
          )}
        </div>

        <div className="erp-panel personnel-form-panel">
          <div className="personnel-panel-heading personnel-form-heading">
            <div>
              <strong>{selectedEmployee ? 'Personel Kartı' : 'Yeni Personel'}</strong>
              <span>{selectedEmployee ? `${selectedEmployee.fullName} bilgilerini düzenleyin` : 'Yeni personelin temel ve giriş bilgilerini yazın'}</span>
            </div>
            <span className="personnel-form-avatar"><UserRound size={20} /></span>
          </div>

          <div className="personnel-form-section">
            <div className="personnel-section-title"><span>1</span><div><strong>Temel bilgiler</strong><small>Personelin kimlik ve görev bilgileri</small></div></div>
            <div className="personnel-form-grid">
              <label><span>Personel kodu *</span><input value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} /></label>
              <label><span>Ad soyad *</span><input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} autoFocus={!selectedId} /></label>
              <label><span>Telefon</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="05xx xxx xx xx" /></label>
              <label><span>Departman</span><input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} placeholder="Örn. Satış" /></label>
              <label className="personnel-wide-field">
                <span>Görev</span>
                <input list="personnel-job-titles" value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} placeholder="Görev seçin veya yazın" />
                <datalist id="personnel-job-titles">{JOB_TITLES.map((title) => <option key={title} value={title} />)}</datalist>
              </label>
            </div>
          </div>

          {overview.cleanPersonnel&&!overview.cleanPersonnel.ready&&<p role="status">Kişisel hesap yönetimi henüz kurulmadı. Mevcut kayıtlar görüntülenebilir.</p>}
          {selectedId&&!manageable&&<p role="status">Mevcut örnek personel korunur. Yeni kişi için ayrı bir hesap ve personel kartı oluşturun.</p>}
          <div className="personnel-form-section personnel-account-section">
            <div className="personnel-section-title"><span>2</span><div><strong>Terminal giriş hesabı</strong><small>Personel terminalde bu hesapla oturum açar</small></div></div>
            {!selectedId&&<label><span>Mevcut kişisel hesap</span>
              <select value={form.userId} onChange={event=>{const user=linkableUsers.find(u=>String(u.id)===event.target.value);setForm(current=>({...current,userId:event.target.value,loginUsername:user?.username||'',loginPassword:''}));}}>
                <option value="">{existingOnly?'Kişisel hesabı seçin':'Yeni hesap oluştur veya mevcut hesabı seç'}</option>
                {linkableUsers.map(user=><option key={user.id} value={user.id}>{user.displayName} (@{user.username}) — {user.roleName}</option>)}
              </select>
              {existingOnly&&<small>Önce Kullanıcı Yönetimi ekranında hesabı ve görev rolünü oluşturun. Örnek hesaplar başka personele atanmaz.</small>}
            </label>}
            <div className="personnel-form-grid">
              <label>
                <span>Kullanıcı adı *</span>
                <input
                  value={form.loginUsername}
                  disabled={Boolean(selectedId)||Boolean(form.userId)||existingOnly}
                  onChange={(event) => setForm((current) => ({ ...current, loginUsername: event.target.value }))}
                  placeholder="Örn. ahmet"
                  autoComplete="off"
                />
              </label>
              {!selectedId&&!form.userId&&!existingOnly ? (
                <label>
                  <span>İlk şifre *</span>
                  <input
                    type="password"
                    value={form.loginPassword}
                    onChange={(event) => setForm((current) => ({ ...current, loginPassword: event.target.value }))}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <div className="personnel-password-action">
                  <span>Şifre</span>
                  <button type="button" onClick={() => setPasswordOpen((current) => !current)} disabled={!selectedEmployee?.userId||!manageable}>
                    <KeyRound size={15} /> {passwordOpen ? 'Şifre Alanını Kapat' : 'Şifre Değiştir'}
                  </button>
                </div>
              )}
            </div>

            {selectedId && passwordOpen && (
              <div className="personnel-password-panel">
                <div><KeyRound size={18} /><span><strong>Yeni şifre belirleyin</strong><small>Değişiklikten sonra açık terminal oturumları güvenlik için kapatılır.</small></span></div>
                <label><span>Yeni şifre</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="En az 8 karakter" autoComplete="new-password" /></label>
                <label><span>Yeni şifre tekrar</span><input type="password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} placeholder="Şifreyi tekrar yazın" autoComplete="new-password" /></label>
                <button type="button" className="primary" onClick={changePassword} disabled={passwordSaving||!manageable}>
                  <KeyRound size={15} /> {passwordSaving ? 'Değiştiriliyor...' : 'Yeni Şifreyi Kaydet'}
                </button>
              </div>
            )}

            <label className="personnel-active-toggle">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
              <span><strong>Personel aktif</strong><small>Aktif personel terminal giriş listesinde görünür.</small></span>
            </label>
          </div>

          <div className="personnel-form-footer">
            <span>{selectedEmployee ? 'Değişiklikleri kaydetmeyi unutmayın.' : form.userId?'Seçilen hesap bu personelle eşleştirilir.':'Kaydedildiğinde terminal hesabı otomatik oluşturulur.'}</span>
            <button type="button" className="primary" onClick={saveEmployee} disabled={isSaving||!manageable}>
              <Save size={16} /> {isSaving ? 'Kaydediliyor...' : selectedEmployee ? 'Değişiklikleri Kaydet' : 'Personeli Oluştur'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
