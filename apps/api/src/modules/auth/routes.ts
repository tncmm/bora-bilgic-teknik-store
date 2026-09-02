import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import {
  loginLimiter,
  logoutLimiter,
  refreshLimiter,
  registerLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,
} from '../../middleware/rate-limit.js';
import { AuthController } from './auth.controller.js';

const router = Router();
const controller = new AuthController();

router.post('/register', registerLimiter, controller.register);
router.post('/verify-email', verifyEmailLimiter, controller.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, controller.resendVerification);
router.post('/login', loginLimiter, controller.login);
router.post('/refresh', refreshLimiter, controller.refresh);
router.post('/logout', logoutLimiter, controller.logout);
router.get('/me', requireAuth, controller.me);

export { router as authRoutes };
