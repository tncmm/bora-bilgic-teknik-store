import { Router } from 'express';

import { CampaignsController } from './campaigns.controller.js';

const router = Router();
const controller = new CampaignsController();

router.get('/campaigns', controller.listActive);

export { router as campaignsRoutes };
