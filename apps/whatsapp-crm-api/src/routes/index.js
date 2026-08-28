import { Router } from 'express';
import { contactRoutes } from './contactRoutes.js';
import { crmAccessRoutes } from './crmAccessRoutes.js';
import { conversationRoutes } from './conversationRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { inboxRoutes } from './inboxRoutes.js';
import { integrationRoutes } from './integrationRoutes.js';
import { mediaRoutes } from './mediaRoutes.js';
import { sendRoutes } from './sendRoutes.js';
import { webhookRoutes } from './webhookRoutes.js';
import { requireCrmAuth } from '../middleware/auth.js';
import { requireCrmUnlock } from '../middleware/crmAccess.js';

export const routes = Router();

routes.use(healthRoutes);
routes.use(crmAccessRoutes);
routes.use('/crm', requireCrmAuth, requireCrmUnlock);
routes.use(inboxRoutes);
routes.use(integrationRoutes);
routes.use(mediaRoutes);
routes.use(sendRoutes);
routes.use(conversationRoutes);
routes.use(contactRoutes);
routes.use(webhookRoutes);
