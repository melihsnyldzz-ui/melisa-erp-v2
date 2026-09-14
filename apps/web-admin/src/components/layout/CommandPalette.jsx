import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Boxes, ClipboardList, Contact, Monitor, ReceiptText, Search, Truck } from 'lucide-react';
import { searchErpRecords } from '../../services/quickSearchApi.js';
import { screenTypeLabel } from '../../utils/screenLabels.js';
import { normalizeSearchText } from '../../utils/searchText.js';
import { buildScreenCommands } from '../../utils/navigationCommands.js';

const resultIcons = {
  screen: Monitor,
  product: Boxes,
  customer: Contact,
  supplier: Truck,
  'sales-invoice': ReceiptText,
  'purchase-invoice': ClipboardList,
};

export function CommandPalette({ isOpen, onClose, onOpenScreen }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recordResults, setRecordResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [failedSourceCount, setFailedSourceCount] = useState(0);
  const inputRef = useRef(null);
  const searchSequenceRef = useRef(0);
  const commands = useMemo(() => buildScreenCommands(screenTypeLabel), []);
  const screenResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    if (!normalizedQuery) return commands.slice(0, 12);
    return commands.filter((command) => (
      normalizeSearchText(`${command.label} ${command.module} ${command.group} ${command.hint}`).includes(normalizedQuery)
    )).slice(0, 6);
  }, [commands, query]);
  const results = useMemo(() => [...screenResults, ...recordResults].slice(0, 26), [recordResults, screenResults]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setActiveIndex(0);
    setRecordResults([]);
    setFailedSourceCount(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => { setActiveIndex(0); }, [query, recordResults]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const sequence = ++searchSequenceRef.current;
    if (!isOpen || trimmedQuery.length < 2) {
      setRecordResults([]);
      setFailedSourceCount(0);
      setIsSearching(false);
      return undefined;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchErpRecords(trimmedQuery);
        if (cancelled || searchSequenceRef.current !== sequence) return;
        setRecordResults(response.results || []);
        setFailedSourceCount(response.failedSources?.length || 0);
      } catch {
        if (cancelled || searchSequenceRef.current !== sequence) return;
        setRecordResults([]);
        setFailedSourceCount(1);
      } finally {
        if (!cancelled && searchSequenceRef.current === sequence) setIsSearching(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isOpen, query]);

  if (!isOpen) return null;

  function openCommand(command) {
    if (!command) return;
    onOpenScreen(command.screenId, command.payload || {});
    onClose();
  }
  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, Math.min(current + 1, results.length - 1)));
    }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); openCommand(results[activeIndex]); }
  }

  return (
    <div className="command-palette-backdrop" onMouseDown={onClose} role="presentation">
      <section aria-label="Hızlı bul" className="command-palette" onKeyDown={handleKeyDown} onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search-row">
          <Search size={18} />
          <input aria-label="Ekran veya kayıt ara" onChange={(event) => setQuery(event.target.value)} placeholder="Ürün, barkod, cari, tedarikçi, fiş veya ekran ara" ref={inputRef} value={query} />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results" role="listbox">
          {query.trim().length === 1 && <div className="command-search-note">Kayıt aramak için en az 2 karakter yazın.</div>}
          {isSearching && <div className="command-search-note" role="status">Kayıtlar aranıyor...</div>}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && <div className="command-empty">Sonuç bulunamadı</div>}
          {failedSourceCount > 0 && <div className="command-search-warning" role="status">Bazı kayıt kaynaklarına ulaşılamadı; bulunan sonuçlar gösteriliyor.</div>}
          {results.map((command, index) => {
            const ResultIcon = resultIcons[command.kind] || Search;
            return (
              <button aria-selected={index === activeIndex} className={index === activeIndex ? 'command-result active' : 'command-result'} key={`${command.id || command.screenId}-${command.label}`} onClick={() => openCommand(command)} role="option" type="button">
                <span className={`command-result-icon ${command.kind || 'screen'}`} aria-hidden="true"><ResultIcon size={16} /></span>
                <span className="command-result-copy"><strong>{command.label}</strong><small>{command.typeLabel || command.module} · {command.hint}</small></span>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
