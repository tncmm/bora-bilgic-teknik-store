import { Request, Response } from 'express';

import { SupportService } from './support.service.js';

export class SupportController {
  constructor(private readonly service = new SupportService()) {}

  createTicket = async (req: Request, res: Response) => {
    const result = await this.service.createTicket(req.auth?.userId, req.body);
    res.status(201).json(result);
  };

  getTicket = async (req: Request, res: Response) => {
    const ticket = await this.service.getTicketByToken(typeof req.query.t === 'string' ? req.query.t : undefined);
    res.json(ticket);
  };

  myTickets = async (req: Request, res: Response) => {
    const tickets = await this.service.listTicketsForUser(req.auth!.userId);
    res.json(tickets);
  };

  adminList = async (req: Request, res: Response) => {
    const tickets = await this.service.listTickets(typeof req.query.status === 'string' ? req.query.status : undefined);
    res.json(tickets);
  };

  adminUpdate = async (req: Request, res: Response) => {
    const ticket = await this.service.adminUpdateTicket(req.params.id, req.body);
    res.json(ticket);
  };
}
