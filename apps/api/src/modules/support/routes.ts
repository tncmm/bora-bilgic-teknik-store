import { Router } from 'express';

import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { supportLimiter } from '../../middleware/rate-limit.js';
import { SupportController } from './support.controller.js';

const controller = new SupportController();

// app.ts /api/v1 altina baglanir; public form + token'li takip.
export const supportPublicRouter = Router();
supportPublicRouter.post('/support/tickets', supportLimiter, controller.createTicket);
supportPublicRouter.get('/support/tickets/by-token', controller.getTicket);

// Girisli kullanıcının kendi talepleri.
export const supportUserRouter = Router();
supportUserRouter.use(requireAuth);
supportUserRouter.get('/support/my-tickets', controller.myTickets);

// Admin yonetimi — requireAuth + requireAdmin guard'i icerir.
export const supportAdminRouter = Router();
supportAdminRouter.use(requireAuth, requireAdmin);
supportAdminRouter.get('/support-tickets', controller.adminList);
supportAdminRouter.patch('/support-tickets/:id', controller.adminUpdate);
