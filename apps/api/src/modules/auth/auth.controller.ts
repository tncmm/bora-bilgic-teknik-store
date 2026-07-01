import { Request, Response } from 'express';

import { AuthService } from './auth.service.js';

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(req.body);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    res.status(201).json({ accessToken: result.accessToken, user: result.user });
  };

  login = async (req: Request, res: Response) => {
    const result = await this.service.login(req.body);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    res.json({ accessToken: result.accessToken, user: result.user });
  };

  me = async (req: Request, res: Response) => {
    const user = await this.service.me(req.auth!.userId);
    res.json(user);
  };

  refresh = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    const result = await this.service.refresh(refreshToken);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    res.json({ accessToken: result.accessToken, user: result.user });
  };

  logout = async (_req: Request, res: Response) => {
    res.clearCookie('refreshToken');
    res.status(204).send();
  };
}
