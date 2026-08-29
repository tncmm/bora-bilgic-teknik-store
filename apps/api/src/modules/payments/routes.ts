import express, { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { PaymentsController } from './payments.controller.js';

const router = Router();
const controller = new PaymentsController();

router.post('/paytr/token', requireAuth, controller.createToken);

// Server-to-server notification: PayTR has no session cookie or bearer token,
// authenticity comes from the HMAC hash verified inside the service. The body
// arrives as form-urlencoded, not JSON.
router.post('/paytr/callback', express.urlencoded({ extended: false }), controller.callback);

export { router as paymentsRoutes };
