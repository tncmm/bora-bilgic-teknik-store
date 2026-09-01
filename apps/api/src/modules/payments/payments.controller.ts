import { Request, Response } from 'express';

import { PaymentsService } from './payments.service.js';

export class PaymentsController {
  constructor(private readonly service = new PaymentsService()) {}

  checkout = async (req: Request, res: Response) => {
    const result = await this.service.createCheckout(req.auth?.userId, req.auth?.email, req.body, req.ip ?? '');
    res.status(201).json(result);
  };

  status = async (req: Request, res: Response) => {
    const result = await this.service.getStatus(String(req.params.merchantOid), req.auth?.userId);
    res.json(result);
  };

  callback = async (req: Request, res: Response) => {
    console.log('[PAYTR] Callback received', {
      merchantOid: req.body?.merchant_oid,
      status: req.body?.status,
      totalAmount: req.body?.total_amount,
      host: req.headers.host,
    });
    await this.service.handleCallback(req.body as Record<string, unknown>);
    // PayTR treats anything but the literal "OK" as a failure and retries.
    res.type('text/plain').send('OK');
  };
}
