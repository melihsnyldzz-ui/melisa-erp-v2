export function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[Iİı]/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function searchTextIncludes(value, filter) {
  const normalizedFilter = normalizeSearchText(filter);
  return !normalizedFilter || normalizeSearchText(value).includes(normalizedFilter);
}
