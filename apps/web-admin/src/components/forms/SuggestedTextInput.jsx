import React, { useId, useMemo } from 'react';
import { normalizeSearchText } from '../../utils/searchText.js';

function normalizeOption(value) {
  return String(value || '').trim();
}

function buildOptions(options, maxOptions) {
  const seen = new Set();

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
    .sort((first, second) => first.localeCompare(second, 'tr-TR'))
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
  const inputId = useId();
  const listId = `${name || 'suggested'}-${inputId}`;
  const optionItems = useMemo(() => buildOptions(options, maxOptions), [maxOptions, options]);

  return (
    <span className="suggested-input-wrap">
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        list={optionItems.length > 0 ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {optionItems.length > 0 && (
        <datalist id={listId}>
          {optionItems.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </span>
  );
}
