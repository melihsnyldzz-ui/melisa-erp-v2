import { listInboxOverview } from '../repositories/crmRepository.js';

export async function getInboxOverview(options = {}) {
  return listInboxOverview(options);
}
