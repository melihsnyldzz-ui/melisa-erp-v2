import React, { useEffect, useMemo, useState } from 'react';
import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { clearAuthTokens, getStoredAccessToken } from './services/apiClient.js';
import { fetchMe, login as loginRequest, logout as logoutRequest, refreshSession } from './services/authApi.js';

export function App() {
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const permissions = useMemo(() => user?.permissions || [], [user]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (!getStoredAccessToken()) {
        setIsBooting(false);
        return;
      }

      try {
        const response = await fetchMe();
        if (isMounted) {
          setUser(response.data);
        }
      } catch (error) {
        try {
          const refreshed = await refreshSession();
          if (isMounted) {
            setUser(refreshed.data.user);
          }
        } catch (refreshError) {
          clearAuthTokens();
        }
      } finally {
        if (isMounted) {
          setIsBooting(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function expireSession() {
      clearAuthTokens();
      setUser(null);
      setAuthError('Session suresi doldu veya token gecersiz. Tekrar giris yapin.');
    }

    window.addEventListener('melisa-auth-expired', expireSession);
    return () => window.removeEventListener('melisa-auth-expired', expireSession);
  }, []);

  async function handleLogin(username, password) {
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const response = await loginRequest(username, password);
      setUser(response.data.user);
    } catch (error) {
      setAuthError(`${error.message || 'Giris basarisiz.'} (${error.code || 'AUTH_ERROR'})`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await logoutRequest();
    setUser(null);
  }

  if (isBooting) {
    return <div className="login-shell"><div className="login-panel">Session kontrol ediliyor...</div></div>;
  }

  if (!user) {
    return <LoginScreen errorMessage={authError} isLoading={isLoggingIn} onLogin={handleLogin} />;
  }

  return <AppShell user={user} permissions={permissions} onLogout={handleLogout} />;
}
