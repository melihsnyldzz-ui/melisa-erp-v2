import { Router } from 'express';
import { healthRoutes } from './healthRoutes.js';
import { inboxRoutes } from './inboxRoutes.js';
import { sendRoutes } from './sendRoutes.js';
import { webhookRoutes } from './webhookRoutes.js';

export const routes = Router();

routes.use(healthRoutes);
routes.use(inboxRoutes);
routes.use(sendRoutes);
routes.use(webhookRoutes);
