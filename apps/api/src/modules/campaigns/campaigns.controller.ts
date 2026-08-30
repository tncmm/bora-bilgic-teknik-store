import { Request, Response } from 'express';

import { CampaignsService } from './campaigns.service.js';

export class CampaignsController {
  constructor(private readonly service = new CampaignsService()) {}

  listActive = async (_req: Request, res: Response) => {
    const campaigns = await this.service.listActive();
    res.json(campaigns);
  };

  listAll = async (_req: Request, res: Response) => {
    const campaigns = await this.service.listAll();
    res.json(campaigns);
  };

  create = async (req: Request, res: Response) => {
    const campaign = await this.service.create(req.body);
    res.status(201).json(campaign);
  };

  update = async (req: Request, res: Response) => {
    const campaign = await this.service.update(String(req.params.id), req.body);
    res.json(campaign);
  };

  delete = async (req: Request, res: Response) => {
    await this.service.delete(String(req.params.id));
    res.status(204).send();
  };
}
