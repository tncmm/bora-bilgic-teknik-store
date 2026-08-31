import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { jsonBodyUnlessLarge } from './middleware/json-body.js';
import { adminRoutes } from './modules/admin/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { cartRoutes } from './modules/cart/routes.js';
import { campaignsRoutes } from './modules/campaigns/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { heroSlidesRoutes } from './modules/hero-slides/routes.js';
import { ordersRoutes } from './modules/orders/routes.js';
import { paymentsRoutes } from './modules/payments/routes.js';
import { usersRoutes } from './modules/users/routes.js';

export function createApp() {
  const app = express();

  // The client IP feeds PayTR token requests; take it from X-Forwarded-For
  // when the API sits behind Render (or any single reverse proxy).
  app.set('trust proxy', 1);

  const allowedOrigins = new Set([
    env.WEB_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(jsonBodyUnlessLarge);
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', catalogRoutes);
  app.use('/api/v1', campaignsRoutes);
  app.use('/api/v1', heroSlidesRoutes);
  app.use('/api/v1/cart', cartRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use(errorHandler);

  return app;
}
