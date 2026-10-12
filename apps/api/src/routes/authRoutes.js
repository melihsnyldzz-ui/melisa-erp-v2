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
  semihBrowserSessionHandlers,
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
authRoutes.post('/auth/semih-browser/enroll',requireAuth,semihBrowserSessionHandlers.enroll);
authRoutes.get('/auth/semih-browser/remembered',semihBrowserSessionHandlers.remembered);
authRoutes.post('/auth/semih-browser/restore',semihBrowserSessionHandlers.restore);
authRoutes.post('/auth/semih-browser/logout',semihBrowserSessionHandlers.logout);
