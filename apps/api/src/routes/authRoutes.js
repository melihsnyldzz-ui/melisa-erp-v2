import { Router } from 'express';
import {
  getTerminalLoginUsers,
  getMe,
  postLocalPasswordlessAdminLogin,
  postLogin,
  postLogout,
  postRefresh,
  postTerminalLogin,
  postProtectedSessionConfirm,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRoutes = Router();

authRoutes.post('/auth/login', postLogin);
authRoutes.get('/auth/terminal-users', getTerminalLoginUsers);
authRoutes.post('/auth/terminal-login', postTerminalLogin);
authRoutes.post('/auth/local-passwordless-admin', postLocalPasswordlessAdminLogin);
authRoutes.post('/auth/logout', postLogout);
authRoutes.post('/auth/refresh', postRefresh);
authRoutes.get('/auth/me', requireAuth, getMe);
authRoutes.post('/auth/session-confirm',requireAuth,postProtectedSessionConfirm);
