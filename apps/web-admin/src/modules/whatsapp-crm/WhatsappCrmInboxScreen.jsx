import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  HelpCircle,
  Mail,
  Menu,
  MessageCircle,
  MoreVertical,
  Package,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Tag,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  getWhatsappCrmHealth,
  getWhatsappCrmInbox,
  sendWhatsappCrmMessage,
  whatsappCrmConfig,
} from '../../services/whatsappCrmApi.js';

const CRM_COPY = {
  title: 'WhatsApp CRM',
  searchPlaceholder: 'Ara: musteri, telefon, urun, siparis...',
  inboxTitle: 'Gelen Kutusu',
  assign: 'Atama Yap',
  edit: 'Duzenle',
  newNote: 'Yeni Not',
  createOrder: 'Siparis Olustur',
  messagePlaceholder: 'Mesaj yazin...',
  emptyConversations: 'Bu filtrede konusma yok.',
  loading: 'WhatsApp CRM hazirlaniyor...',
  errorTitle: 'CRM API simdilik ulasilamadi',
  errorDetail: 'Backend baglantisi gelene kadar ekran mock veriyle calisir.',
  safetyNotice: 'WhatsApp Business API hatti uzerinden gercek gonderim acik.',
  testSendNotice: 'WhatsApp Business API test hatti uzerinden bagli. Gercek gonderim sadece izinli numaralarda acik.',
  sendDisabledNotice: 'Gonderim kapali. WHATSAPP_SEND_ENABLED=true olmadan mesaj cikmaz.',
  unsupportedTargetNotice: 'Bu sohbet LID/grup kimligiyle geldi. CRM gonderimi icin gercek telefon eslesmesi gerekiyor.',
  mobileBack: 'Gelen kutusuna don',
};

const mockConversations = [
  {
    id: 'conv-sara',
    name: 'Sara Al-Baghdadi',
    country: 'Irak',
    flag: 'IQ',
    phone: '+964 770 123 4567',
    preview: 'Merhaba, yeni dogan tulum ve battaniye...',
    time: '11:32',
    unread: 2,
    online: true,
    status: 'Potansiyel Musteri',
    stage: 'Gorusuluyor',
    owner: 'Ayse Demir',
    language: 'Arapca',
    source: 'WhatsApp',
    createdAt: '15.05.2024 11:20',
    avatar: 'SA',
    tags: ['Irak', 'Yeni Musteri', 'Bebek Seti'],
    notes: 'Ilk kez 15.05.2024 tarihinde WhatsApp uzerinden iletisime gecti.',
    products: [
      { id: 'p1', name: 'Yeni Dogan Seti', detail: '0-3 Ay', tone: 'pink' },
      { id: 'p2', name: 'Battaniye', detail: '100x120 cm', tone: 'sand' },
      { id: 'p3', name: 'Tulum', detail: '0-6 Ay', tone: 'cream' },
    ],
    orders: [],
    messages: [
      {
        id: 'm1',
        direction: 'in',
        text: 'Merhaba, yeni dogan tulum ve battaniye hakkinda bilgi almak istiyorum.',
        time: '11:28',
      },
      {
        id: 'm2',
        direction: 'out',
        text: 'Merhaba Sara Hanim, hos geldiniz. Size yardimci olmaktan memnuniyet duyariz. Hangi urunler hakkinda bilgi almak istiyorsunuz?',
        time: '11:29',
        status: 'read',
      },
      {
        id: 'm3',
        direction: 'in',
        text: 'Pamuklu yeni dogan setleri ve Irak teslimat bilgisi lazim.',
        time: '11:30',
      },
      {
        id: 'm4',
        direction: 'out',
        text: 'Irak icin duzenli gonderim yapiyoruz. Size katalog ve fiyat listesini ileteyim.',
        time: '11:30',
        status: 'read',
      },
      {
        id: 'm5',
        direction: 'out',
        type: 'file',
        fileName: 'Melisa Baby Katalog 2024.pdf',
        fileMeta: '2.4 MB - PDF',
        time: '11:31',
        status: 'read',
      },
      {
        id: 'm6',
        direction: 'out',
        text: 'Fiyat listemiz de ektedir.',
        time: '11:31',
        status: 'read',
      },
    ],
  },
  {
    id: 'conv-mohammed',
    name: 'Mohammed Khan',
    country: 'Suudi Arabistan',
    flag: 'SA',
    phone: '+966 55 400 1188',
    preview: 'Fiyat listesi rica edebilir miyim?',
    time: '11:20',
    unread: 1,
    online: false,
    status: 'Fiyat Bekliyor',
    stage: 'Teklif',
    owner: 'Mert Kaya',
    language: 'Arapca',
    source: 'WhatsApp',
    createdAt: '15.05.2024 10:58',
    avatar: 'MK',
    tags: ['Katalog', 'Toplu Alim'],
    products: [
      { id: 'p4', name: 'Uyku Seti', detail: '6-12 Ay', tone: 'blue' },
      { id: 'p5', name: 'Tulum', detail: '3-6 Ay', tone: 'cream' },
    ],
    orders: [{ id: 'SO-24018', amount: '$820', status: 'Taslak' }],
    messages: [
      { id: 'm1', direction: 'in', text: 'Fiyat listesi rica edebilir miyim?', time: '11:20' },
      { id: 'm2', direction: 'out', text: 'Tabii, hangi urun gruplariyla ilgileniyorsunuz?', time: '11:22', status: 'sent' },
    ],
  },
  {
    id: 'conv-amina',
    name: 'Amina Hassan',
    country: 'BAE',
    flag: 'AE',
    phone: '+971 50 224 6600',
    preview: 'Bebek setleri hakkinda bilgi almak istiyorum.',
    time: '10:58',
    unread: 0,
    online: true,
    status: 'Yeni',
    stage: 'Yeni',
    owner: 'Atanmadi',
    language: 'Ingilizce',
    source: 'WhatsApp',
    createdAt: '15.05.2024 10:58',
    avatar: 'AH',
    tags: ['BAE'],
    products: [],
    orders: [],
    messages: [{ id: 'm1', direction: 'in', text: 'Bebek setleri hakkinda bilgi almak istiyorum.', time: '10:58' }],
  },
  {
    id: 'conv-omar',
    name: 'Omar Farouk',
    country: 'Misir',
    flag: 'EG',
    phone: '+20 100 554 7790',
    preview: 'Siparisim ne zaman gonderilebilir?',
    time: '10:42',
    unread: 3,
    online: false,
    status: 'Siparis Takibi',
    stage: 'Teslimat',
    owner: 'Ayse Demir',
    language: 'Arapca',
    source: 'WhatsApp',
    createdAt: '14.05.2024 16:10',
    avatar: 'OF',
    tags: ['Siparis', 'Teslimat'],
    products: [],
    orders: [{ id: 'SO-24011', amount: '$1.250', status: 'Hazirlaniyor' }],
    messages: [{ id: 'm1', direction: 'in', text: 'Siparisim ne zaman gonderilebilir?', time: '10:42' }],
  },
  {
    id: 'conv-lina',
    name: 'Lina Petrova',
    country: 'Bulgaristan',
    flag: 'BG',
    phone: '+359 88 455 1020',
    preview: 'Hello, I want to see your catalog.',
    time: '10:30',
    unread: 0,
    online: true,
    status: 'Katalog',
    stage: 'Katalog',
    owner: 'Mert Kaya',
    language: 'Ingilizce',
    source: 'WhatsApp',
    createdAt: '13.05.2024 09:15',
    avatar: 'LP',
    tags: ['Avrupa', 'Katalog'],
    products: [],
    orders: [],
    messages: [{ id: 'm1', direction: 'in', text: 'Hello, I want to see your catalog.', time: '10:30' }],
  },
  {
    id: 'conv-john',
    name: 'John Smith',
    country: 'Ingiltere',
    flag: 'GB',
    phone: '+44 7700 900123',
    preview: 'Do you ship to UK?',
    time: '10:15',
    unread: 0,
    online: false,
    status: 'Nakliye Sorusu',
    stage: 'Gorusuluyor',
    owner: 'Atanmadi',
    language: 'Ingilizce',
    source: 'WhatsApp',
    createdAt: '12.05.2024 13:40',
    avatar: 'JS',
    tags: ['UK', 'Nakliye'],
    products: [],
    orders: [],
    messages: [{ id: 'm1', direction: 'in', text: 'Do you ship to UK?', time: '10:15' }],
  },
];

const filters = [
  { id: 'all', label: 'Tumu', count: 24 },
  { id: 'unassigned', label: 'Atanmamis', count: 6 },
  { id: 'mine', label: 'Benim', count: 8 },
  { id: 'team', label: 'Ekibim', count: 10 },
];

const quickActions = ['Katalog Gonder', 'Fiyat Listesi', 'Numune Teklifi', 'Teslimat Bilgisi'];
const stages = ['Yeni', 'Gorusuluyor', 'Teklif', 'Teslimat', 'Kazanildi'];
const connectionStatus = {
  line: 'Melisa Baby WhatsApp Hatti',
  phone: '+90 555 123 45 67',
  status: 'Bagli',
  sync: 'Bugun 11:30',
};

function normalizeInboxResponse(inbox) {
  if (!inbox?.conversations?.length) return mockConversations;

  return inbox.conversations.map((conversation, index) => ({
    ...normalizeApiConversation(conversation, index),
  }));
}

function normalizePhoneDigits(value = '') {
  const digits = String(value || '').replace(/[^\d]/g, '');

  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  return digits;
}

function getSendDisabledReason(conversation) {
  const remoteJid = String(conversation?.remoteJid || '').toLowerCase();
  const phone = normalizePhoneDigits(conversation?.phone);

  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@lid')) {
    return CRM_COPY.unsupportedTargetNotice;
  }

  if (phone.length > 15) {
    return 'Bu sohbetin telefon bilgisi WhatsApp gonderimi icin uygun degil.';
  }

  return '';
}

function fallbackMessageText(message) {
  if (message?.text) return message.text;
  if (message?.type === 'file') return message.fileName || '[Belge]';
  return '[Mesaj]';
}

function getConversationInitials(name, phone) {
  const words = String(name || '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1 && !/^\d+$/.test(words[0])) return words[0].slice(0, 2).toUpperCase();
  return String(phone || '--').slice(-2).padStart(2, '-');
}

function normalizeApiMessage(message, index) {
  const text = fallbackMessageText(message);

  return {
    id: message.id || `api-message-${index}`,
    direction: message.direction || 'in',
    type: message.type || 'text',
    text,
    time: message.time || '',
    status: message.status || '',
    fileName: message.fileName,
    fileMeta: message.fileMeta,
  };
}

function normalizeApiConversation(conversation, index) {
  const fallback = mockConversations[index % mockConversations.length];
  const messages = conversation.messages?.length
    ? conversation.messages.map(normalizeApiMessage)
    : [];
  const latestMessage = [...messages].reverse().find((message) => message.text) || messages[messages.length - 1];
  const name = conversation.contactName || conversation.name || conversation.phone || fallback.name;
  const phone = conversation.phone || fallback.phone;
  const remoteJid = conversation.remoteJid || '';

  return {
    ...fallback,
    id: conversation.id || `api-${index}`,
    name,
    phone,
    remoteJid,
    country: 'WhatsApp',
    flag: 'WA',
    preview: latestMessage?.text || '[Mesaj]',
    time: latestMessage?.time || '',
    unread: Number(conversation.unread || 0),
    status: conversation.status === 'open' ? 'Açık' : conversation.status || fallback.status,
    stage: 'Yeni',
    owner: 'Atanmadi',
    language: 'Bilinmiyor',
    source: conversation.provider || 'WhatsApp',
    createdAt: conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toLocaleString('tr-TR')
      : fallback.createdAt,
    avatar: getConversationInitials(name, phone),
    tags: conversation.tags || [],
    notes: `${conversation.instanceKey || 'melisa-test'} üzerinden alınan gerçek WhatsApp konuşması.`,
    products: [],
    orders: [],
    messages,
  };
}

function getFlagLabel(code) {
  return code || '--';
}

function StatusDot({ online }) {
  return <span aria-label={online ? 'Cevrim ici' : 'Beklemede'} className={online ? 'wcrm-status-dot online' : 'wcrm-status-dot'} />;
}

function ConversationAvatar({ conversation, size = 'normal' }) {
  return (
    <div className={`wcrm-avatar ${size === 'large' ? 'large' : ''}`} aria-hidden="true">
      <span>{conversation.avatar}</span>
      <StatusDot online={conversation.online} />
    </div>
  );
}

function ConversationList({ activeId, conversations, filterId, isLoading, onFilterChange, onSelect }) {
  return (
    <aside className="wcrm-inbox-panel" aria-label="WhatsApp gelen kutusu">
      <div className="wcrm-section-header">
        <div>
          <strong>{CRM_COPY.inboxTitle}</strong>
          <span>{isLoading ? CRM_COPY.loading : `${conversations.length} konusma listeleniyor`}</span>
        </div>
        <div className="wcrm-icon-row">
          <button aria-label="Filtrele" className="wcrm-icon-button" type="button"><Filter size={16} /></button>
          <button aria-label="Liste ayarlari" className="wcrm-icon-button" type="button"><Menu size={16} /></button>
        </div>
      </div>

      <div className="wcrm-filter-tabs" role="tablist" aria-label="Konusma filtreleri">
        {filters.map((filter) => (
          <button
            aria-selected={filter.id === filterId}
            className={filter.id === filterId ? 'active' : ''}
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            role="tab"
            type="button"
          >
            {filter.label}
            <span>{filter.count}</span>
          </button>
        ))}
      </div>

      <div className="wcrm-conversation-list">
        {conversations.map((conversation) => (
          <button
            className={conversation.id === activeId ? 'wcrm-conversation active' : 'wcrm-conversation'}
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            type="button"
          >
            <ConversationAvatar conversation={conversation} />
            <span className="wcrm-conversation-main">
              <span className="wcrm-conversation-top">
                <strong>{conversation.name}</strong>
                <small>{conversation.time}</small>
              </span>
              <span className="wcrm-conversation-meta">
                <span className="wcrm-flag">{getFlagLabel(conversation.flag)}</span>
                {conversation.country}
              </span>
              <span className="wcrm-conversation-preview">{conversation.preview}</span>
            </span>
            {conversation.unread > 0 && <span className="wcrm-unread">{conversation.unread}</span>}
          </button>
        ))}

        {!isLoading && conversations.length === 0 && (
          <div className="wcrm-empty-state">
            <MessageCircle size={22} />
            <strong>{CRM_COPY.emptyConversations}</strong>
          </div>
        )}
      </div>

      <button className="wcrm-load-more" type="button">Daha fazla yukle</button>
    </aside>
  );
}

function ChatHeader({ activeConversation, onBackToList }) {
  return (
    <header className="wcrm-chat-header">
      <button className="wcrm-mobile-back" onClick={onBackToList} type="button">{CRM_COPY.mobileBack}</button>
      <ConversationAvatar conversation={activeConversation} size="large" />
      <div className="wcrm-chat-title">
        <strong>{activeConversation.name}</strong>
        <span><span className="wcrm-flag">{activeConversation.flag}</span> {activeConversation.country} - {activeConversation.phone}</span>
      </div>
      <div className="wcrm-chat-actions">
        <button className="wcrm-outline-action" type="button"><UserCheck size={16} /> {CRM_COPY.assign}</button>
        <button aria-label="Etiket" className="wcrm-icon-button" type="button"><Tag size={16} /></button>
        <button aria-label="Daha fazla" className="wcrm-icon-button" type="button"><MoreVertical size={16} /></button>
      </div>
    </header>
  );
}

function MessageBubble({ message }) {
  const isOutgoing = message.direction === 'out';

  return (
    <div className={isOutgoing ? 'wcrm-message-row outgoing' : 'wcrm-message-row'}>
      <div className={isOutgoing ? 'wcrm-message-bubble outgoing' : 'wcrm-message-bubble'}>
        {message.type === 'file' ? (
          <div className="wcrm-file-card">
            <span className="wcrm-file-icon"><FileText size={20} /></span>
            <span>
              <strong>{message.fileName}</strong>
              <small>{message.fileMeta}</small>
            </span>
          </div>
        ) : (
          <p>{message.text}</p>
        )}
        <span className="wcrm-message-time">
          {message.time}
          {isOutgoing && <CheckCheck size={14} />}
        </span>
      </div>
    </div>
  );
}

function ChatPanel({
  activeConversation,
  isSending,
  onBackToList,
  onSendMessage,
  sendDisabledReason,
  sendEnabled,
  sendError,
  sendResult,
  testNumberOnly,
}) {
  const [messageText, setMessageText] = useState('');
  const trimmedMessage = messageText.trim();
  const canSend = sendEnabled && !sendDisabledReason;

  async function submitMessage(event) {
    event.preventDefault();
    if (!trimmedMessage || !canSend || isSending) return;
    await onSendMessage(trimmedMessage);
    setMessageText('');
  }

  return (
    <section className="wcrm-chat-panel" aria-label="Aktif sohbet">
      <ChatHeader activeConversation={activeConversation} onBackToList={onBackToList} />

      <div className="wcrm-chat-notice">
        <Clock3 size={15} />
        {sendDisabledReason
          ? sendDisabledReason
          : sendEnabled
          ? (testNumberOnly ? CRM_COPY.testSendNotice : CRM_COPY.safetyNotice)
          : CRM_COPY.sendDisabledNotice}
      </div>

      <div className="wcrm-date-pill">Bugun</div>

      <div className="wcrm-message-stream">
        {activeConversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <form className="wcrm-composer" onSubmit={submitMessage}>
        <div className="wcrm-composer-row">
          <button aria-label="Emoji" className="wcrm-icon-button" type="button"><Smile size={17} /></button>
          <button aria-label="Dosya ekle" className="wcrm-icon-button" type="button"><Paperclip size={17} /></button>
          <button aria-label="Hazir cevaplar" className="wcrm-icon-button" type="button"><Zap size={17} /></button>
          <input
            aria-label="Mesaj"
            disabled={!canSend || isSending}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={sendDisabledReason || CRM_COPY.messagePlaceholder}
            type="text"
            value={messageText}
          />
          <button
            aria-label={canSend ? 'WhatsApp mesajini gonder' : 'Gonderim kapali'}
            className="wcrm-send-button"
            disabled={!canSend || !trimmedMessage || isSending}
            type="submit"
          >
            <Send size={18} />
          </button>
        </div>
        {(sendError || sendResult) && (
          <div className={sendError ? 'wcrm-send-result error' : 'wcrm-send-result'}>
            {sendError || sendResult}
          </div>
        )}
        <div className="wcrm-quick-actions">
          {quickActions.map((action) => (
            <button key={action} type="button">{action}</button>
          ))}
          <button aria-label="Daha fazla hizli islem" type="button"><MoreVertical size={15} /></button>
        </div>
      </form>
    </section>
  );
}

function CustomerPanel({ activeConversation }) {
  return (
    <aside className="wcrm-customer-panel" aria-label="Musteri bilgileri">
      <div className="wcrm-section-header">
        <div>
          <strong>Musteri Bilgileri</strong>
          <span>ERP cari baglantisina hazir profil</span>
        </div>
        <button className="wcrm-outline-action compact" type="button">{CRM_COPY.edit}</button>
      </div>

      <div className="wcrm-profile-card">
        <ConversationAvatar conversation={activeConversation} size="large" />
        <strong>{activeConversation.name}</strong>
        <span className="wcrm-status-chip">{activeConversation.status}</span>
        <div className="wcrm-contact-actions">
          <button aria-label="WhatsApp" type="button"><MessageCircle size={15} /></button>
          <button aria-label="Telefon" type="button"><Phone size={15} /></button>
          <button aria-label="E-posta" type="button"><Mail size={15} /></button>
          <button aria-label="Temsilci" type="button"><Users size={15} /></button>
        </div>
      </div>

      <dl className="wcrm-info-list">
        <div><dt>Telefon</dt><dd>{activeConversation.phone}</dd></div>
        <div><dt>Ulke</dt><dd><span className="wcrm-flag">{activeConversation.flag}</span> {activeConversation.country}</dd></div>
        <div><dt>Dil</dt><dd>{activeConversation.language}</dd></div>
        <div><dt>Temsilci</dt><dd>{activeConversation.owner}</dd></div>
        <div>
          <dt>Asama</dt>
          <dd>
            <select aria-label="Satis asamasi" value={activeConversation.stage} onChange={() => {}}>
              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </dd>
        </div>
        <div><dt>Kaynak</dt><dd>{activeConversation.source}</dd></div>
        <div><dt>Olusturulma</dt><dd>{activeConversation.createdAt}</dd></div>
      </dl>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title">
          <strong>Notlar</strong>
          <button type="button"><Plus size={14} /> {CRM_COPY.newNote}</button>
        </div>
        <p>{activeConversation.notes || 'Bu musteri icin not eklenmemis.'}</p>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>Etiketler</strong><button aria-label="Etiket ekle" type="button"><Plus size={14} /></button></div>
        <div className="wcrm-tags">
          {activeConversation.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>Ilgilendigi Urunler</strong></div>
        <div className="wcrm-products">
          {activeConversation.products.length > 0 ? activeConversation.products.map((product) => (
            <article className={`wcrm-product ${product.tone || ''}`} key={product.id}>
              <span><Package size={18} /></span>
              <strong>{product.name}</strong>
              <small>{product.detail}</small>
            </article>
          )) : <p>Henuz urun secilmemis.</p>}
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title">
          <strong>Son Siparisler</strong>
          <button type="button">{CRM_COPY.createOrder}</button>
        </div>
        {activeConversation.orders.length > 0 ? (
          <div className="wcrm-orders">
            {activeConversation.orders.map((order) => (
              <span key={order.id}><strong>{order.id}</strong>{order.amount} - {order.status}</span>
            ))}
          </div>
        ) : <p>Henuz siparis olusturulmamis.</p>}
      </section>
    </aside>
  );
}

function ConnectionPanel({ healthStatus }) {
  return (
    <aside className="wcrm-connection-panel" aria-label="Baglanti durumu">
      <div className="wcrm-phone-preview" aria-hidden="true">
        <div className="wcrm-phone-top">11:32</div>
        <strong>{CRM_COPY.title}</strong>
        <div className="wcrm-phone-tabs">
          <span className="active">Tumu 24</span>
          <span>Benim 8</span>
          <span>Ekibim 10</span>
        </div>
        {mockConversations.slice(0, 4).map((conversation) => (
          <div className="wcrm-phone-row" key={conversation.id}>
            <ConversationAvatar conversation={conversation} />
            <span>
              <strong>{conversation.name}</strong>
              <small>{conversation.preview}</small>
            </span>
          </div>
        ))}
      </div>

      <section className="wcrm-connection-card">
        <div className="wcrm-mini-title"><strong>Baglanti Durumu</strong></div>
        <dl>
          <div><dt>Hat</dt><dd>{connectionStatus.line}</dd></div>
          <div><dt>Telefon</dt><dd>{connectionStatus.phone}</dd></div>
          <div><dt>Durum</dt><dd><span className="wcrm-online-chip">{healthStatus || connectionStatus.status}</span></dd></div>
          <div><dt>Son Senkronizasyon</dt><dd>{connectionStatus.sync}</dd></div>
        </dl>
      </section>
    </aside>
  );
}

export function WhatsappCrmInboxScreen() {
  const [state, setState] = useState({
    isLoading: true,
    error: null,
    health: null,
    conversations: mockConversations,
  });
  const [activeConversationId, setActiveConversationId] = useState(mockConversations[0].id);
  const [filterId, setFilterId] = useState('all');
  const [mobileView, setMobileView] = useState('list');
  const [sendState, setSendState] = useState({
    isSending: false,
    error: '',
    result: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [healthResponse, inboxResponse] = await Promise.all([
          getWhatsappCrmHealth(),
          getWhatsappCrmInbox(),
        ]);

        if (!isMounted) return;

        const conversations = normalizeInboxResponse(inboxResponse.data);
        setState({
          isLoading: false,
          error: null,
          health: healthResponse.data,
          conversations,
        });
        setActiveConversationId((current) => conversations.find((item) => item.id === current)?.id || conversations[0]?.id || '');
      } catch (error) {
        if (!isMounted) return;

        setState({
          isLoading: false,
          error,
          health: null,
          conversations: mockConversations,
        });
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleConversations = useMemo(() => {
    if (filterId === 'unassigned') return state.conversations.filter((item) => item.owner === 'Atanmadi');
    if (filterId === 'mine') return state.conversations.filter((item) => item.owner === 'Ayse Demir');
    if (filterId === 'team') return state.conversations.filter((item) => item.owner !== 'Atanmadi');
    return state.conversations;
  }, [filterId, state.conversations]);

  const activeConversation = state.conversations.find((conversation) => conversation.id === activeConversationId)
    || state.conversations[0]
    || mockConversations[0];
  const sendEnabled = Boolean(state.health?.sendEnabled);
  const sendDisabledReason = sendEnabled ? getSendDisabledReason(activeConversation) : '';

  function handleSelectConversation(conversationId) {
    setActiveConversationId(conversationId);
    setMobileView('chat');
    setSendState({ isSending: false, error: '', result: '' });
  }

  async function handleSendMessage(text) {
    const conversation = state.conversations.find((item) => item.id === activeConversationId) || activeConversation;
    const disabledReason = sendEnabled ? getSendDisabledReason(conversation) : CRM_COPY.sendDisabledNotice;

    if (disabledReason) {
      setSendState({ isSending: false, error: disabledReason, result: '' });
      return;
    }

    setSendState({ isSending: true, error: '', result: '' });

    try {
      const response = await sendWhatsappCrmMessage({
        conversationId: conversation.id,
        phone: conversation.phone,
        remoteJid: conversation.remoteJid,
        text,
      });
      const sentMessage = response.data?.message || {
        id: `local-${Date.now()}`,
        direction: 'out',
        type: 'text',
        text,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      };

      setState((current) => ({
        ...current,
        conversations: current.conversations.map((item) => (item.id === conversation.id
          ? {
              ...item,
              messages: [...item.messages, sentMessage],
              preview: sentMessage.text,
              time: sentMessage.time,
            }
          : item)),
      }));
      setSendState({ isSending: false, error: '', result: 'Mesaj gonderildi.' });
    } catch (error) {
      setSendState({
        isSending: false,
        error: `${error.message || 'Mesaj gonderilemedi.'} (${error.code || 'WHATSAPP_CRM_SEND_ERROR'})`,
        result: '',
      });
    }
  }

  return (
    <main className="work-area whatsapp-crm-screen">
      <section className="wcrm-shell" aria-label="WhatsApp CRM ana sayfasi">
        <header className="wcrm-topbar">
          <div className="wcrm-title-block">
            <button aria-label="Menu" className="wcrm-icon-button" type="button"><Menu size={17} /></button>
            <div>
              <strong>{CRM_COPY.title}</strong>
              <span>Gelen kutusu, satis takibi ve musteri profili</span>
            </div>
          </div>

          <label className="wcrm-search">
            <Search size={17} />
            <input placeholder={CRM_COPY.searchPlaceholder} type="search" />
          </label>

          <div className="wcrm-user-actions">
            <button aria-label="Bildirimler" className="wcrm-icon-button alert" type="button"><Bell size={17} /><span>5</span></button>
            <button aria-label="Yardim" className="wcrm-icon-button" type="button"><HelpCircle size={17} /></button>
            <div className="wcrm-agent-chip">
              <span>AY</span>
              <strong>Ahmet Yilmaz</strong>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {state.error && (
          <div className="wcrm-api-warning" role="status">
            <strong>{CRM_COPY.errorTitle}</strong>
            <span>{CRM_COPY.errorDetail} API: {whatsappCrmConfig.baseUrl}</span>
          </div>
        )}

        <div className={`wcrm-workspace mobile-${mobileView}`}>
          <ConversationList
            activeId={activeConversation.id}
            conversations={visibleConversations}
            filterId={filterId}
            isLoading={state.isLoading}
            onFilterChange={setFilterId}
            onSelect={handleSelectConversation}
          />
          <ChatPanel
            activeConversation={activeConversation}
            isSending={sendState.isSending}
            onBackToList={() => setMobileView('list')}
            onSendMessage={handleSendMessage}
            sendDisabledReason={sendDisabledReason}
            sendEnabled={sendEnabled}
            sendError={sendState.error}
            sendResult={sendState.result}
            testNumberOnly={Boolean(state.health?.testNumberOnly)}
          />
          <CustomerPanel activeConversation={activeConversation} />
          <ConnectionPanel healthStatus={state.health?.status} />
        </div>
      </section>
    </main>
  );
}
