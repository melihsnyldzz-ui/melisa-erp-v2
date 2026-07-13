import { Router } from 'express';
import { postEvolutionWebhook } from '../controllers/webhookController.js';
import { requireWebhookSecret } from '../middleware/webhookSecurity.js';

export const webhookRoutes = Router();

webhookRoutes.post('/webhooks/evolution', requireWebhookSecret, postEvolutionWebhook);
