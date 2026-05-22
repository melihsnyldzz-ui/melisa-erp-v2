import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/tables.css';
import './styles/erp-skin.css';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
