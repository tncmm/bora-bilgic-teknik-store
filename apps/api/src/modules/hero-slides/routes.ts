import { Router } from 'express';

import { HeroSlidesController } from './hero-slides.controller.js';

const router = Router();
const controller = new HeroSlidesController();

router.get('/hero-slides', controller.listActive);

export { router as heroSlidesRoutes };
