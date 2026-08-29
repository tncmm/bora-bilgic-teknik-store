import { Request, Response } from 'express';

import { OrdersService } from './orders.service.js';

export class OrdersController {
  constructor(private readonly service = new OrdersService()) {}

  listMyOrders = async (req: Request, res: Response) => {
    const orders = await this.service.listOrdersForUser(req.auth!.userId);
    res.json(orders);
  };

  getMyOrder = async (req: Request, res: Response) => {
    const order = await this.service.getOrderForUser(req.auth!.userId, String(req.params.orderId));
    res.json(order);
  };
}
