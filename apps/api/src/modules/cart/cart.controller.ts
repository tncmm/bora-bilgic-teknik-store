import { Request, Response } from 'express';

import { CartService } from './cart.service.js';

export class CartController {
  constructor(private readonly service = new CartService()) {}

  getCart = async (req: Request, res: Response) => {
    const cart = await this.service.getCart(req.auth!.userId);
    res.json(cart);
  };

  addItem = async (req: Request, res: Response) => {
    const cart = await this.service.addItem(req.auth!.userId, req.body);
    res.status(201).json(cart);
  };

  updateItem = async (req: Request, res: Response) => {
    const cart = await this.service.updateItem(req.auth!.userId, String(req.params.id), req.body);
    res.json(cart);
  };

  removeItem = async (req: Request, res: Response) => {
    const cart = await this.service.removeItem(req.auth!.userId, String(req.params.id));
    res.json(cart);
  };
}
