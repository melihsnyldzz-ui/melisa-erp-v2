export function shouldRetryWithRenewedSession({ path, retryAuth }) {
  if (!retryAuth) {
    return false;
  }

  if (path === '/api/auth/me') {
    return true;
  }

  return !path.startsWith('/api/auth/');
}
