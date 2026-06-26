import React, { useMemo, useState } from 'react';
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
  name,
  maxOptions = 40,
  onChange,
  options,
  placeholder,
  value,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const optionItems = useMemo(() => buildOptions(options, maxOptions, value), [maxOptions, options, value]);

  function selectOption(option) {
    onChange(option);
    setIsOpen(false);
  }

  return (
    <span className="suggested-input-wrap">
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        name={name}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        value={value}
      />
      {!disabled && isOpen && optionItems.length > 0 && (
        <span className="suggested-options" role="listbox">
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
      )}
    </span>
  );
}
