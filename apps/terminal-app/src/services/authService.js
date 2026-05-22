import { apiRequest } from './apiClient';
import { getStoredValue, removeStoredValue, setStoredValue } from './sessionStorage';

const storageKeys = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'sessionUser',
};

export async function persistSession(session) {
  await Promise.all([
    setStoredValue(storageKeys.accessToken, session.accessToken),
    setStoredValue(storageKeys.refreshToken, session.refreshToken),
    setStoredValue(storageKeys.user, JSON.stringify(session.user || {})),
  ]);
}

export async function clearSession() {
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

  if (!accessToken || !refreshToken) {
    return null;
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
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      username,
      password,
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

export async function logout(refreshToken) {
  if (!refreshToken) {
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
