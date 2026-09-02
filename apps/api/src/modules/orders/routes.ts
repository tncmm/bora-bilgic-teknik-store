import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { OrdersController } from './orders.controller.js';

const router = Router();
const controller = new OrdersController();

router.get('/track/:token', controller.trackOrder);
router.post('/track/:token/refund-requests', controller.createTrackedRefundRequest);

router.use(requireAuth);
router.get('/me', controller.listMyOrders);
router.get('/me/:orderId', controller.getMyOrder);
router.post('/me/:orderId/refund-requests', controller.createMyRefundRequest);

export { router as ordersRoutes };
