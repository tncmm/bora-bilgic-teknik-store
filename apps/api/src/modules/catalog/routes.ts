import { Router } from 'express';

import { CatalogController } from './catalog.controller.js';

const router = Router();
const controller = new CatalogController();

router.get('/products', controller.listProducts);
router.get('/products/:slug', controller.getProduct);
router.get('/categories', controller.listCategories);

export { router as catalogRoutes };
