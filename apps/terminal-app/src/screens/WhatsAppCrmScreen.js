import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TerminalButton } from '../components/TerminalButton';
import {
  assignWhatsappCrmConversation,
  getWhatsappCrmHealth,
  getWhatsappCrmInbox,
  getWhatsappCrmMessageMedia,
  sendWhatsappCrmText,
} from '../services/whatsappCrmService';
import { renewLocalPasswordlessAdminSession } from '../services/authService';
import { colors } from '../styles/theme';

const filterTabs = [
  { key: 'all', label: 'Tumu' },
  { key: 'unassigned', label: 'Atanmamis' },
  { key: 'mine', label: 'Benim' },
];

function extractConversations(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.conversations)) return payload.conversations;
  if (Array.isArray(payload?.data?.conversations)) return payload.data.conversations;
  return [];
}

function normalizeMessages(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeConversation(row = {}) {
  const messages = normalizeMessages(row.messages);
  const lastMessage = row.lastMessage || messages[messages.length - 1] || {};

  return {
    id: String(row.id || row.conversationId || row.remoteJid || ''),
    remoteJid: row.remoteJid || row.remote_jid || '',
    contactName: row.contactName || row.contact_name || row.name || row.phone || 'WhatsApp',
    phone: row.phone || row.contactPhone || row.contact_phone || '',
    stage: row.stage || 'Yeni',
    assignedUserName: row.assignedUserName || row.assigned_user_name || '',
    unreadCount: Number(row.unreadCount || row.unread_count || 0),
    lastMessageAt: row.lastMessageAt || row.last_message_at || lastMessage.createdAt || lastMessage.created_at || '',
    lastMessageText: row.lastMessageText || row.last_message_text || lastMessage.text || '',
    messages,
  };
}

function formatTime(value) {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : text.slice(11, 16) || text;
}

function getMessageText(message = {}) {
  return message.text || message.body || message.caption || message.messageText || message.message_text || '';
}

function getMessageDirection(message = {}) {
  const direction = String(message.direction || message.messageDirection || message.message_direction || '').toLowerCase();
  if (direction.includes('out')) return 'out';
  if (message.fromMe || message.from_me) return 'out';
  return 'in';
}

function getMedia(message = {}) {
  return message.media || message.attachment || message.file || null;
}

function getMessageType(message = {}) {
  const type = String(message.type || message.messageType || message.message_type || '').toLowerCase();
  const mimeType = String(message.mimeType || message.mime_type || '').toLowerCase();

  if (type) return type;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'file';
  return 'text';
}

function hasRemoteMedia(message = {}) {
  const type = getMessageType(message);
  return ['image', 'sticker', 'video', 'audio', 'file', 'document'].includes(type)
    || Boolean(message.mediaUrl || message.imageUrl || message.thumbnailUrl || message.fileName);
}

function normalizeSearchText(value = '') {
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i');
}

function normalizePhoneForLink(value = '') {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  return digits;
}

function MessageBubble({ message, token, unlockToken }) {
  const direction = getMessageDirection(message);
  const text = getMessageText(message);
  const [resolvedMedia, setResolvedMedia] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('idle');
  const media = resolvedMedia || getMedia(message);
  const type = getMessageType(message);
  const isImage = type === 'image'
    || type === 'sticker'
    || media?.mediaType === 'image'
    || media?.mimeType?.startsWith?.('image/')
    || media?.dataUrl?.startsWith('data:image/')
    || media?.url?.match(/\.(png|jpe?g|webp)$/i);
  const isFile = type === 'file' || type === 'document' || type === 'video' || type === 'audio' || message.fileName || media?.fileName;
  const mediaUri = media?.dataUrl || media?.url || message.imageUrl || message.thumbnailUrl || message.mediaUrl || '';
  const fileName = media?.fileName || message.fileName || (type === 'audio' ? 'WhatsApp ses dosyasi' : type === 'video' ? 'WhatsApp video' : 'WhatsApp dosyasi');
  const shouldShowCaption = text && !['[Gorsel]', '[Görsel]', '[Video]', '[Ses]', '[Belge]', fileName].includes(text);

  async function resolveMedia() {
    if (!message.id || mediaStatus === 'loading' || resolvedMedia?.dataUrl) return;
    if (!hasRemoteMedia(message)) return;

    setMediaStatus('loading');
    try {
      const payload = await getWhatsappCrmMessageMedia({ token, unlockToken, messageId: message.id });
      setResolvedMedia(payload.data || payload);
      setMediaStatus('ready');
    } catch {
      setMediaStatus('error');
    }
  }

  useEffect(() => {
    if (hasRemoteMedia(message) && !mediaUri && mediaStatus === 'idle') {
      resolveMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  return (
    <View style={[styles.messageRow, direction === 'out' && styles.messageRowOut]}>
      <View style={[styles.messageBubble, direction === 'out' ? styles.messageBubbleOut : styles.messageBubbleIn]}>
        {isImage && mediaUri ? (
          <Image source={{ uri: mediaUri }} style={styles.messageImage} resizeMode="cover" />
        ) : null}
        {isImage && !mediaUri ? (
          <Pressable onPress={resolveMedia} style={styles.mediaPlaceholder}>
            <Text style={styles.mediaPlaceholderText}>{mediaStatus === 'loading' ? 'Gorsel yukleniyor...' : mediaStatus === 'error' ? 'Gorsel alinamadi' : 'Gorseli yukle'}</Text>
          </Pressable>
        ) : null}
        {isFile && !isImage ? (
          <View style={styles.fileCard}>
            <Text style={styles.fileIcon}>{type === 'audio' ? 'SES' : type === 'video' ? 'VID' : 'PDF'}</Text>
            <View style={styles.fileText}>
              <Text style={styles.fileTitle} numberOfLines={1}>{fileName}</Text>
              <Text style={styles.fileMeta}>{mediaStatus === 'loading' ? 'Yukleniyor...' : media?.mimeType || message.mimeType || 'Ek'}</Text>
            </View>
            {!mediaUri ? (
              <Pressable onPress={resolveMedia} style={styles.fileLoadButton}>
                <Text style={styles.fileLoadButtonText}>{mediaStatus === 'error' ? 'Tekrar' : 'Yukle'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {text && (!isImage && !isFile || shouldShowCaption) ? <Text style={styles.messageText}>{text}</Text> : null}
        <Text style={styles.messageTime}>{formatTime(message.createdAt || message.created_at || message.timestamp)}</Text>
      </View>
    </View>
  );
}

function ConversationRow({ conversation, selected, onPress }) {
  const initials = conversation.contactName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'WA';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationRow,
        selected && styles.conversationRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.conversationMain}>
        <View style={styles.conversationTop}>
          <Text style={styles.conversationName} numberOfLines={1}>{conversation.contactName}</Text>
          <Text style={styles.conversationTime}>{formatTime(conversation.lastMessageAt)}</Text>
        </View>
        <Text style={styles.conversationPhone} numberOfLines={1}>{conversation.phone || conversation.remoteJid || 'Telefon yok'}</Text>
        <Text style={styles.conversationPreview} numberOfLines={1}>{conversation.lastMessageText || '[Mesaj]'}</Text>
      </View>
      {conversation.unreadCount ? <Text style={styles.unreadBadge}>{conversation.unreadCount}</Text> : null}
    </Pressable>
  );
}

export function WhatsAppCrmScreen({ navigation, session }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [crmAccessToken, setCrmAccessToken] = useState(session?.accessToken || '');
  const crmUnlockToken = '';
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [connectionStatus, setConnectionStatus] = useState({ online: false, label: 'Kontrol ediliyor' });
  const [lastRefreshAt, setLastRefreshAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const userName = session?.user?.username || session?.user?.name || '';

  async function withFreshToken(requestFn) {
    try {
      return await requestFn(crmAccessToken || session?.accessToken);
    } catch (error) {
      if (error.status !== 401 && error.code !== 'AUTH_TOKEN_EXPIRED' && error.code !== 'AUTH_TOKEN_INVALID') {
        throw error;
      }

      const renewedSession = await renewLocalPasswordlessAdminSession();
      setCrmAccessToken(renewedSession.accessToken);
      return requestFn(renewedSession.accessToken);
    }
  }

  const filteredConversations = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return conversations.filter((conversation) => {
      const assigned = String(conversation.assignedUserName || '').trim();
      const isMine = assigned && normalizeSearchText(assigned) === normalizeSearchText(userName);

      if (filterMode === 'unassigned' && assigned) return false;
      if (filterMode === 'mine' && !isMine) return false;

      if (!query) return true;

      const haystack = normalizeSearchText([
        conversation.contactName,
        conversation.phone,
        conversation.remoteJid,
        conversation.lastMessageText,
      ].filter(Boolean).join(' '));

      return haystack.includes(query);
    });
  }, [conversations, filterMode, searchQuery, userName]);

  const selectedConversation = useMemo(
    () => filteredConversations.find((conversation) => conversation.id === selectedId) || filteredConversations[0] || null,
    [filteredConversations, selectedId],
  );

  async function loadHealth() {
    try {
      const payload = await withFreshToken((token) => getWhatsappCrmHealth({ token }));
      const provider = payload?.data?.provider || payload?.provider || 'CRM';
      setConnectionStatus({ online: true, label: `${provider} online` });
    } catch (healthError) {
      setConnectionStatus({ online: false, label: healthError.message || 'CRM offline' });
    }
  }

  async function loadInbox(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setError('');
    if (!silent) setStatus('');

    try {
      const payload = await withFreshToken((token) => getWhatsappCrmInbox({ token, unlockToken: crmUnlockToken, limit: 50 }));
      const rows = extractConversations(payload).map(normalizeConversation).filter((row) => row.id);
      setConversations(rows);
      setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ''));
      setLastRefreshAt(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
      if (!silent) setStatus(rows.length ? `${rows.length} konusma listelendi.` : 'Konusma bulunamadi.');
    } catch (loadError) {
      setError(loadError.message || 'WhatsApp CRM okunamadi.');
      if (!silent) {
        setConversations([]);
        setSelectedId('');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function confirmSend() {
    const text = messageText.trim();
    if (!selectedConversation || !text || sending) return;

    Alert.alert(
      'WhatsApp mesaji gonder',
      'Bu mesaj merkezi WhatsApp hattindan gonderilecek. Devam edilsin mi?',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Gonder',
          onPress: async () => {
            setSending(true);
            setError('');
            try {
              await withFreshToken((token) => sendWhatsappCrmText({ token, unlockToken: crmUnlockToken, conversation: selectedConversation, text }));
              setMessageText('');
              setStatus('Mesaj gonderildi.');
              await loadInbox();
            } catch (sendError) {
              setError(sendError.message || 'Mesaj gonderilemedi.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  function confirmAssign() {
    if (!selectedConversation || sending) return;

    Alert.alert(
      'Konusmayi ata',
      'Bu WhatsApp konusmasi aktif kullaniciya atanacak. Devam edilsin mi?',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Ata',
          onPress: async () => {
            setSending(true);
            setError('');
            try {
              await withFreshToken((token) => assignWhatsappCrmConversation({ token, unlockToken: crmUnlockToken, conversationId: selectedConversation.id }));
              setStatus('Konusma atandi.');
              await loadInbox();
            } catch (assignError) {
              setError(assignError.message || 'Atama yapilamadi.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  function openConversation(conversationId) {
    setSelectedId(conversationId);
    setMessageText('');
    setStatus('');
    setError('');
    setViewMode('chat');
  }

  async function openVoiceCall() {
    const phone = normalizePhoneForLink(selectedConversation?.phone);
    if (!phone) {
      Alert.alert('Telefon yok', 'Bu sohbet icin gercek telefon numarasi bulunamadi.');
      return;
    }

    const url = `tel:+${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Arama acilamadi', 'Bu cihaz telefon aramasi baslatamiyor.');
      return;
    }

    await Linking.openURL(url);
  }

  async function openWhatsAppForVideoCall() {
    const phone = normalizePhoneForLink(selectedConversation?.phone);
    if (!phone) {
      Alert.alert('Telefon yok', 'Bu sohbet icin gercek telefon numarasi bulunamadi.');
      return;
    }

    const whatsappUrl = `whatsapp://send?phone=${phone}`;
    const webUrl = `https://wa.me/${phone}`;
    const target = await Linking.canOpenURL(whatsappUrl) ? whatsappUrl : webUrl;

    Alert.alert(
      'WhatsApp goruntulu arama',
      'WhatsApp API dogrudan goruntulu arama baslatmiyor. Sohbet WhatsApp uygulamasinda acilacak; goruntulu arama butonuna oradan basabilirsin.',
      [
        { text: 'Vazgec', style: 'cancel' },
        { text: 'WhatsApp ac', onPress: () => Linking.openURL(target) },
      ],
    );
  }

  useEffect(() => {
    setCrmAccessToken(session?.accessToken || '');
  }, [session?.accessToken]);

  useEffect(() => {
    loadHealth();
    loadInbox();
    const timer = setInterval(() => {
      loadInbox({ silent: true });
    }, 20000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.page}>
      {viewMode === 'list' ? (
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            <Pressable onPress={navigation?.goBack || navigation?.goHome} style={({ pressed }) => [styles.pageBackButton, pressed && styles.pressed]}>
              <Text style={styles.pageBackButtonText}>{'<'}</Text>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>WhatsApp CRM</Text>
              <Text style={styles.subtitle}>Merkezi hat gelen kutusu ve temsilci sohbetleri</Text>
              <Text style={[styles.connectionText, connectionStatus.online ? styles.connectionOnline : styles.connectionOffline]}>
                {connectionStatus.label}{lastRefreshAt ? ` / ${lastRefreshAt}` : ''}
              </Text>
            </View>
          </View>
          <TerminalButton label={loading ? 'Yukleniyor' : 'Yenile'} onPress={loadInbox} variant="secondary" disabled={loading} />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {status && !error && viewMode === 'list' ? <Text style={styles.statusText}>{status}</Text> : null}

      {loading && !conversations.length ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>WhatsApp CRM okunuyor...</Text>
        </View>
      ) : viewMode === 'list' ? (
        <View style={styles.workspace}>
          <View style={[styles.listPanel, styles.listPanelFull]}>
            <View style={styles.listHeader}>
              <Text style={styles.panelTitle}>Gelen Kutusu</Text>
              <Text style={styles.listCount}>{filteredConversations.length}/{conversations.length}</Text>
            </View>
            <View style={styles.searchRow}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Ad, telefon veya mesaj ara"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                returnKeyType="search"
              />
              <Pressable
                onPress={() => setSearchQuery('')}
                disabled={!searchQuery}
                style={({ pressed }) => [
                  styles.clearSearchButton,
                  !searchQuery && styles.clearSearchButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clearSearchText}>Temizle</Text>
              </Pressable>
            </View>
            <View style={styles.filterRow}>
              {filterTabs.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilterMode(tab.key)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    filterMode === tab.key && styles.filterPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.filterText, filterMode === tab.key && styles.filterTextActive]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView style={styles.conversationList}>
              {filteredConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={selectedConversation?.id === conversation.id}
                  onPress={() => openConversation(conversation.id)}
                />
              ))}
              {!filteredConversations.length ? <Text style={styles.emptyText}>Filtreye uygun konusma yok.</Text> : null}
            </ScrollView>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={[styles.chatPanel, styles.chatPanelFull]}
        >
          {selectedConversation ? (
            <>
              <View style={styles.chatHeader}>
                <Pressable onPress={() => setViewMode('list')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                  <Text style={styles.backButtonText}>{'<'}</Text>
                </Pressable>
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>
                    {(selectedConversation.contactName || 'WA').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatHeaderText}>
                  <Text style={styles.chatName} numberOfLines={1}>{selectedConversation.contactName}</Text>
                  <Text style={styles.chatMeta} numberOfLines={1}>{selectedConversation.phone || selectedConversation.remoteJid}</Text>
                </View>
                <View style={styles.callActions}>
                  <Pressable
                    onPress={openWhatsAppForVideoCall}
                    accessibilityRole="button"
                    accessibilityLabel="WhatsApp goruntulu arama"
                    style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.callButtonText}>Video</Text>
                  </Pressable>
                  <Pressable
                    onPress={openVoiceCall}
                    accessibilityRole="button"
                    accessibilityLabel="Telefonla ara"
                    style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.callButtonText}>Ara</Text>
                  </Pressable>
                </View>
                <Pressable onPress={confirmAssign} style={({ pressed }) => [styles.assignButton, pressed && styles.pressed]}>
                  <Text style={styles.assignButtonText}>{selectedConversation.assignedUserName ? 'Atandi' : 'Ata'}</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
                {(selectedConversation.messages || []).map((message, index) => (
                  <MessageBubble
                      key={message.id || message.providerMessageId || `${selectedConversation.id}-${index}`}
                      message={message}
                      token={crmAccessToken || session?.accessToken}
                      unlockToken={crmUnlockToken}
                    />
                ))}
                {!selectedConversation.messages?.length ? <Text style={styles.emptyText}>Bu konusmada mesaj listesi bos.</Text> : null}
              </ScrollView>

              <View style={styles.replyBar}>
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Mesaj yazin..."
                  placeholderTextColor={colors.muted}
                  style={styles.replyInput}
                  multiline
                />
                <Pressable
                  onPress={confirmSend}
                  disabled={!messageText.trim() || sending}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (!messageText.trim() || sending) && styles.sendButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.sendButtonText}>{sending ? '...' : 'Gonder'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.emptyChatPanel}>
              <Text style={styles.emptyText}>Sohbet secin.</Text>
              <TerminalButton label="Gelen kutusuna don" onPress={() => setViewMode('list')} variant="secondary" />
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  accessPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: colors.background,
  },
  accessCard: {
    width: '100%',
    maxWidth: 430,
    gap: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: '#b8d3c8',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  accessIcon: { fontSize: 34 },
  accessTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  accessDescription: { fontSize: 14, color: colors.muted },
  accessInput: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#9ebcaf',
    borderRadius: 10,
    color: colors.text,
    backgroundColor: '#ffffff',
  },
  page: {
    flex: 1,
    padding: 10,
    gap: 8,
    backgroundColor: colors.background,
  },
  headerCard: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  pageBackButton: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.panel,
  },
  pageBackButtonText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 34,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  connectionText: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '900',
  },
  connectionOnline: {
    color: colors.success,
  },
  connectionOffline: {
    color: colors.danger,
  },
  errorText: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 7,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    padding: 9,
  },
  statusText: {
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 7,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    padding: 9,
  },
  loadingPanel: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  workspace: {
    flex: 1,
    gap: 8,
  },
  listPanel: {
    maxHeight: 330,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  listPanelFull: {
    flex: 1,
    maxHeight: '100%',
  },
  listHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  listCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingBottom: 7,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  clearSearchButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
  },
  clearSearchButtonDisabled: {
    opacity: 0.45,
  },
  clearSearchText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 9,
    paddingBottom: 8,
  },
  filterPill: {
    minHeight: 32,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.panel,
    paddingHorizontal: 10,
  },
  filterPillActive: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  filterText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  filterTextActive: {
    color: colors.danger,
  },
  conversationList: {
    flexGrow: 0,
  },
  conversationRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 9,
    backgroundColor: colors.white,
  },
  conversationRowSelected: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fed7aa',
  },
  avatarText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  conversationMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  conversationName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  conversationTime: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  conversationPhone: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  conversationPreview: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  unreadBadge: {
    overflow: 'hidden',
    minWidth: 22,
    borderRadius: 11,
    backgroundColor: '#e11d48',
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  chatPanel: {
    flex: 1,
    minHeight: 360,
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 8,
    backgroundColor: '#050806',
    overflow: 'hidden',
  },
  chatPanelFull: {
    minHeight: 0,
  },
  chatHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0b141a',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2c33',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#111b21',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#233138',
  },
  chatAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  chatHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  callActions: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
    borderRadius: 20,
    backgroundColor: '#111b21',
    overflow: 'hidden',
  },
  callButton: {
    minWidth: 50,
    paddingHorizontal: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  chatName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  chatMeta: {
    marginTop: 2,
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '800',
  },
  assignButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f7a5a',
    borderRadius: 7,
    backgroundColor: '#0b3b2f',
    paddingHorizontal: 9,
  },
  assignButtonText: {
    color: '#d1f4e0',
    fontSize: 12,
    fontWeight: '900',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 10,
    gap: 7,
    paddingBottom: 18,
  },
  messageRow: {
    alignItems: 'flex-start',
  },
  messageRowOut: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 13,
    padding: 8,
    gap: 5,
  },
  messageBubbleIn: {
    backgroundColor: '#202c33',
  },
  messageBubbleOut: {
    backgroundColor: '#075e54',
  },
  messageText: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  messageTime: {
    alignSelf: 'flex-end',
    color: '#b8c0c4',
    fontSize: 11,
    fontWeight: '700',
  },
  messageImage: {
    width: 260,
    height: 260,
    borderRadius: 8,
    backgroundColor: '#111b21',
  },
  mediaPlaceholder: {
    width: 260,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
    borderRadius: 8,
    backgroundColor: '#111b21',
    padding: 10,
  },
  mediaPlaceholderText: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  fileCard: {
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.panel,
    padding: 8,
  },
  fileLoadButton: {
    minHeight: 32,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
  },
  fileLoadButtonText: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '900',
  },
  fileIcon: {
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: colors.danger,
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  fileText: {
    flex: 1,
    minWidth: 0,
  },
  fileTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  fileMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  replyBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#111b21',
    backgroundColor: '#0b141a',
    padding: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: '#202c33',
    borderRadius: 22,
    backgroundColor: '#202c33',
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendButton: {
    width: 46,
    minWidth: 46,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#00a884',
  },
  sendButtonDisabled: {
    backgroundColor: '#2a3942',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    padding: 12,
  },
  emptyChatPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});
