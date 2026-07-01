import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { adminRoutes } from './modules/admin/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { cartRoutes } from './modules/cart/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { ordersRoutes } from './modules/orders/routes.js';
import { usersRoutes } from './modules/users/routes.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', catalogRoutes);
  app.use('/api/v1/cart', cartRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use(errorHandler);

  return app;
}
