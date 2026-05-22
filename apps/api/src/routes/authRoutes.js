import { Router } from 'express';
import { getMe, postLogin, postLogout, postRefresh } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/login', postLogin);
authRoutes.post('/auth/logout', postLogout);
authRoutes.post('/auth/refresh', postRefresh);
authRoutes.get('/auth/me', requireAuth, getMe);
