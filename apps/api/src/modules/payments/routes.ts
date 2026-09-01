import express, { Router } from 'express';

import { optionalAuth } from '../../middleware/auth.js';
import { PaymentsController } from './payments.controller.js';

const router = Router();
const controller = new PaymentsController();

router.post('/paytr/checkout', optionalAuth, controller.checkout);
router.get('/paytr/status/:merchantOid', optionalAuth, controller.status);

// Server-to-server notification: PayTR has no session cookie or bearer token,
// authenticity comes from the HMAC hash verified inside the service. The body
// arrives as form-urlencoded, not JSON.
router.post('/paytr/callback', express.urlencoded({ extended: false }), controller.callback);

export { router as paymentsRoutes };
