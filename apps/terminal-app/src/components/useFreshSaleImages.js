import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '../services/apiClient';
import { readFreshSaleImages, saleImageIdentity, SALE_IMAGE_MAX_AGE_MS } from '../services/freshSaleImages';

export function useFreshSaleImages(lines, token, apiBase) {
  const key = JSON.stringify(lines.map(line => saleImageIdentity(line.product)));
  const context = `${token || ''}\n${apiBase || ''}\n${key}`;
  const [snapshot, setSnapshot] = useState({ context: '', images: {} });
  useEffect(() => {
    let alive = true, revision = 0, timer;
    const expiryTimers = new Map();
    const identities = JSON.parse(key);
    const cancel = () => {
      revision++; clearTimeout(timer);
      expiryTimers.forEach(clearTimeout); expiryTimers.clear();
    };
    const clear = () => { cancel(); setSnapshot({ context, images: {} }); };
    async function refresh() {
      clear();
      const current = revision;
      if (!alive || AppState.currentState !== 'active' || !token || !apiBase || !identities.length) return;
      const startedAt = performance.now();
      const isCurrent = () => alive && revision === current;
      await readFreshSaleImages(identities, path => apiRequest(path, {
        token, timeoutMs: 5000, retryAuth: false,
      }), apiBase, isCurrent, { onImage(id, uri, expiresAt) {
        const remaining = expiresAt - performance.now();
        if (!isCurrent() || remaining <= 0) return;
        clearTimeout(expiryTimers.get(id));
        setSnapshot(previous => ({ context, images: { ...previous.images, [id]: uri } }));
        expiryTimers.set(id, setTimeout(() => {
          expiryTimers.delete(id);
          if (!isCurrent()) return;
          setSnapshot(previous => {
            const images = { ...previous.images }; delete images[id];
            return { context, images };
          });
        }, remaining));
      } });
      if (!isCurrent()) return;
      // A slow batch must not extend an early photo's approval or spin retries.
      timer = setTimeout(refresh, Math.max(1000, SALE_IMAGE_MAX_AGE_MS - (performance.now() - startedAt)));
    }
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh(); else clear();
    });
    return () => { alive = false; cancel(); subscription.remove(); };
  }, [context, key, token, apiBase]);
  return snapshot.context === context ? snapshot.images : {};
}
