import { Request, Response } from 'express';

import { HeroSlidesService } from './hero-slides.service.js';

export class HeroSlidesController {
  constructor(private readonly service = new HeroSlidesService()) {}

  listActive = async (_req: Request, res: Response) => {
    const slides = await this.service.listActive();
    res.json(slides);
  };

  listAll = async (_req: Request, res: Response) => {
    const slides = await this.service.listAll();
    res.json(slides);
  };

  create = async (req: Request, res: Response) => {
    const slide = await this.service.create(req.body);
    res.status(201).json(slide);
  };

  update = async (req: Request, res: Response) => {
    const slide = await this.service.update(String(req.params.id), req.body);
    res.json(slide);
  };

  delete = async (req: Request, res: Response) => {
    await this.service.delete(String(req.params.id));
    res.status(204).send();
  };
}
