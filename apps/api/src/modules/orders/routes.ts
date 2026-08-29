import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { OrdersController } from './orders.controller.js';

const router = Router();
const controller = new OrdersController();

router.use(requireAuth);
router.get('/me', controller.listMyOrders);
router.get('/me/:orderId', controller.getMyOrder);

export { router as ordersRoutes };
