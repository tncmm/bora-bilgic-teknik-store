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

  trackOrder = async (req: Request, res: Response) => {
    const order = await this.service.getOrderByTrackingToken(String(req.params.token));
    res.json(order);
  };

  createMyRefundRequest = async (req: Request, res: Response) => {
    const order = await this.service.createRefundRequestForUser(req.auth!.userId, String(req.params.orderId), req.body);
    res.status(201).json(order);
  };

  createTrackedRefundRequest = async (req: Request, res: Response) => {
    const order = await this.service.createRefundRequestByTrackingToken(String(req.params.token), req.body);
    res.status(201).json(order);
  };
}
