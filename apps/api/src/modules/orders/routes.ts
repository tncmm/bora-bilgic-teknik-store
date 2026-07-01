import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { OrdersController } from './orders.controller.js';

const router = Router();
const controller = new OrdersController();

router.use(requireAuth);
router.post('/', controller.createOrder);
router.get('/me', controller.listMyOrders);

export { router as ordersRoutes };
