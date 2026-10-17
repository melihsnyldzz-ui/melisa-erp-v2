// An independent, read-only session: demo credentials never enter this client.
export function createVegaProductClient({ baseUrl, storage, allowLocalTest = false, allowAccounts = false, allowOperations = false, fetchImpl = fetch, onExpired = () => {}, locks = globalThis.navigator?.locks }) {
  const origin = new URL(baseUrl);
  const localTest = allowLocalTest && origin.origin === 'http://127.0.0.1:4144';
  if ((!localTest && origin.protocol !== 'https:') || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Geçersiz Vega bağlantı adresi.');
  const accessKey = 'melisaVegaProductsAccessToken';
  const refreshKey = 'melisaVegaProductsRefreshToken';
  let renewal = null;
  let generation = 0;
  const read = key => storage?.getItem(key);
  const error = (message, code, status) => Object.assign(new Error(message), { code, status });
  function clearSession() {
    generation++;
    storage?.removeItem(accessKey);
    storage?.removeItem(refreshKey);
  }
  function storeTokens(data) {
    if (typeof data?.accessToken !== 'string' || !data.accessToken.trim()) throw error('ERP oturum yanıtı doğrulanamadı.', 'VEGA_AUTH_INVALID');
    storage.setItem(accessKey, data.accessToken);
    if (data.refreshToken) storage.setItem(refreshKey, data.refreshToken);
  }
  async function raw(method, path, { params = {}, body, signal, accessToken = read(accessKey) } = {}) {
    const allowedRead = method === 'GET' && (/^\/api\/vega-read\/products(?:\/search|\/barcode\/[^/?#]+|\/[1-9]\d*)?$/.test(path) || (allowAccounts && /^\/api\/vega-read\/accounts(?:\/[1-9]\d*)?$/.test(path)) || (allowOperations && /^\/api\/vega-read\/(documents|accounts\/[1-9]\d*\/(ledger|balance)|products\/[1-9]\d*\/costs)$/.test(path)) || ['/health', '/api/auth/me'].includes(path));
    const allowedAuth = method === 'POST' && ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].includes(path);
    if (!allowedRead && !allowedAuth) throw error('Bu bağlantıda yalnız izinli okuma işlemleri yapılabilir.', 'VEGA_READ_ONLY');
    const url = new URL(path, origin);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const deadline = AbortSignal.timeout(60000);
    let response, payload;
    try {
      response = await fetchImpl(url, { method, headers, credentials: 'omit', redirect: 'error', signal: signal ? AbortSignal.any([signal, deadline]) : deadline, body: body ? JSON.stringify(body) : undefined });
      payload = await response.json().catch(cause => {
        if (cause.name === 'AbortError' || cause.name === 'TimeoutError') throw cause;
        throw error(response.status === 530 ? 'Şirket bağlantısı kapalı. Mevcut bağlantı servisi kontrol edilmeli.' : 'Bağlantı servisi beklenen yanıtı vermedi. Erişim kuralı veya tünel kontrol edilmeli.', 'VEGA_GATEWAY_ERROR', response.status);
      });
    } catch (cause) {
      if (cause.name === 'AbortError') throw cause;
      if (cause.name === 'TimeoutError') throw error('Vega yanıtı gecikti. Tekrar deneyin.', 'VEGA_TIMEOUT');
      if (cause.code) throw cause;
      throw error('Vega bağlantısına ulaşılamadı. Şirket bağlantısı veya erişim izni kontrol edilmeli.', 'VEGA_NETWORK_ERROR');
    }
    if (!response.ok || payload?.success !== true) throw error(payload?.error?.message || 'Vega isteği başarısız oldu.', payload?.error?.code || 'VEGA_API_ERROR', response.status);
    return payload;
  }
  async function renew(rejectedToken) {
    if (!read(refreshKey)) return false;
    if (!renewal) {
      const currentGeneration = generation;
      const run = async () => {
        // Another tab may already have rotated the same refresh token.
        if (generation !== currentGeneration) return false;
        if (read(accessKey) && read(accessKey) !== rejectedToken) return true;
        if (!read(refreshKey)) return false;
        const result = await raw('POST', '/api/auth/refresh', { body: { refreshToken: read(refreshKey) } });
        if (generation !== currentGeneration) return false;
        storeTokens(result.data);
        return true;
      };
      renewal = (locks ? locks.request('melisa-vega-products-refresh', run) : run()).catch(cause => {
        if (cause.status === 401) return false;
        throw cause; // An outage must not erase a valid saved session.
      }).finally(() => { renewal = null; });
    }
    return renewal;
  }
  async function get(path, params = {}, options = {}) {
    const currentGeneration = generation;
    const rejectedToken = read(accessKey);
    try { return await raw('GET', path, { ...options, params }); }
    catch (cause) {
      if (cause.status !== 401 || generation !== currentGeneration) throw cause;
      if (await renew(rejectedToken)) {
        try { return await raw('GET', path, { ...options, params }); }
        catch (retryError) { if (retryError.status !== 401) throw retryError; }
      }
      if (generation === currentGeneration) { clearSession(); onExpired(); }
      throw error('ERP oturumunuz sona erdi. Yeniden giriş yapın.', 'VEGA_AUTH_EXPIRED', 401);
    }
  }
  return {
    get, clearSession,
    hasSession: () => Boolean(read(accessKey) || read(refreshKey)),
    async login(username, password) {
      clearSession();
      const currentGeneration = generation;
      const result = await raw('POST', '/api/auth/login', { body: { username, password }, accessToken: null });
      if (currentGeneration !== generation) throw error('Giriş işlemi iptal edildi.', 'VEGA_LOGIN_CANCELLED');
      storeTokens(result.data);
      return get('/api/auth/me');
    },
    logout() {
      const accessToken = read(accessKey), refreshToken = read(refreshKey);
      clearSession();
      return accessToken || refreshToken ? raw('POST', '/api/auth/logout', { body: { refreshToken }, accessToken }) : Promise.resolve();
    },
  };
}
