import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '../services/apiClient';
import { readFreshSaleImages, saleImageIdentity } from '../services/freshSaleImages';

export function useFreshSaleImages(lines, token, apiBase) {
  const key = JSON.stringify(lines.map(line => saleImageIdentity(line.product)));
  const context = `${token || ''}\n${apiBase || ''}\n${key}`;
  const [snapshot, setSnapshot] = useState({ context: '', images: {} });
  useEffect(() => {
    let alive = true, revision = 0, timer;
    const identities = JSON.parse(key);
    const clear = () => { revision++; clearTimeout(timer); setSnapshot({ context, images: {} }); };
    async function refresh() {
      clear();
      const current = revision;
      if (!alive || AppState.currentState !== 'active' || !token || !apiBase || !identities.length) return;
      const images = await readFreshSaleImages(identities, path => apiRequest(path, {
        token, timeoutMs: 5000, retryAuth: false,
      }), apiBase, () => alive && revision === current);
      if (!alive || revision !== current) return;
      setSnapshot({ context, images });
      // Revoke display before each refresh; suspend immediately in background.
      timer = setTimeout(refresh, 30000);
    }
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh(); else clear();
    });
    return () => { alive = false; revision++; clearTimeout(timer); subscription.remove(); };
  }, [context, key, token, apiBase]);
  return snapshot.context === context ? snapshot.images : {};
}
