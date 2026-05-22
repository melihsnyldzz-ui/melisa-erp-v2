import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { apiRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
