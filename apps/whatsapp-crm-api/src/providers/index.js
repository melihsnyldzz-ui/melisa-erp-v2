import { env } from '../config/env.js';
import { EvolutionProvider } from './evolutionProvider.js';

export function getWhatsAppProvider() {
  if (env.whatsapp.provider === 'evolution') {
    return new EvolutionProvider();
  }

  const error = new Error(`Unsupported WhatsApp provider: ${env.whatsapp.provider}`);
  error.code = 'WHATSAPP_CRM_PROVIDER_UNSUPPORTED';
  error.statusCode = 503;
  throw error;
}
