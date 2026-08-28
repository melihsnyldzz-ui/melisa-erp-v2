import { apiRequest, clearApiAccessToken, setApiAccessToken } from './apiClient';
import { terminalConfig } from '../config/env';
import { getStoredValue, removeStoredValue, setStoredValue } from './sessionStorage';

const storageKeys = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'sessionUser',
};

export const OPEN_ADMIN_TOKEN = 'open-admin';
const LOCAL_PASSWORDLESS_REFRESH_TOKEN = 'local-passwordless-admin';

function isJwtExpired(accessToken) {
  if (!accessToken || accessToken === OPEN_ADMIN_TOKEN) return true;

  try {
    const [, payloadPart] = String(accessToken).split('.');
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(globalThis.atob(normalized));
    if (!json.exp) return false;
    return Number(json.exp) * 1000 <= Date.now() + 30000;
  } catch {
    return false;
  }
}

export async function renewStoredSession() {
  const refreshToken = await getStoredValue(storageKeys.refreshToken);

  if (!refreshToken || refreshToken === LOCAL_PASSWORDLESS_REFRESH_TOKEN) {
    await clearSession();
    throw new Error('Terminal oturumu yeniden acilmalidir');
  }

  const response = await apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
  const session = {
    accessToken: response.data.accessToken,
    refreshToken,
    user: response.data.user,
  };
  await persistSession(session);
  return session;
}

export async function persistSession(session) {
  setApiAccessToken(session.accessToken);
  await Promise.all([
    setStoredValue(storageKeys.accessToken, session.accessToken),
    session.refreshToken
      ? setStoredValue(storageKeys.refreshToken, session.refreshToken)
      : removeStoredValue(storageKeys.refreshToken),
    setStoredValue(storageKeys.user, JSON.stringify(session.user || {})),
  ]);
}

export async function clearSession() {
  clearApiAccessToken();
  await Promise.all([
    removeStoredValue(storageKeys.accessToken),
    removeStoredValue(storageKeys.refreshToken),
    removeStoredValue(storageKeys.user),
  ]);
}

export async function getStoredSession() {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    getStoredValue(storageKeys.accessToken),
    getStoredValue(storageKeys.refreshToken),
    getStoredValue(storageKeys.user),
  ]);

  if (!accessToken) {
    return null;
  }

  if (accessToken === OPEN_ADMIN_TOKEN || refreshToken === LOCAL_PASSWORDLESS_REFRESH_TOKEN) {
    await clearSession();
    return null;
  }

  if (isJwtExpired(accessToken)) {
    try {
      return await renewStoredSession();
    } catch {
      await clearSession();
      return null;
    }
  }

  try {
    return {
      accessToken,
      refreshToken,
      user: userJson ? JSON.parse(userJson) : null,
    };
  } catch {
    await clearSession();
    return null;
  }
}

export async function login({ username, password }) {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername || !password) {
    const error = new Error('Kullanici ve sifre zorunludur');
    error.code = 'AUTH_CREDENTIALS_REQUIRED';
    throw error;
  }

  const response = await apiRequest('/auth/terminal-login', {
    method: 'POST',
    body: {
      username: normalizedUsername,
      password,
      terminalCode: terminalConfig.terminalCode,
    },
  });

  const session = {
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    user: response.data.user,
  };

  await persistSession(session);
  return session;
}

export async function listTerminalUsers() {
  const terminalCode = encodeURIComponent(terminalConfig.terminalCode);
  const response = await apiRequest(`/auth/terminal-users?terminalCode=${terminalCode}`);
  return {
    device: response.data.device,
    users: Array.isArray(response.data.users) ? response.data.users : [],
  };
}

export async function logout(refreshToken) {
  if (!refreshToken || refreshToken === LOCAL_PASSWORDLESS_REFRESH_TOKEN) {
    return;
  }

  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: {
        refreshToken,
      },
    });
  } catch {
    // Local logout must still clear the terminal session.
  }
}
