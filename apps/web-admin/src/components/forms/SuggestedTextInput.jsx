import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeSearchText } from '../../utils/searchText.js';

function normalizeOption(value) {
  return String(value || '').trim();
}

function buildOptions(options, maxOptions, value) {
  const seen = new Set();
  const query = normalizeSearchText(value);

  return (options || [])
    .map(normalizeOption)
    .filter(Boolean)
    .filter((option) => {
      const key = normalizeSearchText(option);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .filter((option) => !query || normalizeSearchText(option).includes(query))
    .sort((first, second) => {
      const firstText = normalizeSearchText(first);
      const secondText = normalizeSearchText(second);
      const firstStarts = query && firstText.startsWith(query) ? 0 : 1;
      const secondStarts = query && secondText.startsWith(query) ? 0 : 1;
      return firstStarts - secondStarts || first.localeCompare(second, 'tr-TR');
    })
    .slice(0, maxOptions);
}

export function SuggestedTextInput({
  ariaLabel,
  disabled = false,
  invalid = false,
  name,
  maxOptions = 40,
  onChange,
  options,
  placeholder,
  portal = false,
  value,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState(null);
  const inputRef = useRef(null);
  const optionItems = useMemo(() => buildOptions(options, maxOptions, value), [maxOptions, options, value]);

  useEffect(() => {
    if (!isOpen || !portal) {
      setPortalStyle(null);
      return undefined;
    }

    function positionOptions() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const viewportGap = 8;
      const preferredHeight = 220;
      const belowSpace = window.innerHeight - rect.bottom - viewportGap;
      const aboveSpace = rect.top - viewportGap;
      const openAbove = belowSpace < 140 && aboveSpace > belowSpace;
      const availableHeight = Math.max(96, Math.min(preferredHeight, openAbove ? aboveSpace : belowSpace));

      setPortalStyle({
        left: `${Math.max(viewportGap, rect.left)}px`,
        top: openAbove ? 'auto' : `${rect.bottom + 4}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 4}px` : 'auto',
        width: `${Math.max(rect.width, 180)}px`,
        maxHeight: `${availableHeight}px`,
      });
    }

    positionOptions();
    window.addEventListener('resize', positionOptions);
    window.addEventListener('scroll', positionOptions, true);
    return () => {
      window.removeEventListener('resize', positionOptions);
      window.removeEventListener('scroll', positionOptions, true);
    };
  }, [isOpen, portal]);

  function selectOption(option) {
    onChange(option);
    setIsOpen(false);
  }

  const optionsElement = !disabled && isOpen && optionItems.length > 0 && (
    <span
      className={`suggested-options ${portal ? 'suggested-options-portal' : ''}`}
      role="listbox"
      style={portal ? portalStyle || { visibility: 'hidden' } : undefined}
    >
      {optionItems.map((option) => (
        <button
          key={option}
          onMouseDown={(event) => {
            event.preventDefault();
            selectOption(option);
          }}
          type="button"
        >
          {option}
        </button>
      ))}
    </span>
  );

  return (
    <span className={`suggested-input-wrap ${invalid ? 'is-invalid' : ''}`}>
      <input
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={disabled}
        name={name}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      {portal && optionsElement ? createPortal(optionsElement, document.body) : optionsElement}
    </span>
  );
}
