import cors from 'cors';
import express from 'express';
import { apiRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { requestContext } from './middleware/requestContext.js';
import { apiRateLimit, corsOptions, securityHeaders } from './middleware/security.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders());
  app.use(cors(corsOptions()));
  app.use(requestContext);
  app.use(apiRateLimit());
  app.use(express.json({ limit: env.requestBodyLimit }));

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
