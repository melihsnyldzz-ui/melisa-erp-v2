import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getUserById } from '../services/authService.js';
import { assertTestAdminRequest, testAdminClaims, testAdminUser } from '../services/canonicalTestAdminSession.mjs';

export function createCanonicalTestAdminRoutes() {
  const router = Router();
  router.post('/auth/test-admin', async (req, res, next) => {
    try {
      assertTestAdminRequest(req, { bootstrap: true });
      const user = testAdminUser(await getUserById(16));
      const accessToken = jwt.sign(testAdminClaims, env.auth.jwtSecret, { expiresIn: env.auth.accessExpiresIn });
      res.json({ success: true, data: { user, accessToken, refreshToken: null, tokenType: 'Bearer', expiresIn: env.auth.accessExpiresIn }, meta: { source: 'canonical-test-admin' } });
    } catch (error) { next(error); }
  });
  return router;
}
