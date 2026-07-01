import { Request, Response } from 'express';

import { CatalogService } from './catalog.service.js';

export class CatalogController {
  constructor(private readonly service = new CatalogService()) {}

  listProducts = async (req: Request, res: Response) => {
    const products = await this.service.listProducts(req.query as Record<string, string | undefined>);
    res.json(products);
  };

  getProduct = async (req: Request, res: Response) => {
    const product = await this.service.getProduct(String(req.params.slug));
    res.json(product);
  };

  listCategories = async (_req: Request, res: Response) => {
    const categories = await this.service.listCategories();
    res.json(categories);
  };
}
