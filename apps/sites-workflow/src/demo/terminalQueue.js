export const TERMINAL_QUEUE_KEY = 'melisa.terminal-demo.queue.v1';

export function readTerminalQueue(storage) {
  const raw = storage.getItem(TERMINAL_QUEUE_KEY);
  if (!raw) return [];
  let rows;
  try { rows = JSON.parse(raw); } catch { throw Error('Terminal kuyruğu okunamadı; kayıt korunuyor.'); }
  if (!Array.isArray(rows) || rows.some(row => !row.requestId || !row.command)) throw Error('Terminal kuyruğu bozuk; kayıt korunuyor.');
  return rows;
}

export function writeTerminalQueue(storage, rows) {
  storage.setItem(TERMINAL_QUEUE_KEY, JSON.stringify(rows));
  return rows;
}

export function queueTerminalTicket(storage, kind, input, actorRole, requestId) {
  if (!/^[\w-]{8,100}$/.test(requestId)) throw Error('Terminal fiş kimliği geçersiz.');
  const rows = readTerminalQueue(storage);
  if (rows.some(row => row.requestId === requestId)) throw Error('Bu fiş zaten kuyrukta.');
  const ticket = { requestId, command: { type: 'terminal-submit', kind, input, actorRole, requestId }, status: 'pending', createdAt: new Date().toISOString() };
  writeTerminalQueue(storage, [...rows, ticket]);
  return ticket;
}

export async function flushTerminalTicket(storage, requestId, dispatch, current) {
  const ticket = readTerminalQueue(storage).find(row => row.requestId === requestId);
  if (!ticket) throw Error('Terminal fişi kuyrukta yok.');
  if (ticket.status === 'sent') return ticket;
  // The browser may close after commit, before queue acknowledgement. Never
  // submit again with a new ID: repository receipts identify the original.
  const receipt = current().commandReceipts?.find(row => row.requestId === requestId);
  if (!receipt) {
    try { await dispatch(ticket.command); }
    catch (error) {
      const status = /başka bir sekmede değişti|stok|kalan|geçerliliği|sayım/i.test(error.message) ? 'conflict' : 'pending';
      writeTerminalQueue(storage, readTerminalQueue(storage).map(row => row.requestId === requestId ? { ...row, status, error: error.message } : row));
      throw error;
    }
  }
  const sent = { ...ticket, status: 'sent', error: null, sentAt: new Date().toISOString() };
  writeTerminalQueue(storage, readTerminalQueue(storage).map(row => row.requestId === requestId ? sent : row));
  return sent;
}

export function discardTerminalTicket(storage, requestId) {
  const ticket = readTerminalQueue(storage).find(row => row.requestId === requestId);
  if (ticket?.status === 'sent') throw Error('Gönderilmiş belge kuyruktan silinemez.');
  return writeTerminalQueue(storage, readTerminalQueue(storage).filter(row => row.requestId !== requestId));
}
