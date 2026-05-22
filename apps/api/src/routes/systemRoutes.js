import { Router } from 'express';
import { getHealth, getVersion } from '../controllers/systemController.js';

export const systemRoutes = Router();

systemRoutes.get('/health', getHealth);
systemRoutes.get('/version', getVersion);
