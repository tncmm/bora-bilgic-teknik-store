import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { AuthController } from './auth.controller.js';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

export { router as authRoutes };
