import { Request, Response } from 'express';

import { AdminService } from './admin.service.js';

export class AdminController {
  constructor(private readonly service = new AdminService()) {}

  dashboard = async (_req: Request, res: Response) => {
    const metrics = await this.service.getDashboardMetrics();
    res.json(metrics);
  };

  listProducts = async (_req: Request, res: Response) => {
    const products = await this.service.listProducts();
    res.json(products);
  };

  listCategories = async (_req: Request, res: Response) => {
    const categories = await this.service.listCategories();
    res.json(categories);
  };

  createProduct = async (req: Request, res: Response) => {
    const product = await this.service.createProduct(req.body);
    res.status(201).json(product);
  };

  uploadMedia = async (req: Request, res: Response) => {
    const media = await this.service.uploadMedia(req.body);
    res.status(201).json(media);
  };

  updateProduct = async (req: Request, res: Response) => {
    const product = await this.service.updateProduct(String(req.params.id), req.body);
    res.json(product);
  };

  deleteProduct = async (req: Request, res: Response) => {
    await this.service.deleteProduct(String(req.params.id));
    res.status(204).send();
  };

  updateSaleStatus = async (req: Request, res: Response) => {
    const product = await this.service.updateSaleStatus(String(req.params.id), req.body);
    res.json(product);
  };

  listOrders = async (_req: Request, res: Response) => {
    const orders = await this.service.listOrders();
    res.json(orders);
  };

  updateOrderStatus = async (req: Request, res: Response) => {
    const order = await this.service.updateOrderStatus(String(req.params.id), req.body);
    res.json(order);
  };

  listUsers = async (_req: Request, res: Response) => {
    const users = await this.service.listUsers();
    res.json(users);
  };
}
