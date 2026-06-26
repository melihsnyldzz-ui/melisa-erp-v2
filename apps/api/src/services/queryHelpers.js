export function parseListQuery(query, settings = {}) {
  const defaultLimit = Number(settings.defaultLimit || 20);
  const maxLimit = Number(settings.maxLimit || 100);
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || defaultLimit), 1), maxLimit);
  const offset = (page - 1) * limit;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const activeOnly = String(query.activeOnly || 'false').toLowerCase() === 'true';

  return {
    page,
    limit,
    offset,
    search,
    activeOnly,
    maxLimit,
  };
}

export function buildListMeta({ page, limit, offset, total, source, filters, maxLimit = 100 }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    hasNextPage: offset + limit < total,
    hasPreviousPage: page > 1,
    maxLimit,
    source,
    filters,
  };
}

export function maskValue(value, visibleStart = 3, visibleEnd = 2) {
  if (!value) {
    return null;
  }

  const text = String(value);
  if (text.length <= visibleStart + visibleEnd) {
    return '*'.repeat(text.length);
  }

  return `${text.slice(0, visibleStart)}${'*'.repeat(text.length - visibleStart - visibleEnd)}${text.slice(-visibleEnd)}`;
}

export function maskPhone(value) {
  if (!value) {
    return null;
  }

  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 7) {
    return maskValue(value, 2, 1);
  }

  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}
