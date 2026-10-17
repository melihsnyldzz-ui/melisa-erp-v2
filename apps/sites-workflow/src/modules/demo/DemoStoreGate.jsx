import React, { useState, useSyncExternalStore } from 'react';
import { exportOperationsRaw, getOperations, getOperationsBackup, restoreOperationsBackup, subscribeOperations } from '../../demo/operationsStore.js';

export function DemoStoreGate({ children }) {
  useSyncExternalStore(subscribeOperations, () => { try { return getOperations().revision; } catch { return -1; } });
  const [recovered, setRecovered] = useState(0);
  const [failure, setFailure] = useState('');
  try {
    getOperations();
    if (recovered || failure) return <React.Fragment key={recovered}>{children}</React.Fragment>;
    return children;
  } catch (error) {
    let canRestore = false;
    try { canRestore = Boolean(getOperationsBackup()); } catch { /* The backup is invalid too. */ }
    const download = () => {
      try {
        const raw = exportOperationsRaw();
        if (!raw) throw Error('Dışa aktarılacak kayıt bulunamadı.');
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'melisa-demo-kayit-kurtarma.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (problem) { setFailure(problem.message); }
    };
    const restore = async () => {
      try { await restoreOperationsBackup(); setFailure(''); setRecovered(value => value + 1); }
      catch (problem) { setFailure(problem.message); }
    };
    return <main className="work-area"><section className="erp-panel" role="alert">
      <h1>Demo kaydı açılamadı</h1><p>{error.message}</p>
      <p>Kayıt otomatik sıfırlanmadı. Önce mevcut kaydı indirebilir, ardından önceki sağlam sürümü geri yükleyebilirsiniz.</p>
      <div className="op-actions"><button type="button" onClick={download}>Kaydı indir</button>
        {canRestore && <button type="button" onClick={restore}>Önceki sürümü geri yükle</button>}</div>
      {failure && <p role="alert">{failure}</p>}
    </section></main>;
  }
}
