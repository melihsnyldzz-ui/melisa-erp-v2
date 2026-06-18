import React, { useId, useMemo } from 'react';

function normalizeOption(value) {
  return String(value || '').trim();
}

function buildOptions(options) {
  const seen = new Set();

  return (options || [])
    .map(normalizeOption)
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLocaleLowerCase('tr-TR');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.localeCompare(second, 'tr-TR'))
    .slice(0, 40);
}

export function SuggestedTextInput({
  ariaLabel,
  disabled = false,
  name,
  onChange,
  options,
  placeholder,
  value,
}) {
  const inputId = useId();
  const listId = `${name || 'suggested'}-${inputId}`;
  const optionItems = useMemo(() => buildOptions(options), [options]);

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
