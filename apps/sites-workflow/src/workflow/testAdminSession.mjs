export const testSessionModeKey = 'melisaTestSessionMode';
export function shouldAutoOpenTestAdmin({ location, apiBase, mode }) {
  return ['127.0.0.1', 'localhost'].includes(location.hostname)
    && location.protocol === 'http:' && location.port === '5194'
    && apiBase === 'http://127.0.0.1:4144' && mode !== 'manual';
}
