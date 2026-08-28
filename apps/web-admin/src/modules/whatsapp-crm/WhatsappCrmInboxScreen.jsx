import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileText,
  Filter,
  HelpCircle,
  Image as ImageIcon,
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
  addWhatsappCrmConversationNote,
  addWhatsappCrmProductInterest,
  addWhatsappCrmConversationTask,
  addWhatsappCrmConversationTag,
  assignWhatsappCrmConversation,
  createWhatsappCrmQuote,
  getWhatsappCrmChatwootPersonnelMap,
  getWhatsappCrmHealth,
  getWhatsappCrmInbox,
  getWhatsappCrmMessageMedia,
  markWhatsappCrmConversationRead,
  sendWhatsappCrmMessage,
  updateWhatsappCrmConversationStage,
  updateWhatsappCrmConversationStatus,
  updateWhatsappCrmContactPhone,
  whatsappCrmConfig,
} from '../../services/whatsappCrmApi.js';
import { fetchCrmCustomer360ByPhone } from '../../services/crmCustomer360Api.js';
import { fetchProducts } from '../../services/productApi.js';
import { fetchPersonnelOverview } from '../../services/personnelApi.js';
import { fetchWhatsappPlan } from '../../services/catalogApi.js';
import './whatsapp-crm-v2.css';

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
  errorTitle: 'CRM gelen kutusu yuklenemedi',
  errorDetail: 'Servis, yetki veya veri baglantisi kontrol edilmeli. Liste korunur ve otomatik yeniden denenir.',
  safetyNotice: 'WhatsApp Business API hatti uzerinden gercek gonderim acik.',
  testSendNotice: 'WhatsApp Business API test hatti uzerinden bagli. Gercek gonderim sadece izinli numaralarda acik.',
  sendDisabledNotice: 'Gonderim kapali. WHATSAPP_SEND_ENABLED=true olmadan mesaj cikmaz.',
  unsupportedGroupNotice: 'Bu sohbet grup kimligiyle geldi. Grup gonderimi icin ayri destek gerekiyor.',
  lidPhoneNotice: 'Bu sohbet LID kimligiyle geldi. CRM gonderimi icin gercek telefon eslestirmesi gerekiyor.',
  mobileBack: 'Gelen kutusuna don',
};

const CRM_INBOX_REFRESH_MS = 3000;

const filterDefinitions = [
  { id: 'all', label: 'Tumu' },
  { id: 'unassigned', label: 'Atanmamis' },
  { id: 'mine', label: 'Benim' },
  { id: 'team', label: 'Atanmis' },
];

const quickActions = ['Katalog Taslagi', 'Fiyat Teyidi', 'Numune Teklifi', 'Teslimat Bilgisi'];
const emojiOptions = ['😊', '👍', '🙏', '❤️', '😂', '😄', '🔥', '✅', '👶', '📦', '💬', '🌸'];
const quickActionMessages = {
  'Katalog Taslagi': 'Merhaba, ilgilendiginiz urun kodlarini paylasir misiniz? Size uygun katalog taslagini hazirlayalim.',
  'Fiyat Teyidi': 'Merhaba, ilgilendiginiz urun kodu ve adetleri paylasirsaniz fiyat bilgisini teyit edebilirim.',
  'Numune Teklifi': 'Numune talebiniz icin urun kodlarini ve adet bilgisini paylasabilir misiniz?',
  'Teslimat Bilgisi': 'Teslimat icin sehir, ulke ve tahmini koli/adet bilgisini paylasir misiniz?',
};
const stages = ['Yeni', 'Gorusuluyor', 'Teklif', 'Teslimat', 'Kazanildi'];
const phoneCountryPrefixes = [
  { prefix: '994', country: 'Azerbaycan', flag: 'AZ' },
  { prefix: '993', country: 'Turkmenistan', flag: 'TM' },
  { prefix: '992', country: 'Tacikistan', flag: 'TJ' },
  { prefix: '971', country: 'BAE', flag: 'AE' },
  { prefix: '966', country: 'Suudi Arabistan', flag: 'SA' },
  { prefix: '964', country: 'Irak', flag: 'IQ' },
  { prefix: '963', country: 'Suriye', flag: 'SY' },
  { prefix: '962', country: 'Urdun', flag: 'JO' },
  { prefix: '961', country: 'Lubnan', flag: 'LB' },
  { prefix: '965', country: 'Kuveyt', flag: 'KW' },
  { prefix: '968', country: 'Umman', flag: 'OM' },
  { prefix: '974', country: 'Katar', flag: 'QA' },
  { prefix: '973', country: 'Bahreyn', flag: 'BH' },
  { prefix: '970', country: 'Filistin', flag: 'PS' },
  { prefix: '972', country: 'Israil', flag: 'IL' },
  { prefix: '995', country: 'Gurcistan', flag: 'GE' },
  { prefix: '374', country: 'Ermenistan', flag: 'AM' },
  { prefix: '373', country: 'Moldova', flag: 'MD' },
  { prefix: '359', country: 'Bulgaristan', flag: 'BG' },
  { prefix: '380', country: 'Ukrayna', flag: 'UA' },
  { prefix: '375', country: 'Belarus', flag: 'BY' },
  { prefix: '998', country: 'Ozbekistan', flag: 'UZ' },
  { prefix: '996', country: 'Kirgizistan', flag: 'KG' },
  { prefix: '44', country: 'Ingiltere', flag: 'GB' },
  { prefix: '49', country: 'Almanya', flag: 'DE' },
  { prefix: '33', country: 'Fransa', flag: 'FR' },
  { prefix: '39', country: 'Italya', flag: 'IT' },
  { prefix: '34', country: 'Ispanya', flag: 'ES' },
  { prefix: '31', country: 'Hollanda', flag: 'NL' },
  { prefix: '32', country: 'Belcika', flag: 'BE' },
  { prefix: '43', country: 'Avusturya', flag: 'AT' },
  { prefix: '41', country: 'Isvicre', flag: 'CH' },
  { prefix: '30', country: 'Yunanistan', flag: 'GR' },
  { prefix: '40', country: 'Romanya', flag: 'RO' },
  { prefix: '7', country: 'Rusya / Kazakistan', flag: 'RU' },
  { prefix: '20', country: 'Misir', flag: 'EG' },
  { prefix: '212', country: 'Fas', flag: 'MA' },
  { prefix: '216', country: 'Tunus', flag: 'TN' },
  { prefix: '213', country: 'Cezayir', flag: 'DZ' },
  { prefix: '218', country: 'Libya', flag: 'LY' },
  { prefix: '90', country: 'Turkiye', flag: 'TR' },
  { prefix: '1', country: 'ABD / Kanada', flag: 'US' },
].sort((left, right) => right.prefix.length - left.prefix.length);

function normalizeInboxResponse(inbox) {
  if (!inbox?.conversations?.length) return [];

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

function detectPhoneCountry(value = '') {
  const phone = normalizePhoneDigits(value);
  if (!phone || phone.length < 7) return { country: 'Bilinmiyor', flag: 'WA' };

  const match = phoneCountryPrefixes.find((item) => phone.startsWith(item.prefix));
  return match || { country: 'Bilinmiyor', flag: 'WA' };
}

function hasExplicitWhatsappPhone(value = '') {
  const raw = String(value || '').trim();
  const phone = normalizePhoneDigits(raw);

  return phone.length >= 10
    && phone.length <= 15
    && (raw.startsWith('+') || raw.startsWith('00') || phone.startsWith('90'));
}

function readAttachmentFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLocaleLowerCase('tr-TR').endsWith('.pdf');

    if (!isImage && !isPdf) {
      reject(new Error('Sadece gorsel veya PDF dosyasi secilebilir.'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('Dosya 10 MB sinirini asmamalidir.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      dataUrl: String(reader.result || ''),
      fileName: file.name || (isImage ? 'image.jpg' : 'document.pdf'),
      mediaType: isImage ? 'image' : 'document',
      mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
      size: file.size,
    });
    reader.onerror = () => reject(new Error('Dosya okunamadi.'));
    reader.readAsDataURL(file);
  });
}

function getSendDisabledReason(conversation) {
  if (conversation?.capabilities?.send === false) {
    return 'Chatwoot gelen kutusu bu asamada salt okunur. Gonderim henuz acilmadi.';
  }

  const remoteJid = String(conversation?.remoteJid || '').toLowerCase();
  const phone = normalizePhoneDigits(conversation?.phone);

  if (remoteJid.endsWith('@g.us')) {
    return CRM_COPY.unsupportedGroupNotice;
  }

  if (remoteJid.endsWith('@lid') && !hasExplicitWhatsappPhone(conversation?.phone)) {
    return CRM_COPY.lidPhoneNotice;
  }

  if (!remoteJid.endsWith('@lid') && phone.length > 15) {
    return 'Bu sohbetin telefon bilgisi WhatsApp gonderimi icin uygun degil.';
  }

  return '';
}

function fallbackMessageText(message) {
  if (message?.text) return message.text;
  if (message?.type === 'image') return '[Gorsel]';
  if (message?.type === 'sticker') return '[Cikartma]';
  if (message?.type === 'video') return '[Video]';
  if (message?.type === 'audio') return '[Ses]';
  if (message?.type === 'file') return message.fileName || '[Belge]';
  return '[Mesaj]';
}

function isUsableMediaUrl(value = '') {
  const normalized = String(value || '').trim();
  return Boolean(normalized)
    && normalized !== 'data:image/jpeg;base64,[object Object]'
    && !normalized.includes('[object Object]');
}

function formatFileSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
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
  const mimeType = message.mimeType || '';
  const mediaUrl = isUsableMediaUrl(message.mediaUrl) ? message.mediaUrl : '';
  const thumbnailUrl = isUsableMediaUrl(message.thumbnailUrl) ? message.thumbnailUrl : '';
  const imageUrl = isUsableMediaUrl(message.imageUrl) ? message.imageUrl : '';
  const rawType = message.type || '';
  const normalizedType = rawType === 'text' && mimeType.startsWith('image/')
    ? 'image'
    : rawType === 'text' && mimeType.startsWith('video/')
      ? 'video'
      : rawType === 'text' && mimeType.startsWith('audio/')
        ? 'audio'
        : rawType || (mimeType.startsWith('image/') ? 'image' : 'text');
  const fileSizeText = formatFileSize(message.fileSize);
  const fileMeta = message.fileMeta || [mimeType, fileSizeText].filter(Boolean).join(' - ');

  return {
    id: message.id || `api-message-${index}`,
    direction: message.direction || 'in',
    type: normalizedType,
    text,
    time: message.time || '',
    status: message.status || '',
    fileName: message.fileName,
    fileMeta,
    fileSize: message.fileSize || '',
    imageUrl: thumbnailUrl || imageUrl || mediaUrl,
    mediaUrl,
    thumbnailUrl,
    hasDirectMedia: Boolean(mediaUrl || imageUrl || thumbnailUrl),
    mimeType,
  };
}

function normalizeApiConversation(conversation, index) {
  const messages = conversation.messages?.length
    ? conversation.messages.map(normalizeApiMessage)
    : [];
  const latestMessage = [...messages].reverse().find((message) => message.text) || messages[messages.length - 1];
  const name = conversation.contactName || conversation.name || conversation.phone || 'Bilinmeyen WhatsApp kisisi';
  const phone = conversation.phone || '';
  const remoteJid = conversation.remoteJid || '';
  const avatarUrl = conversation.profilePictureUrl || conversation.avatarUrl || '';
  const fallbackPhoneCountry = detectPhoneCountry(phone);
  const phoneIdentity = conversation.phoneIdentity || {};

  return {
    id: conversation.id || `api-${index}`,
    name,
    phone,
    remoteJid,
    country: phoneIdentity.countryName || fallbackPhoneCountry.country,
    countryCode: phoneIdentity.countryCode || fallbackPhoneCountry.flag || '',
    flag: phoneIdentity.flag || fallbackPhoneCountry.flag,
    preview: latestMessage?.text || '[Mesaj]',
    time: latestMessage?.time || '',
    unread: Number(conversation.unread || 0),
    status: conversation.status || 'open',
    stage: conversation.stage || 'Yeni',
    owner: conversation.assignedUserName || 'Atanmadi',
    assignedUserId: conversation.assignedUserId,
    language: phoneIdentity.language || 'Bilinmiyor',
    languageSource: phoneIdentity.languageSource || 'unknown',
    source: conversation.provider || 'WhatsApp',
    createdAt: conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toLocaleString('tr-TR')
      : '',
    avatar: getConversationInitials(name, phone),
    avatarUrl,
    tags: conversation.tags || [],
    notes: conversation.notes || '',
    tasks: conversation.tasks || [],
    online: false,
    products: conversation.productInterests || [],
    orders: conversation.quotes || [],
    messages,
    capabilities: conversation.capabilities || {
      read: true,
      send: true,
      assign: true,
      updateStatus: true,
      localWorkflow: true,
    },
  };
}

function getFlagLabel(code) {
  if (!code) return '🏳️';
  if (/^[A-Z]{2}$/.test(code)) {
    return [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
  }
  return code;
}

const conversationStatusLabels = {
  open: 'Acik',
  pending: 'Beklemede',
  resolved: 'Cozuldu',
};

function StatusDot({ online }) {
  return <span aria-label={online ? 'Cevrim ici' : 'Beklemede'} className={online ? 'wcrm-status-dot online' : 'wcrm-status-dot'} />;
}

function ConversationAvatar({ conversation, size = 'normal' }) {
  return (
    <div className={`wcrm-avatar ${size === 'large' ? 'large' : ''}`} aria-hidden="true">
      {conversation.avatarUrl ? (
        <img alt="" src={conversation.avatarUrl} />
      ) : (
        <span>{conversation.avatar}</span>
      )}
      <StatusDot online={conversation.online} />
    </div>
  );
}

function ConversationList({
  activeId,
  advancedFilters,
  compactMode,
  conversations,
  countryOptions,
  filterId,
  filters,
  hasNext,
  isFiltersOpen,
  isLoading,
  isLoadingMore,
  onAdvancedFilterChange,
  onFilterChange,
  onLoadMore,
  onSelect,
  onToggleCompact,
  onToggleFilters,
}) {
  return (
    <aside className={compactMode ? 'wcrm-inbox-panel is-compact' : 'wcrm-inbox-panel'} aria-label="WhatsApp gelen kutusu">
      <div className="wcrm-section-header">
        <div>
          <strong>{CRM_COPY.inboxTitle}</strong>
          <span>{isLoading ? CRM_COPY.loading : `${conversations.length} konusma listeleniyor`}</span>
        </div>
        <div className="wcrm-icon-row">
          <button aria-label="Filtrele" aria-pressed={isFiltersOpen} className="wcrm-icon-button" onClick={onToggleFilters} type="button"><Filter size={16} /></button>
          <button aria-label="Liste gorunumunu degistir" aria-pressed={compactMode} className="wcrm-icon-button" onClick={onToggleCompact} type="button"><Menu size={16} /></button>
        </div>
      </div>

      {isFiltersOpen && (
        <div className="wcrm-advanced-filters" aria-label="Detayli konusma filtreleri">
          <select
            aria-label="Ulkeye gore filtrele"
            onChange={(event) => onAdvancedFilterChange('countryCode', event.target.value)}
            value={advancedFilters.countryCode}
          >
            <option value="">Tum ulkeler</option>
            {countryOptions.map((item) => <option key={item.code} value={item.code}>{item.flag} {item.name}</option>)}
          </select>
          <select
            aria-label="Duruma gore filtrele"
            onChange={(event) => onAdvancedFilterChange('status', event.target.value)}
            value={advancedFilters.status}
          >
            <option value="">Tum durumlar</option>
            <option value="open">Acik</option>
            <option value="pending">Beklemede</option>
            <option value="resolved">Cozuldu</option>
          </select>
          <label>
            <input
              checked={advancedFilters.unreadOnly}
              onChange={(event) => onAdvancedFilterChange('unreadOnly', event.target.checked)}
              type="checkbox"
            />
            Sadece okunmamis
          </label>
        </div>
      )}

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
                {conversation.phone}
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

      <button className="wcrm-load-more" disabled={!hasNext || isLoadingMore} onClick={onLoadMore} type="button">
        {isLoadingMore ? 'Yukleniyor...' : hasNext ? 'Daha fazla yukle' : 'Tum konusmalar yuklendi'}
      </button>
    </aside>
  );
}

function ChatHeader({ activeConversation, onBackToList, onOpenDetails, onUpdateStatus }) {
  const canAssign = activeConversation.capabilities?.assign !== false;
  const canUpdateStatus = activeConversation.capabilities?.updateStatus !== false;
  return (
    <header className="wcrm-chat-header">
      <button className="wcrm-mobile-back" onClick={onBackToList} type="button">{CRM_COPY.mobileBack}</button>
      <ConversationAvatar conversation={activeConversation} size="large" />
      <div className="wcrm-chat-title">
        <strong>{activeConversation.name}</strong>
        <span><span className="wcrm-flag">{activeConversation.flag}</span> {activeConversation.country} - {activeConversation.phone}</span>
      </div>
      <div className="wcrm-chat-actions">
        <button className="wcrm-outline-action" disabled={!canAssign} onClick={onOpenDetails} type="button"><UserCheck size={16} /> Temsilci Sec</button>
        <select
          aria-label="Konusma durumu"
          onChange={(event) => onUpdateStatus(event.target.value)}
          value={activeConversation.status}
          disabled={!canUpdateStatus}
        >
          <option value="open">Acik</option>
          <option value="pending">Beklemede</option>
          <option value="resolved">Cozuldu</option>
        </select>
        <button aria-label="Musteri detaylarini ac" className="wcrm-icon-button wcrm-mobile-details-button" onClick={onOpenDetails} type="button"><Users size={16} /></button>
      </div>
    </header>
  );
}

function MessageBubble({ message }) {
  const isOutgoing = message.direction === 'out';
  const [resolvedMedia, setResolvedMedia] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('idle');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const hasImage = message.type === 'image' || message.mimeType?.startsWith('image/');
  const hasSticker = message.type === 'sticker';
  const hasVideo = message.type === 'video' || message.mimeType?.startsWith('video/');
  const hasAudio = message.type === 'audio' || message.mimeType?.startsWith('audio/');
  const hasFile = message.type === 'file' || message.mimeType?.includes('pdf') || Boolean(message.fileName);
  const mediaHref = resolvedMedia?.dataUrl || message.mediaUrl || message.imageUrl || '';
  const imageSrc = resolvedMedia?.dataUrl || message.imageUrl || '';
  const fileName = message.fileName || (message.mimeType?.includes('pdf') ? 'WhatsApp belgesi.pdf' : 'WhatsApp dosyasi');
  const shouldShowCaption = message.text
    && !['[Gorsel]', '[Görsel]', '[Video]', '[Ses]', '[Belge]', fileName].includes(message.text);

  const resolveMedia = async () => {
    if (message.hasDirectMedia && mediaHref) {
      return { dataUrl: mediaHref };
    }
    if (!message.id || mediaStatus === 'loading' || resolvedMedia?.dataUrl) return resolvedMedia;

    setMediaStatus('loading');
    try {
      const response = await getWhatsappCrmMessageMedia(message.id);
      const media = response.data || response;
      setResolvedMedia(media);
      setMediaStatus('ready');
      return media;
    } catch {
      setMediaStatus('error');
      return null;
    }
  };

  const handleOpenMedia = async () => {
    const media = mediaHref ? null : (resolvedMedia?.dataUrl ? resolvedMedia : await resolveMedia());
    const target = mediaHref || media?.dataUrl;

    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (message.hasDirectMedia || !message.id || resolvedMedia?.dataUrl || mediaStatus !== 'idle') return;

    if (hasImage || hasSticker || hasVideo || hasAudio) {
      resolveMedia();
    }
  }, [message.id, message.hasDirectMedia, hasImage, hasSticker, hasVideo, hasAudio, resolvedMedia?.dataUrl, mediaStatus]);

  const copyText = async () => {
    const text = message.text || fileName || '';
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setIsActionMenuOpen(false);
  };

  const downloadMedia = async () => {
    const media = mediaHref ? null : (resolvedMedia?.dataUrl ? resolvedMedia : await resolveMedia());
    const target = mediaHref || media?.dataUrl;
    if (!target) return;

    const link = document.createElement('a');
    link.href = target;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setIsActionMenuOpen(false);
  };

  return (
    <div className={isOutgoing ? 'wcrm-message-row outgoing' : 'wcrm-message-row'}>
      <div className={isOutgoing ? 'wcrm-message-bubble outgoing' : 'wcrm-message-bubble'}>
        <button
          aria-label="Mesaj islemleri"
          className="wcrm-message-menu-button"
          onClick={() => setIsActionMenuOpen((value) => !value)}
          type="button"
        >
          <ChevronDown size={14} />
        </button>
        {isActionMenuOpen && (
          <div className="wcrm-message-menu">
            <button onClick={copyText} type="button"><Copy size={14} /> Kopyala</button>
            {(mediaHref || hasImage || hasSticker || hasVideo || hasAudio || hasFile) && (
              <button onClick={downloadMedia} type="button"><Download size={14} /> Indir</button>
            )}
          </div>
        )}
        {hasImage || hasSticker ? (
          <div className={hasSticker ? 'wcrm-image-card sticker' : 'wcrm-image-card'}>
            {imageSrc ? (
              <img
                alt={message.text || message.fileName || (hasSticker ? 'WhatsApp cikartmasi' : 'WhatsApp gorseli')}
                onClick={handleOpenMedia}
                onError={resolveMedia}
                role="button"
                src={imageSrc}
                tabIndex={0}
              />
            ) : (
              <span className="wcrm-image-placeholder">
                <ImageIcon size={24} /> {mediaStatus === 'loading' ? 'Medya yukleniyor...' : hasSticker ? 'Cikartma yuklenemedi' : 'Gorseli yukle'}
              </span>
            )}
            {shouldShowCaption && <p>{message.text}</p>}
          </div>
        ) : hasVideo ? (
          <div className="wcrm-media-card">
            {mediaHref ? (
              <video controls preload="metadata" src={mediaHref} />
            ) : (
              <span className="wcrm-image-placeholder"><ImageIcon size={24} /> Video onizleme yok</span>
            )}
            {shouldShowCaption && <p>{message.text}</p>}
          </div>
        ) : hasAudio ? (
          <div className="wcrm-media-card">
            {mediaHref ? (
              <audio controls src={mediaHref} />
            ) : (
              <span className="wcrm-image-placeholder"><FileText size={20} /> Ses dosyasi onizleme yok</span>
            )}
            {shouldShowCaption && <p>{message.text}</p>}
          </div>
        ) : hasFile ? (
          <div className="wcrm-file-card">
            <span className="wcrm-file-icon"><FileText size={20} /></span>
            <span>
              <strong>{fileName}</strong>
              <small>{message.fileMeta}</small>
            </span>
            <button className="wcrm-file-open" onClick={handleOpenMedia} type="button">
              {mediaStatus === 'loading' ? 'Aciliyor...' : 'Ac'}
            </button>
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
  onAssign,
  onCreateQuote,
  onBackToList,
  onOpenDetails,
  onSendMessage,
  onUpdatePhone,
  onUpdateStatus,
  phoneUpdateState,
  sendDisabledReason,
  sendEnabled,
  sendError,
  sendResult,
  testNumberOnly,
}) {
  const [messageText, setMessageText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isReadyRepliesOpen, setIsReadyRepliesOpen] = useState(false);
  const [catalogPlan, setCatalogPlan] = useState({ isOpen: false, isLoading: false, catalogs: [], selectedId: '', error: '' });
  const [phoneText, setPhoneText] = useState('');
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const trimmedMessage = messageText.trim();
  const canSend = sendEnabled && !sendDisabledReason;
  const needsPhone = sendDisabledReason === CRM_COPY.lidPhoneNotice;

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
  }, [activeConversation.id, activeConversation.messages.length]);

  async function submitMessage(event) {
    event.preventDefault();
    if ((!trimmedMessage && !selectedMedia) || !canSend || isSending) return;
    await onSendMessage(trimmedMessage, selectedMedia);
    setMessageText('');
    setSelectedMedia(null);
  }

  async function submitPhone(event) {
    event.preventDefault();
    await onUpdatePhone(phoneText);
    setPhoneText('');
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    try {
      const media = await readAttachmentFile(file);
      setSelectedMedia(media);
      setMediaError('');
    } catch (error) {
      setSelectedMedia(null);
      setMediaError(error.message || 'Gorsel secilemedi.');
    }
  }

  async function openCatalogPlanner(catalogId = '') {
    setCatalogPlan((current) => ({ ...current, isOpen: true, isLoading: true, error: '' }));
    try {
      const response = await fetchWhatsappPlan(catalogId ? { catalogId } : {});
      const plan = response?.data || {};
      setCatalogPlan({
        isOpen: true,
        isLoading: false,
        catalogs: plan.catalogs || [],
        selectedId: String(plan.selectedCatalogId || ''),
        error: '',
      });
      setMessageText(plan.messageTemplate || 'Katalog taslagi hazirlandi.');
    } catch (error) {
      setCatalogPlan((current) => ({ ...current, isLoading: false, error: error.message || 'Kataloglar okunamadi.' }));
    }
  }

  return (
    <section className="wcrm-chat-panel" aria-label="Aktif sohbet">
      <ChatHeader
        activeConversation={activeConversation}
        onAssign={onAssign}
        onBackToList={onBackToList}
        onOpenDetails={onOpenDetails}
        onUpdateStatus={onUpdateStatus}
      />

      <div className="wcrm-chat-notice">
        <Clock3 size={15} />
        {sendDisabledReason
          ? sendDisabledReason
          : sendEnabled
          ? (testNumberOnly ? CRM_COPY.testSendNotice : CRM_COPY.safetyNotice)
          : CRM_COPY.sendDisabledNotice}
      </div>

      <div className="wcrm-date-pill">Bugun</div>

      <div className="wcrm-message-stream" ref={streamRef}>
        {activeConversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {needsPhone && (
        <form className="wcrm-phone-match" onSubmit={submitPhone}>
          <Phone size={16} />
          <input
            aria-label="Gercek WhatsApp telefonu"
            disabled={phoneUpdateState.isSaving}
            onChange={(event) => setPhoneText(event.target.value)}
            placeholder="905xxxxxxxxx"
            type="tel"
            value={phoneText}
          />
          <button disabled={phoneUpdateState.isSaving || normalizePhoneDigits(phoneText).length < 10} type="submit">
            Eslestir
          </button>
          {(phoneUpdateState.error || phoneUpdateState.result) && (
            <span className={phoneUpdateState.error ? 'error' : ''}>
              {phoneUpdateState.error || phoneUpdateState.result}
            </span>
          )}
        </form>
      )}

      <form className="wcrm-composer" onSubmit={submitMessage}>
        <div className="wcrm-composer-row">
          <button
            aria-label="Emoji"
            className="wcrm-icon-button"
            onClick={() => setIsEmojiOpen((value) => !value)}
            type="button"
          >
            <Smile size={17} />
          </button>
          <button
            aria-label="Gorsel ekle"
            className="wcrm-icon-button"
            disabled={!canSend || isSending}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip size={17} />
          </button>
          <input
            accept="image/*,application/pdf"
            className="wcrm-hidden-file-input"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <button aria-label="Hazir cevaplar" aria-pressed={isReadyRepliesOpen} className="wcrm-icon-button" onClick={() => setIsReadyRepliesOpen((value) => !value)} type="button"><Zap size={17} /></button>
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
            disabled={!canSend || (!trimmedMessage && !selectedMedia) || isSending}
            type="submit"
          >
            <Send size={18} />
          </button>
        </div>
        {isEmojiOpen && (
          <div className="wcrm-emoji-panel" role="listbox" aria-label="Emoji sec">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setMessageText((value) => `${value}${emoji}`);
                  setIsEmojiOpen(false);
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {isReadyRepliesOpen && (
          <div className="wcrm-ready-replies" role="listbox" aria-label="Hazir cevap sec">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => {
                  setMessageText(quickActionMessages[action]);
                  setIsReadyRepliesOpen(false);
                }}
                type="button"
              >
                <strong>{action}</strong>
                <span>{quickActionMessages[action]}</span>
              </button>
            ))}
          </div>
        )}
        {catalogPlan.isOpen && (
          <div className="wcrm-catalog-planner">
            <strong>ERP katalog taslagi</strong>
            <select
              aria-label="ERP katalogu sec"
              disabled={catalogPlan.isLoading}
              onChange={(event) => openCatalogPlanner(event.target.value)}
              value={catalogPlan.selectedId}
            >
              {catalogPlan.catalogs.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>{catalog.catalogNo} - {catalog.name} ({catalog.itemCount} urun)</option>
              ))}
            </select>
            <span>{catalogPlan.error || 'Mesaj taslagi hazirlandi; gondermeden once urun, fiyat ve eki insan kontrol etmelidir.'}</span>
            <button onClick={() => setCatalogPlan((current) => ({ ...current, isOpen: false }))} type="button">Kapat</button>
          </div>
        )}
        {selectedMedia && (
          <div className="wcrm-selected-media">
            {selectedMedia.mediaType === 'image' ? (
              <img alt="Secilen gorsel" src={selectedMedia.dataUrl} />
            ) : (
              <span className="wcrm-selected-file-icon"><FileText size={22} /></span>
            )}
            <span>
              <strong>{selectedMedia.fileName}</strong>
              <small>{Math.ceil((selectedMedia.size || 0) / 1024)} KB</small>
            </span>
            <button onClick={() => setSelectedMedia(null)} type="button">Kaldir</button>
          </div>
        )}
        {(mediaError || sendError || sendResult) && (
          <div className={(mediaError || sendError) ? 'wcrm-send-result error' : 'wcrm-send-result'}>
            {mediaError || sendError || sendResult}
          </div>
        )}
        <div className="wcrm-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => action === 'Katalog Taslagi' ? openCatalogPlanner() : setMessageText(quickActionMessages[action] || action)}
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}

function CustomerPanel({
  activeConversation,
  customer360State,
  onAddNote,
  onAddProduct,
  onAddTask,
  onAddTag,
  onAssign,
  onBackToChat,
  onCreateQuote,
  onUpdateStage,
  personnelOptions,
}) {
  const canAssign = activeConversation.capabilities?.assign !== false;
  const canUseLocalWorkflow = activeConversation.capabilities?.localWorkflow !== false;
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDueAt, setTaskDueAt] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  async function runPanelAction(action, successMessage) {
    setIsSavingAction(true);
    setActionMessage('');

    try {
      await action();
      setActionMessage(successMessage);
    } catch (error) {
      setActionMessage(error.message || 'Islem kaydedilemedi.');
    } finally {
      setIsSavingAction(false);
    }
  }

  function addNote() {
    const note = noteDraft.trim();
    if (!note) return;
    runPanelAction(async () => {
      await onAddNote(note);
      setNoteDraft('');
    }, 'Not kalici olarak eklendi.');
  }

  function addTag() {
    const tag = tagDraft.trim();
    if (!tag) return;
    const tags = activeConversation.tags || [];
    if (!tags.some((item) => item.toLocaleLowerCase('tr-TR') === tag.toLocaleLowerCase('tr-TR'))) {
      runPanelAction(async () => {
        await onAddTag(tag);
        setTagDraft('');
      }, 'Etiket kalici olarak eklendi.');
      return;
    }
    setTagDraft('');
    setActionMessage('Bu etiket zaten var.');
  }

  function addTask() {
    const title = taskDraft.trim();
    if (!title || !taskDueAt) return;
    runPanelAction(async () => {
      await onAddTask({ title, dueAt: new Date(taskDueAt).toISOString() });
      setTaskDraft('');
    }, 'Takip görevi kalıcı olarak eklendi.');
  }

  async function searchErpProducts() {
    const query = productSearch.trim();
    if (query.length < 2) return;
    setIsSearchingProducts(true);
    setActionMessage('');
    try {
      const response = await fetchProducts({ page: 1, limit: 8, search: query, activeOnly: true });
      setProductResults(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setActionMessage(error.message || 'ERP ürünleri aranamadı.');
    } finally {
      setIsSearchingProducts(false);
    }
  }

  function addProduct(product) {
    runPanelAction(async () => {
      await onAddProduct(product);
      setProductResults([]);
      setProductSearch('');
    }, `${product.stockCode} ürün ilgisine eklendi.`);
  }

  function createQuote() {
    if (activeConversation.products.length === 0) return;
    runPanelAction(
      () => onCreateQuote({
        contact: { name: activeConversation.name, phone: activeConversation.phone, country: activeConversation.country },
        lines: activeConversation.products,
      }),
      'Teklif taslağı CRM içinde kalıcı olarak oluşturuldu.',
    );
  }

  const erpCustomer = customer360State.customer;
  const recentMovements = erpCustomer?.movements?.slice(0, 5) || [];

  return (
    <aside className="wcrm-customer-panel" aria-label="Musteri bilgileri">
      <div className="wcrm-section-header">
        <div>
          <strong>CRM Kişi Profili</strong>
          <span>CRM içinde bağımsız müşteri profili</span>
        </div>
        <button className="wcrm-outline-action compact wcrm-customer-back" onClick={onBackToChat} type="button">Sohbete don</button>
      </div>

      <div className="wcrm-profile-card">
        <ConversationAvatar conversation={activeConversation} size="large" />
        <strong>{activeConversation.name}</strong>
        <span className="wcrm-status-chip">{conversationStatusLabels[activeConversation.status] || activeConversation.status}</span>
      </div>

      {actionMessage && <div className="wcrm-panel-feedback">{actionMessage}</div>}

      <section className={`wcrm-erp-match is-${customer360State.status}`} aria-label="ERP cari eslesmesi">
        <div>
          <strong>ERP referansı</strong>
          {customer360State.status === 'loading' && <span>Telefonla cari aranıyor...</span>}
          {customer360State.status === 'matched' && <span>Cari güvenli telefon eşleşmesiyle bulundu.</span>}
          {customer360State.status === 'not-found' && <span>ERP carisi yok; kişi yalnızca CRM içinde takip edilir.</span>}
          {customer360State.status === 'ambiguous' && <span>Aynı telefon birden fazla caride kayıtlı; otomatik seçim yapılmadı.</span>}
          {customer360State.status === 'unverified-phone' && <span>ERP eşleşmesi için doğrulanmış telefon gerekiyor.</span>}
          {customer360State.status === 'error' && <span>ERP cari bilgisi şu anda okunamadı.</span>}
        </div>
        <span className="wcrm-erp-match-status">
          {customer360State.status === 'matched' ? 'Referans var' : customer360State.status === 'loading' ? 'Aranıyor' : 'CRM kaydı'}
        </span>
      </section>

      {erpCustomer && (
        <dl className="wcrm-info-list wcrm-erp-customer-list">
          <div><dt>Cari kodu</dt><dd>{erpCustomer.customerCode || '-'}</dd></div>
          <div><dt>Cari adı</dt><dd>{erpCustomer.customerName || '-'}</dd></div>
          <div><dt>Bakiye</dt><dd>{Number(erpCustomer.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {erpCustomer.currency || 'TRY'}</dd></div>
          <div><dt>Şehir / ülke</dt><dd>{[erpCustomer.city, erpCustomer.country].filter(Boolean).join(' / ') || '-'}</dd></div>
          <div><dt>Son hareket</dt><dd>{erpCustomer.lastTransactionDate ? new Date(erpCustomer.lastTransactionDate).toLocaleDateString('tr-TR') : '-'}</dd></div>
          <div><dt>Durum</dt><dd>{erpCustomer.isPassive ? 'Pasif' : 'Aktif'}</dd></div>
        </dl>
      )}

      <dl className="wcrm-info-list">
        <div><dt>Telefon</dt><dd>{activeConversation.phone}</dd></div>
        <div><dt>Ulke</dt><dd><span className="wcrm-flag">{activeConversation.flag}</span> {activeConversation.country}</dd></div>
        <div><dt>Dil</dt><dd>{activeConversation.language}{activeConversation.languageSource === 'country-default' ? ' (ulke varsayimi)' : ''}</dd></div>
        <div>
          <dt>Temsilci</dt>
          <dd>
            <select
              aria-label="Temsilci sec"
              disabled={isSavingAction || !canAssign}
              onChange={(event) => {
                const userId = Number(event.target.value);
                if (userId) runPanelAction(() => onAssign(userId), 'Konusma secilen personele kalici olarak atandi.');
              }}
              value={activeConversation.assignedUserId || ''}
            >
              <option value="">Atanmadi</option>
              {personnelOptions.map((employee) => (
                <option key={employee.id} value={employee.userId}>
                  {employee.fullName} ({employee.username})
                  {employee.chatwootMapping ? ` - ${employee.chatwootMapping.chatwootAgentName || 'Chatwoot eslesmedi'}` : ''}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt>Asama</dt>
          <dd>
            <select
              aria-label="Satis asamasi"
              onChange={(event) => {
                const nextStage = event.target.value;
                runPanelAction(() => onUpdateStage(nextStage), `Asama ${nextStage} olarak kalici guncellendi.`);
              }}
              value={activeConversation.stage}
              disabled={isSavingAction || !canUseLocalWorkflow}
            >
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
          <button disabled={isSavingAction || !canUseLocalWorkflow} onClick={addNote} type="button"><Plus size={14} /> {CRM_COPY.newNote}</button>
        </div>
        <p>{activeConversation.notes || 'Bu musteri icin not eklenmemis.'}</p>
        <div className="wcrm-inline-editor">
          <input
            aria-label="Yeni not"
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Not yaz"
            type="text"
            value={noteDraft}
          />
          <button disabled={isSavingAction || !noteDraft.trim()} onClick={addNote} type="button">Ekle</button>
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>Takip Görevleri</strong><span>{activeConversation.tasks.length} açık</span></div>
        <div className="wcrm-task-list">
          {activeConversation.tasks.map((task) => (
            <article key={task.id}>
              <strong>{task.title}</strong>
              <small>{task.dueAt ? new Date(task.dueAt).toLocaleString('tr-TR') : 'Tarih yok'} · {task.owner || activeConversation.owner}</small>
            </article>
          ))}
          {activeConversation.tasks.length === 0 && <p>Açık takip görevi yok.</p>}
        </div>
        <div className="wcrm-task-editor">
          <input aria-label="Takip görevi" onChange={(event) => setTaskDraft(event.target.value)} placeholder="Örn. fiyat teyidi için ara" value={taskDraft} />
          <input aria-label="Görev tarihi" onChange={(event) => setTaskDueAt(event.target.value)} type="datetime-local" value={taskDueAt} />
          <button disabled={isSavingAction || !taskDraft.trim() || !taskDueAt} onClick={addTask} type="button">Görev ekle</button>
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>Etiketler</strong><button aria-label="Etiket ekle" disabled={isSavingAction} onClick={addTag} type="button"><Plus size={14} /></button></div>
        <div className="wcrm-tags">
          {activeConversation.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="wcrm-inline-editor">
          <input
            aria-label="Yeni etiket"
            onChange={(event) => setTagDraft(event.target.value)}
            placeholder="Etiket yaz"
            type="text"
            value={tagDraft}
          />
          <button disabled={isSavingAction || !tagDraft.trim()} onClick={addTag} type="button">Ekle</button>
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>İlgilendiği Ürünler</strong><span>ERP kataloğu</span></div>
        <div className="wcrm-product-search">
          <input aria-label="ERP ürünü ara" onChange={(event) => setProductSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchErpProducts(); }} placeholder="Stok kodu, barkod veya ürün adı" value={productSearch} />
          <button disabled={isSearchingProducts || productSearch.trim().length < 2} onClick={searchErpProducts} type="button">{isSearchingProducts ? 'Aranıyor' : 'Ara'}</button>
        </div>
        {productResults.length > 0 && (
          <div className="wcrm-product-results">
            {productResults.map((product) => (
              <button key={product.id} onClick={() => addProduct(product)} type="button">
                <span><strong>{product.stockCode}</strong>{product.productName}</span>
                <small>{product.stockQuantity} stok · {Number(product.salePrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {product.currency}</small>
              </button>
            ))}
          </div>
        )}
        <div className="wcrm-products">
          {activeConversation.products.length > 0 ? activeConversation.products.map((product) => (
            <article className="wcrm-product" key={product.eventId || product.id}>
              <span><Package size={18} /></span>
              <strong>{product.stockCode} · {product.productName}</strong>
              <small>{product.stockQuantity} stok · {Number(product.salePrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {product.currency}</small>
            </article>
          )) : <p>Henuz urun secilmemis.</p>}
        </div>
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title">
          <strong>CRM Teklifleri</strong>
          <button disabled={isSavingAction || activeConversation.products.length === 0} onClick={createQuote} type="button">Teklif oluştur</button>
        </div>
        {activeConversation.orders.length > 0 ? (
          <div className="wcrm-orders">
            {activeConversation.orders.map((quote) => (
              <span key={quote.id || quote.quoteNo}><strong>{quote.quoteNo}</strong>{Number(quote.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {quote.currency} - Taslak</span>
            ))}
          </div>
        ) : <p>ERP ürünü ekleyerek bu CRM kişisine teklif taslağı oluşturabilirsiniz.</p>}
      </section>

      <section className="wcrm-side-box">
        <div className="wcrm-mini-title"><strong>Son ERP Hareketleri</strong><span>Salt okunur</span></div>
        {recentMovements.length > 0 ? (
          <div className="wcrm-orders">
            {recentMovements.map((movement) => (
              <span key={movement.id}><strong>{movement.documentNo || '-'}</strong>{Number(movement.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {movement.currency || erpCustomer?.currency || 'TRY'} - {movement.type || movement.status}</span>
            ))}
          </div>
        ) : <p>{erpCustomer ? 'Gösterilecek ERP hareketi yok.' : 'ERP referansı olmadığı için hareket gösterilmez.'}</p>}
      </section>
    </aside>
  );
}

function EmptyConversationPanel() {
  return (
    <section className="wcrm-chat-panel wcrm-no-selection" aria-label="Sohbet secilmedi">
      <MessageCircle size={34} />
      <strong>Bir konuşma seçin</strong>
      <p>Gerçek WhatsApp konuşmaları geldiğinde mesaj geçmişi burada açılır.</p>
    </section>
  );
}

function EmptyCustomerPanel() {
  return (
    <aside className="wcrm-customer-panel wcrm-no-selection" aria-label="Musteri secilmedi">
      <Users size={32} />
      <strong>Müşteri bilgisi bekleniyor</strong>
      <p>Seçilen konuşmanın doğrulanmış telefon ve ERP cari bilgileri burada gösterilir.</p>
    </aside>
  );
}

export function WhatsappCrmInboxScreen({ embedded = false, user = null, initialConversationId = '' }) {
  const [state, setState] = useState({
    isLoading: true,
    error: null,
    health: null,
    conversations: [],
    summary: { open: 0, unread: 0, pendingHumanReply: 0 },
    pagination: { limit: 50, offset: 0, hasNext: false, nextOffset: null, total: 0 },
  });
  const [activeConversationId, setActiveConversationId] = useState('');
  const [filterId, setFilterId] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [advancedFilters, setAdvancedFilters] = useState({ countryCode: '', status: 'open', unreadOnly: false });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadedConversationLimitRef = useRef(50);
  const [personnelOptions, setPersonnelOptions] = useState([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [sendState, setSendState] = useState({
    isSending: false,
    error: '',
    result: '',
  });
  const [phoneUpdateState, setPhoneUpdateState] = useState({
    isSaving: false,
    error: '',
    result: '',
  });
  const [customer360State, setCustomer360State] = useState({
    status: 'unverified-phone',
    customer: null,
  });

  useEffect(() => {
    let isMounted = true;
    let isFirstLoad = true;

    async function load() {
      try {
        const [healthResult, inboxResult] = await Promise.allSettled([
          getWhatsappCrmHealth(),
          getWhatsappCrmInbox({ limit: loadedConversationLimitRef.current, offset: 0 }),
        ]);

        if (!isMounted) return;

        const health = healthResult.status === 'fulfilled' ? healthResult.value.data : null;
        const inbox = inboxResult.status === 'fulfilled' ? inboxResult.value.data : null;
        const conversations = inbox ? normalizeInboxResponse(inbox) : null;
        const loadError = inboxResult.status === 'rejected'
          ? inboxResult.reason
          : healthResult.status === 'rejected' ? healthResult.reason : null;

        setState((current) => ({
          isLoading: false,
          error: loadError,
          health: health || (isFirstLoad ? null : current.health),
          conversations: conversations || (isFirstLoad ? [] : current.conversations),
          summary: inbox?.summary || (isFirstLoad ? { open: 0, unread: 0, pendingHumanReply: 0 } : current.summary),
          pagination: inbox?.pagination || current.pagination,
        }));
        if (conversations) {
          setActiveConversationId((current) => conversations.find((item) => item.id === current)?.id
            || conversations.find((item) => String(item.id) === String(initialConversationId))?.id
            || conversations[0]?.id
            || '');
        }
      } catch (error) {
        if (!isMounted) return;

        setState((current) => ({
          isLoading: false,
          error,
          health: isFirstLoad ? null : current.health,
          conversations: isFirstLoad ? [] : current.conversations,
          summary: isFirstLoad ? { open: 0, unread: 0, pendingHumanReply: 0 } : current.summary,
        }));
      } finally {
        isFirstLoad = false;
      }
    }

    load();
    const refreshTimer = window.setInterval(load, CRM_INBOX_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [initialConversationId, refreshNonce]);

  useEffect(() => {
    let isCurrent = true;
    Promise.allSettled([
      fetchPersonnelOverview(),
      getWhatsappCrmChatwootPersonnelMap(),
    ])
      .then(([personnelResult, mappingResult]) => {
        if (!isCurrent) return;
        if (personnelResult.status !== 'fulfilled') {
          setPersonnelOptions([]);
          return;
        }
        const mappings = mappingResult.status === 'fulfilled'
          ? (mappingResult.value?.data?.mappings || [])
          : [];
        const mappingByUserId = new Map(mappings.map((item) => [Number(item.erpUserId), item]));
        setPersonnelOptions((personnelResult.value?.data?.employees || [])
          .filter((item) => item.isActive && item.userId)
          .map((item) => ({ ...item, chatwootMapping: mappingByUserId.get(Number(item.userId)) || null })));
      })
      .catch(() => {
        if (isCurrent) setPersonnelOptions([]);
      });
    return () => { isCurrent = false; };
  }, []);

  const visibleConversations = useMemo(() => {
    let nextConversations = state.conversations;

    if (filterId === 'unassigned') nextConversations = nextConversations.filter((item) => item.owner === 'Atanmadi');
    if (filterId === 'mine') nextConversations = nextConversations.filter((item) => String(item.assignedUserId || '') === String(user?.id || ''));
    if (filterId === 'team') nextConversations = nextConversations.filter((item) => item.owner !== 'Atanmadi');

    if (advancedFilters.countryCode) nextConversations = nextConversations.filter((item) => item.countryCode === advancedFilters.countryCode);
    if (advancedFilters.status) nextConversations = nextConversations.filter((item) => item.status === advancedFilters.status);
    if (advancedFilters.unreadOnly) nextConversations = nextConversations.filter((item) => item.unread > 0);

    const query = searchText.trim().toLocaleLowerCase('tr-TR');
    if (!query) return nextConversations;

    return nextConversations.filter((item) => [
      item.name,
      item.phone,
      item.preview,
      item.source,
      item.country,
      ...(item.tags || []),
    ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query)));
  }, [advancedFilters, filterId, searchText, state.conversations, user?.id]);

  const countryOptions = useMemo(() => {
    const countries = new Map();
    state.conversations.forEach((item) => {
      if (item.countryCode) countries.set(item.countryCode, { code: item.countryCode, name: item.country, flag: getFlagLabel(item.flag) });
    });
    return [...countries.values()].sort((left, right) => left.name.localeCompare(right.name, 'tr'));
  }, [state.conversations]);

  const filterOptions = useMemo(() => {
    const counts = {
      all: state.conversations.length,
      unassigned: state.conversations.filter((item) => item.owner === 'Atanmadi').length,
      mine: state.conversations.filter((item) => String(item.assignedUserId || '') === String(user?.id || '')).length,
      team: state.conversations.filter((item) => item.owner !== 'Atanmadi').length,
    };

    return filterDefinitions.map((filter) => ({ ...filter, count: counts[filter.id] || 0 }));
  }, [state.conversations, user?.id]);

  const crmMetrics = useMemo(() => {
    const tasks = state.conversations.reduce((sum, item) => sum + (item.tasks?.filter((task) => task.status !== 'done').length || 0), 0);
    const quotes = state.conversations.reduce((sum, item) => sum + (item.orders?.length || 0), 0);
    const stages = state.conversations.reduce((result, item) => {
      result[item.stage] = (result[item.stage] || 0) + 1;
      return result;
    }, {});
    return {
      open: Number(state.summary?.open || 0),
      unread: Number(state.summary?.unread || 0),
      pendingHumanReply: Number(state.summary?.pendingHumanReply || 0),
      tasks,
      quotes,
      stages,
    };
  }, [state.conversations, state.summary]);

  const activeConversation = state.conversations.find((conversation) => conversation.id === activeConversationId)
    || state.conversations[0]
    || null;
  const sendEnabled = Boolean(state.health?.sendEnabled);
  const sendDisabledReason = activeConversation && sendEnabled ? getSendDisabledReason(activeConversation) : '';

  useEffect(() => {
    let isCurrent = true;

    if (!activeConversation) {
      setCustomer360State({ status: 'unverified-phone', customer: null });
      return () => { isCurrent = false; };
    }

    setCustomer360State({ status: 'loading', customer: null });
    fetchCrmCustomer360ByPhone(activeConversation.phone)
      .then((result) => {
        if (isCurrent) setCustomer360State(result);
      })
      .catch((error) => {
        if (isCurrent) setCustomer360State({ status: 'error', customer: null, error });
      });

    return () => { isCurrent = false; };
  }, [activeConversation?.id, activeConversation?.phone]);

  function handleSelectConversation(conversationId) {
    setActiveConversationId(conversationId);
    setMobileView('chat');
    setSendState({ isSending: false, error: '', result: '' });
    setPhoneUpdateState({ isSaving: false, error: '', result: '' });
    const selected = state.conversations.find((item) => item.id === conversationId);
    if (selected?.unread > 0 && selected.capabilities?.localWorkflow !== false) {
      markWhatsappCrmConversationRead(conversationId)
        .then(() => {
          setState((current) => ({
            ...current,
            conversations: current.conversations.map((item) => item.id === conversationId ? { ...item, unread: 0 } : item),
            summary: {
              ...current.summary,
              unread: Math.max(0, Number(current.summary.unread || 0) - selected.unread),
            },
          }));
        })
        .catch((error) => setState((current) => ({ ...current, error })));
    }
  }

  function handlePatchConversation(conversationId, patch) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) => (item.id === conversationId
        ? { ...item, ...patch }
        : item)),
    }));
  }

  async function handleAssignConversation(assigneeUserId = null) {
    const requestedUserId = assigneeUserId || personnelOptions
      .find((employee) => String(employee.userId) === String(user?.id || ''))?.userId;
    if (!requestedUserId) {
      throw new Error('Temsilci alanindan atanacak personeli secin.');
    }
    const response = await assignWhatsappCrmConversation(activeConversation.id, requestedUserId);
    const assignedUser = response.data?.assignedUser || response.assignedUser || {};
    const owner = assignedUser.displayName || assignedUser.username || 'Atandi';
    handlePatchConversation(activeConversation.id, {
      assignedUserId: response.data?.assignedUserId || response.assignedUserId,
      owner,
    });
  }

  async function handleUpdateConversationStatus(status) {
    try {
      const response = await updateWhatsappCrmConversationStatus(activeConversation.id, status);
      handlePatchConversation(activeConversation.id, {
        status: response.data?.status || status,
        unread: Number(response.data?.unread ?? activeConversation.unread),
      });
    } catch (error) {
      setState((current) => ({ ...current, error }));
    }
  }

  async function handleLoadMore() {
    const nextOffset = state.pagination?.nextOffset;
    if (nextOffset === null || nextOffset === undefined || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await getWhatsappCrmInbox({ limit: state.pagination.limit || 50, offset: nextOffset });
      const inbox = response.data || {};
      const incoming = normalizeInboxResponse(inbox);
      loadedConversationLimitRef.current = Math.max(
        loadedConversationLimitRef.current,
        Number(nextOffset || 0) + incoming.length,
      );
      setState((current) => {
        const byId = new Map(current.conversations.map((item) => [item.id, item]));
        incoming.forEach((item) => byId.set(item.id, item));
        return {
          ...current,
          conversations: [...byId.values()],
          pagination: inbox.pagination || current.pagination,
        };
      });
    } catch (error) {
      setState((current) => ({ ...current, error }));
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleUpdateConversationStage(stage) {
    await updateWhatsappCrmConversationStage(activeConversation.id, stage);
    handlePatchConversation(activeConversation.id, { stage });
  }

  async function handleAddConversationNote(note) {
    const response = await addWhatsappCrmConversationNote(activeConversation.id, note);
    const savedNote = response.data?.note || note;
    const author = response.data?.author?.displayName || response.data?.author?.username || 'Kullanici';
    const currentNotes = activeConversation.notes || '';
    const nextNotes = `${new Date().toLocaleString('tr-TR')} - ${author}: ${savedNote}${currentNotes ? `\n${currentNotes}` : ''}`;
    handlePatchConversation(activeConversation.id, { notes: nextNotes });
  }

  async function handleAddConversationTag(tag) {
    const response = await addWhatsappCrmConversationTag(activeConversation.id, tag);
    const tags = response.data?.tags || activeConversation.tags || [];
    handlePatchConversation(activeConversation.id, { tags });
  }

  async function handleAddConversationTask(task) {
    const response = await addWhatsappCrmConversationTask(activeConversation.id, task);
    const savedTask = response.data || task;
    handlePatchConversation(activeConversation.id, {
      tasks: [...(activeConversation.tasks || []), savedTask],
    });
  }

  async function handleAddProductInterest(product) {
    const response = await addWhatsappCrmProductInterest(activeConversation.id, product);
    const savedProduct = response.data || product;
    handlePatchConversation(activeConversation.id, {
      products: [savedProduct, ...(activeConversation.products || [])],
    });
  }

  async function handleCreateQuote(payload) {
    const response = await createWhatsappCrmQuote(activeConversation.id, payload);
    const quote = response.data;
    handlePatchConversation(activeConversation.id, {
      orders: [quote, ...(activeConversation.orders || [])],
    });
  }

  async function handleUpdatePhone(phone) {
    const conversation = state.conversations.find((item) => item.id === activeConversationId) || activeConversation;
    const normalizedPhone = normalizePhoneDigits(phone);

    if (normalizedPhone.length < 10) {
      setPhoneUpdateState({ isSaving: false, error: 'Telefon numarasi gecersiz.', result: '' });
      return;
    }

    setPhoneUpdateState({ isSaving: true, error: '', result: '' });

    try {
      const response = await updateWhatsappCrmContactPhone(conversation.id, normalizedPhone);
      const nextPhone = response.data?.contact?.phone || normalizedPhone;

      setState((current) => ({
        ...current,
        conversations: current.conversations.map((item) => (item.id === conversation.id
          ? { ...item, phone: nextPhone, avatar: getConversationInitials(item.name, nextPhone) }
          : item)),
      }));
      setPhoneUpdateState({ isSaving: false, error: '', result: 'Telefon eslesti.' });
      setSendState({ isSending: false, error: '', result: '' });
    } catch (error) {
      setPhoneUpdateState({
        isSaving: false,
        error: `${error.message || 'Telefon eslestirilemedi.'} (${error.code || 'WHATSAPP_CRM_PHONE_UPDATE_ERROR'})`,
        result: '',
      });
    }
  }

  async function handleSendMessage(text, media = null) {
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
        contactName: conversation.name,
        text,
        media,
      });
      const sentMessage = response.data?.message || {
        id: `local-${Date.now()}`,
        direction: 'out',
        type: media ? 'image' : 'text',
        text: text || (media ? '[Gorsel]' : ''),
        imageUrl: media?.dataUrl || '',
        mimeType: media?.mimeType || '',
        fileName: media?.fileName || '',
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      };

      setState((current) => ({
        ...current,
        conversations: current.conversations.map((item) => (item.id === conversation.id
          ? {
              ...item,
              messages: [...item.messages, sentMessage],
              preview: sentMessage.text || (sentMessage.type === 'image' ? '[Gorsel]' : '[Mesaj]'),
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
      <section className={`wcrm-shell ${embedded ? 'is-embedded' : ''}`} aria-label="WhatsApp CRM ana sayfasi">
        <header className={`wcrm-topbar ${embedded ? 'is-embedded' : ''}`}>
          <div className="wcrm-title-block">
            <button aria-label="Konusma filtrelerini ac" className="wcrm-icon-button" onClick={() => setIsFiltersOpen((value) => !value)} type="button"><Menu size={17} /></button>
            {!embedded ? <div>
              <strong>{CRM_COPY.title}</strong>
              <span>Gelen kutusu, satis takibi ve musteri profili</span>
            </div> : null}
          </div>

          <label className="wcrm-search">
            <Search size={17} />
            <input
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={CRM_COPY.searchPlaceholder}
              type="search"
              value={searchText}
            />
          </label>

          <div className="wcrm-user-actions">
            <button
              aria-label="CRM verilerini yenile"
              className={`wcrm-service-pill ${state.health ? 'is-online' : state.error ? 'is-offline' : 'is-checking'}`}
              onClick={() => setRefreshNonce((value) => value + 1)}
              type="button"
            >
              <span aria-hidden="true" />
              <strong>{embedded ? 'Yenile' : state.health ? 'CRM API hazır' : state.error ? 'CRM API kapalı' : 'CRM API kontrol ediliyor'}</strong>
            </button>
            <button
              aria-label="Okunmamis konusmalari goster"
              className="wcrm-icon-button alert"
              onClick={() => {
                setIsFiltersOpen(true);
                setAdvancedFilters((current) => ({ ...current, unreadOnly: true }));
              }}
              type="button"
            ><Bell size={17} /><span>{crmMetrics.unread}</span></button>
            {!embedded ? <button aria-label="Yardim" aria-pressed={isHelpOpen} className="wcrm-icon-button" onClick={() => setIsHelpOpen((value) => !value)} type="button"><HelpCircle size={17} /></button> : null}
            {!embedded ? <div className="wcrm-agent-chip">
              <span>{String(user?.displayName || user?.username || 'K').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
              <strong>{user?.displayName || user?.username || 'Kullanıcı'}</strong>
              <ChevronDown size={14} />
            </div> : null}
          </div>
        </header>

        <div className="wcrm-summary-strip">
          {isHelpOpen && (
            <div className="wcrm-help-strip" role="status">
              Konusmayi secince okunmamis sayaci temizlenir. Temsilci ve durum degisiklikleri kalici kaydedilir. Katalog ve mesaj gonderimi insan onayi ile tamamlanir.
            </div>
          )}
          {state.error && (
            <div className="wcrm-api-warning" role="status">
              <strong>{CRM_COPY.errorTitle}</strong>
              <span>{CRM_COPY.errorDetail} API: {whatsappCrmConfig.baseUrl}</span>
            </div>
          )}

          {!embedded ? <section className="wcrm-metrics" aria-label="CRM operasyon özeti">
            <article><span>Açık konuşma</span><strong>{crmMetrics.open}</strong></article>
            <article><span>Okunmamış</span><strong>{crmMetrics.unread}</strong></article>
            <article><span>Yanıt bekleyen</span><strong>{crmMetrics.pendingHumanReply}</strong></article>
            <article><span>Açık görev</span><strong>{crmMetrics.tasks}</strong></article>
            <article><span>CRM teklifi</span><strong>{crmMetrics.quotes}</strong></article>
            <article className="wcrm-stage-summary">
              <span>Satış hunisi</span>
              <strong>{stages.map((stage) => `${stage}: ${crmMetrics.stages[stage] || 0}`).join(' · ')}</strong>
            </article>
          </section> : null}
        </div>

        <div className={`wcrm-workspace mobile-${mobileView}`}>
          <ConversationList
            activeId={activeConversation?.id || ''}
            advancedFilters={advancedFilters}
            compactMode={compactMode}
            conversations={visibleConversations}
            countryOptions={countryOptions}
            filterId={filterId}
            filters={filterOptions}
            hasNext={Boolean(state.pagination?.hasNext)}
            isFiltersOpen={isFiltersOpen}
            isLoading={state.isLoading}
            isLoadingMore={isLoadingMore}
            onAdvancedFilterChange={(key, value) => setAdvancedFilters((current) => ({ ...current, [key]: value }))}
            onFilterChange={setFilterId}
            onLoadMore={handleLoadMore}
            onSelect={handleSelectConversation}
            onToggleCompact={() => setCompactMode((value) => !value)}
            onToggleFilters={() => setIsFiltersOpen((value) => !value)}
          />
          {activeConversation ? (
            <ChatPanel
              activeConversation={activeConversation}
              isSending={sendState.isSending}
              onAssign={handleAssignConversation}
              onCreateQuote={handleCreateQuote}
              onBackToList={() => setMobileView('list')}
              onOpenDetails={() => setMobileView('details')}
              onSendMessage={handleSendMessage}
              onUpdatePhone={handleUpdatePhone}
              onUpdateStatus={handleUpdateConversationStatus}
              phoneUpdateState={phoneUpdateState}
              sendDisabledReason={sendDisabledReason}
              sendEnabled={sendEnabled}
              sendError={sendState.error}
              sendResult={sendState.result}
              testNumberOnly={Boolean(state.health?.testNumberOnly)}
            />
          ) : <EmptyConversationPanel />}
          {activeConversation ? (
            <CustomerPanel
              activeConversation={activeConversation}
              customer360State={customer360State}
              onAddNote={handleAddConversationNote}
              onAddProduct={handleAddProductInterest}
              onAddTask={handleAddConversationTask}
              onAddTag={handleAddConversationTag}
              onAssign={handleAssignConversation}
              onBackToChat={() => setMobileView('chat')}
              onCreateQuote={handleCreateQuote}
              personnelOptions={personnelOptions}
              onUpdateStage={handleUpdateConversationStage}
            />
          ) : <EmptyCustomerPanel />}
        </div>
      </section>
    </main>
  );
}
