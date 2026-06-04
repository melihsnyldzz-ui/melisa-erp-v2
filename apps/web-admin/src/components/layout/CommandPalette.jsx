import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { screenRegistry, sidebarGroups } from '../../data/mockNavigationData.js';

const pinnedCommands = [
  { label: 'Yeni Satış Fişi', screenId: 'sales-invoice', hint: 'Satış işlemi ekranını aç' },
  { label: 'Stok Listesi', screenId: 'stock-list', hint: 'Ürün ve depo durumunu gör' },
  { label: 'Cari Listesi', screenId: 'customer-list', hint: 'Müşteri ve tedarikçi kartları' },
  { label: 'Rapor Merkezi', screenId: 'reports-overview', hint: 'Yönetim ve operasyon raporları' },
];

function normalize(value) {
  return value.toLocaleLowerCase('tr-TR');
}

function buildCommandList() {
  const sidebarCommands = sidebarGroups.flatMap((group) => (
    group.items.map((item) => {
      const screen = screenRegistry[item.screenId];
      return {
        label: item.label,
        screenId: item.screenId,
        group: group.title,
        module: screen.module || group.title,
        hint: screen.label || item.label,
      };
    })
  ));

  const registryCommands = Object.values(screenRegistry).map((screen) => ({
    label: screen.label,
    screenId: screen.id,
    group: screen.type,
    module: screen.module,
    hint: `${screen.module} / ${screen.type}`,
  }));

  const mergedCommands = [...pinnedCommands, ...sidebarCommands, ...registryCommands];
  const seen = new Set();

  return mergedCommands.filter((command) => {
    const key = `${command.label}-${command.screenId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function CommandPalette({ isOpen, onClose, onOpenScreen }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const commands = useMemo(buildCommandList, []);
  const results = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) {
      return commands.slice(0, 12);
    }

    return commands.filter((command) => (
      normalize(`${command.label} ${command.module} ${command.group} ${command.hint}`).includes(normalizedQuery)
    )).slice(0, 18);
  }, [commands, query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) {
    return null;
  }

  function openCommand(command) {
    if (!command) {
      return;
    }

    onOpenScreen(command.screenId);
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
        aria-label="Komut paleti"
        className="command-palette"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-search-row">
          <Search size={18} />
          <input
            aria-label="Ekran veya işlem ara"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ekran, fiş, rapor veya müşteri ara"
            ref={inputRef}
            value={query}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results" role="listbox">
          {results.length === 0 && (
            <div className="command-empty">Sonuç bulunamadı</div>
          )}
          {results.map((command, index) => (
            <button
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'command-result active' : 'command-result'}
              key={`${command.label}-${command.screenId}`}
              onClick={() => openCommand(command)}
              role="option"
              type="button"
            >
              <span>
                <strong>{command.label}</strong>
                <small>{command.module} · {command.hint}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
