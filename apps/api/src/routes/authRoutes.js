import { Router } from 'express';
import {
  getMe,
  postLocalPasswordlessAdminLogin,
  postLogin,
  postLogout,
  postRefresh,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/login', postLogin);
authRoutes.post('/auth/local-passwordless-admin', postLocalPasswordlessAdminLogin);
authRoutes.post('/auth/logout', postLogout);
authRoutes.post('/auth/refresh', postRefresh);
authRoutes.get('/auth/me', requireAuth, getMe);
