import { Request, Response } from 'express';

import { ShippingService } from './shipping.service.js';

export class ShippingController {
  constructor(private readonly service = new ShippingService()) {}

  createShipment = async (req: Request, res: Response) => {
    const shipment = await this.service.createShipmentForOrder(req.params.id);
    res.status(201).json(shipment);
  };

  syncShipment = async (req: Request, res: Response) => {
    const shipment = await this.service.syncShipmentForOrder(req.params.id);
    res.json(shipment);
  };

  cancelShipment = async (req: Request, res: Response) => {
    const shipment = await this.service.cancelShipmentForOrder(req.params.id);
    res.json(shipment);
  };

  createReturnCode = async (req: Request, res: Response) => {
    const result = await this.service.createReturnCodeForRefund(req.params.refundId);
    res.json(result);
  };
}
