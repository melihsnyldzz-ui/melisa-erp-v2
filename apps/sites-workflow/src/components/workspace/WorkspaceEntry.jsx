import React, { Suspense, lazy } from 'react';
import { apiConfig } from '../../config/apiConfig.js';

// The local API and Vega workspaces retain their existing routes. The hosted
// demo only downloads the small, connected workspace that it actually uses.
const ActiveWorkspace = lazy(() => apiConfig.demoMode
  ? import('./DemoWorkspace.jsx').then(module => ({ default: module.DemoWorkspace }))
  : import('./Workspace.jsx').then(module => ({ default: module.Workspace })));

export function Workspace(props) {
  return <Suspense fallback={<main className="work-area"><section className="erp-panel" role="status">Ekran yükleniyor…</section></main>}>
    <ActiveWorkspace {...props} />
  </Suspense>;
}
