import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { CartController } from './cart.controller.js';

const router = Router();
const controller = new CartController();

router.use(requireAuth);
router.get('/', controller.getCart);
router.post('/items', controller.addItem);
router.patch('/items/:id', controller.updateItem);
router.delete('/items/:id', controller.removeItem);

export { router as cartRoutes };
