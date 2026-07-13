import { Router } from 'express';
import { contactRoutes } from './contactRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { inboxRoutes } from './inboxRoutes.js';
import { sendRoutes } from './sendRoutes.js';
import { webhookRoutes } from './webhookRoutes.js';

export const routes = Router();

routes.use(healthRoutes);
routes.use(inboxRoutes);
routes.use(sendRoutes);
routes.use(contactRoutes);
routes.use(webhookRoutes);
