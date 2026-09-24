import express, { Router } from 'express';

import { optionalAuth } from '../../middleware/auth.js';
import { PaymentsController } from './payments.controller.js';

const router = Router();
const controller = new PaymentsController();

router.post('/paytr/checkout', optionalAuth, controller.checkout);
// Ownership comes from the ?t= tracking token; optionalAuth additionally
// supplies req.auth when a valid session exists so the response can carry
// belongsToAccount (frontend decides between account page and tracking URL).
router.get('/paytr/status/:merchantOid', optionalAuth, controller.status);

// Server-to-server notification: PayTR has no session cookie or bearer token,
// authenticity comes from the HMAC hash verified inside the service. The body
// arrives as form-urlencoded, not JSON.
router.post('/paytr/callback', express.urlencoded({ extended: false }), controller.callback);

export { router as paymentsRoutes };
