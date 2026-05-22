import { Router } from 'express';
import { getSqlHealth, getSqlTablesPreview } from '../controllers/sqlHealthController.js';

export const sqlHealthRoutes = Router();

sqlHealthRoutes.get('/sql/health', getSqlHealth);
sqlHealthRoutes.get('/sql/tables-preview', getSqlTablesPreview);
