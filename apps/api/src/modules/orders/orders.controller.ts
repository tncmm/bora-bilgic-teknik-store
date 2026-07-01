import { Request, Response } from 'express';

import { OrdersService } from './orders.service.js';

export class OrdersController {
  constructor(private readonly service = new OrdersService()) {}

  createOrder = async (req: Request, res: Response) => {
    const order = await this.service.createOrder(req.auth!.userId, req.body);
    res.status(201).json(order);
  };

  listMyOrders = async (req: Request, res: Response) => {
    const orders = await this.service.listOrdersForUser(req.auth!.userId);
    res.json(orders);
  };
}
