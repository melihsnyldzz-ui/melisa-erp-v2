import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Contact,
  Monitor,
  ReceiptText,
  Search,
  Truck,
} from 'lucide-react';
import { screenRegistry, sidebarGroups } from '../../data/mockNavigationData.js';
import { searchErpRecords } from '../../services/quickSearchApi.js';
import { screenTypeLabel } from '../../utils/screenLabels.js';
import { normalizeSearchText } from '../../utils/searchText.js';
import { apiConfig } from '../../config/apiConfig.js';
import { isScreenAvailable } from '../../config/runtimeCapabilities.js';

const pinnedCommands = [
  { label: 'Yeni Satış Fişi', screenId: 'sales-invoice', hint: 'Satış işlemi ekranını aç' },
  { label: 'Stok Listesi', screenId: 'stock-list', hint: 'Ürün ve depo durumunu gör' },
  { label: 'Müşteri Cari Listesi', screenId: 'customer-list', hint: 'Müşteri kartları ve bakiyeleri' },
  { label: 'Stok Girişi Hazırlığı', screenId: 'bulk-purchase-entry', hint: 'Ürünleri hazırla, tek alış fişine aktar' },
  { label: 'Rapor Merkezi', screenId: 'reports-overview', hint: 'Yönetim ve operasyon raporları' },
];

const resultIcons = {
  screen: Monitor,
  product: Boxes,
  customer: Contact,
  supplier: Truck,
  'sales-invoice': ReceiptText,
  'purchase-invoice': ClipboardList,
};

function normalize(value) {
  return normalizeSearchText(value);
}

export function buildCommandList() {
  const sidebarCommands = sidebarGroups.flatMap((group) => (
    group.items.map((item) => {
      const screen = screenRegistry[item.screenId];
      return {
        id: `screen-${item.screenId}`,
        kind: 'screen',
        typeLabel: 'Ekran',
        label: item.label,
        screenId: item.screenId,
        group: group.title,
        module: screen.module || group.title,
        hint: screen.label || item.label,
      };
    })
  ));

  const registryCommands = Object.values(screenRegistry).map((screen) => ({
    id: `screen-${screen.id}`,
    kind: 'screen',
    typeLabel: 'Ekran',
    label: screen.label,
    screenId: screen.id,
    group: screenTypeLabel(screen.type),
    module: screen.module,
    hint: `${screen.module} / ${screenTypeLabel(screen.type)}`,
  }));

  const mergedCommands = [
    ...pinnedCommands.map((command) => ({
      ...command,
      id: `screen-${command.screenId}`,
      kind: 'screen',
      typeLabel: 'Ekran',
      module: screenRegistry[command.screenId]?.module || 'ERP',
      group: 'Hızlı işlem',
    })),
    ...sidebarCommands,
    ...registryCommands,
  ];
  const seen = new Set();

  return mergedCommands.filter((command) => {
    const key = command.screenId;
    if (!isScreenAvailable(key, apiConfig)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CommandPalette({ isOpen, onClose, onOpenScreen }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recordResults, setRecordResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [failedSourceCount, setFailedSourceCount] = useState(0);
  const inputRef = useRef(null);
  const searchSequenceRef = useRef(0);
  const commands = useMemo(buildCommandList, []);
  const screenResults = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return commands.slice(0, 12);

    return commands.filter((command) => (
      normalize(`${command.label} ${command.module} ${command.group} ${command.hint}`).includes(normalizedQuery)
    )).slice(0, 6);
  }, [commands, query]);
  const results = useMemo(
    () => [...screenResults, ...recordResults].slice(0, 26),
    [recordResults, screenResults],
  );

  useEffect(() => {
    if (!isOpen) return;

    setQuery('');
    setActiveIndex(0);
    setRecordResults([]);
    setFailedSourceCount(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, recordResults]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const sequence = searchSequenceRef.current + 1;
    searchSequenceRef.current = sequence;

    if (!isOpen || trimmedQuery.length < 2) {
      setRecordResults([]);
      setFailedSourceCount(0);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      const response = await searchErpRecords(trimmedQuery);
      if (searchSequenceRef.current !== sequence) return;
      setRecordResults(response.results);
      setFailedSourceCount(response.failedSources.length);
      setIsSearching(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isOpen, query]);

  if (!isOpen) return null;

  function openCommand(command) {
    if (!command) return;
    onOpenScreen(command.screenId, command.payload || {});
    onClose();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.min(currentIndex + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      openCommand(results[activeIndex]);
    }
  }

  return (
    <div className="command-palette-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label="Hızlı bul"
        className="command-palette"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-search-row">
          <Search size={18} />
          <input
            aria-label="Ekran veya kayıt ara"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün, barkod, cari, tedarikçi, fiş veya ekran ara"
            ref={inputRef}
            value={query}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results" role="listbox">
          {query.trim().length === 1 && (
            <div className="command-search-note">Kayıt aramak için en az 2 karakter yazın.</div>
          )}
          {isSearching && (
            <div className="command-search-note" role="status">Kayıtlar aranıyor...</div>
          )}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <div className="command-empty">Sonuç bulunamadı</div>
          )}
          {failedSourceCount > 0 && (
            <div className="command-search-warning" role="status">
              Bazı kayıt kaynaklarına ulaşılamadı; bulunan sonuçlar gösteriliyor.
            </div>
          )}
          {results.map((command, index) => {
            const ResultIcon = resultIcons[command.kind] || Search;
            return (
              <button
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'command-result active' : 'command-result'}
                key={`${command.id || command.screenId}-${command.label}`}
                onClick={() => openCommand(command)}
                role="option"
                type="button"
              >
                <span className={`command-result-icon ${command.kind || 'screen'}`} aria-hidden="true">
                  <ResultIcon size={16} />
                </span>
                <span className="command-result-copy">
                  <strong>{command.label}</strong>
                  <small>{command.typeLabel || command.module} · {command.hint}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
