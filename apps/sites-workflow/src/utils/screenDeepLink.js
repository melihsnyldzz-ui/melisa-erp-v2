export function readScreenDeepLink(search, screenRegistry, allowedScreenIds = null) {
  const params = new URLSearchParams(search || '');
  const screenId = params.get('screen') || '';

  if (!screenId || !screenRegistry?.[screenId]) {
    return null;
  }

  if (allowedScreenIds && !allowedScreenIds.has(screenId)) {
    return null;
  }

  const payload = screenId === 'stock-list'
    ? {
      stockCode: params.get('stockCode') || '',
      sourceId: params.get('sourceId') || '',
    }
    : {};

  return { screenId, payload };
}

export function buildScreenDeepLink(search, screenId) {
  const params = new URLSearchParams(search || '');

  if (screenId) {
    params.set('screen', screenId);
  } else {
    params.delete('screen');
  }

  if (screenId !== 'stock-list') {
    params.delete('stockCode');
    params.delete('sourceId');
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}
