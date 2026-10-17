import React, { useEffect, useMemo, useState } from 'react';
import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import {
  fetchMe,
  localPasswordlessAdminLogin,
  login as loginRequest,
  logout as logoutRequest,
} from './services/authApi.js';
import { apiConfig } from './config/apiConfig.js';
import { getStoredAccessToken, getStoredRefreshToken } from './services/apiClient.js';
import { clearWhatsappCrmUnlockToken } from './services/whatsappCrmApi.js';
import { vegaProductAccess } from './services/vegaProductAccess.js';

export function App() {
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [canRetrySession, setCanRetrySession] = useState(false);

  const permissions = useMemo(() => user?.permissions || [], [user]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (apiConfig.vegaBridgeMode && !getStoredAccessToken() && !getStoredRefreshToken()) {
        setIsBooting(false);
        return;
      }
      try {
        const response = await fetchMe();
        if (isMounted) {
          setUser(response.data);
          setCanRetrySession(false);
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
          if (error.status !== 401) {
            setAuthError(error.message || 'Bağlantı kurulamadı.');
            setCanRetrySession(Boolean(getStoredAccessToken() || getStoredRefreshToken()));
          }
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
  }, [sessionAttempt]);

  useEffect(() => {
    function expireSession() {
      clearWhatsappCrmUnlockToken();
      setUser(null);
      setCanRetrySession(false);
      setAuthError('Oturum süresi doldu, tekrar giriş yapın.');
    }

    window.addEventListener('melisa-auth-expired', expireSession);
    return () => window.removeEventListener('melisa-auth-expired', expireSession);
  }, []);

  async function handleLogin(username, password) {
    clearWhatsappCrmUnlockToken();
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const response = await loginRequest(username, password);
      setUser(response.data.user);
    } catch (error) {
      setAuthError(`${error.message || 'Giriş başarısız.'} (${error.code || 'AUTH_ERROR'})`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLocalPasswordlessLogin() {
    clearWhatsappCrmUnlockToken();
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const response = await localPasswordlessAdminLogin();
      setUser(response.data.user);
    } catch (error) {
      setAuthError(`${error.message || 'Şifresiz yerel giriş başarısız.'} (${error.code || 'AUTH_ERROR'})`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (apiConfig.vegaProductsMode) vegaProductAccess.logout().catch(() => {});
    try {
      await logoutRequest();
    } catch {
      setAuthError('Bu cihazdaki oturum kapatıldı. Sunucudaki oturumun kapanışı doğrulanamadı.');
    } finally {
      clearWhatsappCrmUnlockToken();
      setUser(null);
    }
  }

  if (isBooting) {
    return <div className="login-shell"><div className="login-panel">Oturum kontrol ediliyor...</div></div>;
  }

  if (!user) {
    return (
      <LoginScreen
        connectionLabel={apiConfig.vegaBridgeMode ? 'Vega · Gerçek veriler · Salt okunur' : undefined}
        onRetrySession={canRetrySession ? () => {
          setAuthError('');
          setIsBooting(true);
          setSessionAttempt(value => value + 1);
        } : undefined}
        errorMessage={authError}
        isLoading={isLoggingIn}
        localPasswordlessEnabled={apiConfig.localPasswordlessLogin}
        onLocalPasswordlessLogin={handleLocalPasswordlessLogin}
        onLogin={handleLogin}
      />
    );
  }

  return <AppShell user={user} permissions={permissions} isDemoMode={apiConfig.demoMode} onLogout={handleLogout} />;
}
