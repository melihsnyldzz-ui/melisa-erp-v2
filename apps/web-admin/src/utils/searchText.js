export function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[I\u0130\u0131]/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0131/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function searchTextIncludes(value, filter) {
  const normalizedFilter = normalizeSearchText(filter);
  return !normalizedFilter || normalizeSearchText(value).includes(normalizedFilter);
}
