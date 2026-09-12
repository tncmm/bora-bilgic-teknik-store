import { Router } from 'express';

import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { ShippingController } from './shipping.controller.js';

const router = Router();
const controller = new ShippingController();

router.use(requireAuth, requireAdmin);

// app.ts icerisinde /api/v1/admin altina baglanir; admin siparis islemleriyle
// ayni koruma zincirini (requireAuth + requireAdmin) kullanir.
router.post('/orders/:id/shipment', controller.createShipment);
router.post('/orders/:id/shipment/sync', controller.syncShipment);
router.post('/orders/:id/shipment/cancel', controller.cancelShipment);
router.post('/refunds/:refundId/return-code', controller.createReturnCode);

export { router as shippingRoutes };
