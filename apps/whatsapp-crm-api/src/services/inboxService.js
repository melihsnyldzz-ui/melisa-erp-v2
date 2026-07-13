export function getInboxOverview() {
  return {
    conversations: [],
    summary: {
      open: 0,
      unread: 0,
      pendingHumanReply: 0,
      source: 'sprint-001-skeleton',
    },
    boundaries: [
      'No real WhatsApp send action exists in Sprint 001.',
      'CRM does not write to ERP stock, finance or order tables directly.',
      'ERP mutations must go through existing ERP API endpoints in later approved sprints.',
      'Use a test WhatsApp number before connecting the main company number.',
    ],
  };
}
