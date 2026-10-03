import React, { useState } from 'react';
import { BarChart3, BookUser, Inbox, ShoppingCart } from 'lucide-react';
import { WhatsappCrmInboxScreen } from './WhatsappCrmInboxScreen.jsx';
import { CrmCustomerDirectoryScreen } from './CrmCustomerDirectoryScreen.jsx';
import { CrmManagementDashboardScreen } from './CrmManagementDashboardScreen.jsx';
import { CrmSalesAssistantScreen } from './CrmSalesAssistantScreen.jsx';
import { useCrmWorkspaceData } from './crmWorkspaceData.js';
import './crm-workspace.css';

const views = [
  { id: 'inbox', label: 'Gelen Kutusu', icon: Inbox },
  { id: 'customers', label: 'Müşteri Rehberi', icon: BookUser },
  { id: 'sales', label: 'Teklif Hazırla', icon: ShoppingCart },
  { id: 'dashboard', label: 'Yönetim Paneli', icon: BarChart3 },
];

export function WhatsappCrmWorkspace({ user = null }) {
  const [activeView, setActiveView] = useState('inbox');
  const [targetConversationId, setTargetConversationId] = useState('');
  const data = useCrmWorkspaceData();

  function openInbox(conversationId = '') {
    setTargetConversationId(conversationId);
    setActiveView('inbox');
  }

  return (
    <main className="work-area crm-suite-screen">
      <section className="crm-suite-shell">
        <nav className="crm-suite-tabs" aria-label="WhatsApp CRM bölümleri">
          <div className="crm-suite-brand"><span>W</span><div><strong>WhatsApp CRM</strong><small>{data.health ? 'Hat bağlı' : 'Bağlantı kontrol ediliyor'}</small></div></div>
          <div>{views.map((view) => { const Icon = view.icon; return <button aria-current={activeView === view.id ? 'page' : undefined} className={activeView === view.id ? 'active' : ''} key={view.id} onClick={() => setActiveView(view.id)} type="button"><Icon size={16} />{view.label}{view.id === 'inbox' && data.metrics.unread ? <em>{data.metrics.unread}</em> : null}</button>; })}</div>
          <span className={`crm-suite-connection ${data.health ? 'online' : data.error ? 'offline' : ''}`}><i />{data.health ? 'CRM API hazır' : data.error ? 'CRM API kapalı' : 'Kontrol ediliyor'}</span>
        </nav>
        <div className={`crm-suite-content view-${activeView}`}>
          {activeView === 'inbox' ? <WhatsappCrmInboxScreen embedded initialConversationId={targetConversationId} user={user} /> : null}
          {activeView === 'customers' ? <CrmCustomerDirectoryScreen data={data} onOpenInbox={openInbox} /> : null}
          {activeView === 'sales' ? <CrmSalesAssistantScreen data={data} onOpenInbox={openInbox} /> : null}
          {activeView === 'dashboard' ? <CrmManagementDashboardScreen data={data} onOpenInbox={openInbox} /> : null}
        </div>
      </section>
    </main>
  );
}
