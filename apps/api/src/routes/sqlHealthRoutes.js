import { Router } from 'express';
import { getSqlHealth, getSqlTablesPreview } from '../controllers/sqlHealthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const sqlHealthRoutes = Router();

sqlHealthRoutes.get('/sql/health', requireAuth, getSqlHealth);
sqlHealthRoutes.get('/sql/tables-preview', requireAuth, getSqlTablesPreview);
