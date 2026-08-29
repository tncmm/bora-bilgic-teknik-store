import { Router } from 'express';

import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { largeJsonBody } from '../../middleware/json-body.js';
import { AdminController } from './admin.controller.js';

const router = Router();
const controller = new AdminController();

router.use(requireAuth, requireAdmin);

router.get('/dashboard', controller.dashboard);
router.get('/products', controller.listProducts);
router.get('/categories', controller.listCategories);
// Mounted after requireAuth/requireAdmin on purpose: the large body limit is
// only ever reachable by an authenticated admin.
router.post('/media/upload', largeJsonBody, controller.uploadMedia);
router.post('/products', controller.createProduct);
router.patch('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.patch('/products/:id/sale-status', controller.updateSaleStatus);
router.get('/orders', controller.listOrders);
router.patch('/orders/:id', controller.updateOrderStatus);
router.get('/users', controller.listUsers);

export { router as adminRoutes };
