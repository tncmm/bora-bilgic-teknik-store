import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { UsersController } from './users.controller.js';

const router = Router();
const controller = new UsersController();

router.use(requireAuth);
router.get('/me', controller.getProfile);
router.patch('/theme', controller.updateTheme);
router.get('/addresses', controller.listAddresses);
router.post('/addresses', controller.createAddress);
router.patch('/addresses/:addressId', controller.updateAddress);
router.delete('/addresses/:addressId', controller.deleteAddress);
router.get('/favorites', controller.getFavorites);
router.post('/favorites/items', controller.addFavorite);
router.delete('/favorites/items/:productId', controller.removeFavorite);

export { router as usersRoutes };
