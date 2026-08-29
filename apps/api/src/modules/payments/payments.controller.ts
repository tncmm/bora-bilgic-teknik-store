import { Request, Response } from 'express';

import { PaymentsService } from './payments.service.js';

export class PaymentsController {
  constructor(private readonly service = new PaymentsService()) {}

  checkout = async (req: Request, res: Response) => {
    const result = await this.service.createCheckout(req.auth!.userId, req.body, req.ip ?? '');
    res.status(201).json(result);
  };

  callback = async (req: Request, res: Response) => {
    await this.service.handleCallback(req.body as Record<string, unknown>);
    // PayTR treats anything but the literal "OK" as a failure and retries.
    res.type('text/plain').send('OK');
  };
}
