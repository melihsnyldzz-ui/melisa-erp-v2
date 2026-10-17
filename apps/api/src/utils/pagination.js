export function getPagination(query, total) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const offset = (page - 1) * limit;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    page,
    limit,
    offset,
    total,
    totalPages,
  };
}

export function paginateRows(rows, query) {
  const pagination = getPagination(query, rows.length);
  const data = rows.slice(pagination.offset, pagination.offset + pagination.limit);
  const { offset, ...meta } = pagination;

  return {
    data,
    meta,
  };
}
