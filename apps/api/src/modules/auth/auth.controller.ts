import { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { AuthService } from './auth.service.js';

// Refresh çerezi production'da (veya WEB_URL https ile başlıyorsa) yalnızca
// HTTPS üzerinden iletilir. Trust proxy ayarlı olduğu için ters proxy
// (nginx/Render) arkasında güvenli çerezler doğru çalışır.
const useSecureCookies = env.NODE_ENV === 'production' || env.WEB_URL.startsWith('https://');

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: useSecureCookies,
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(req.body);
    res.status(201).json(result);
  };

  verifyEmail = async (req: Request, res: Response) => {
    const result = await this.service.verifyEmail(req.body);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    res.json({ accessToken: result.accessToken, user: result.user });
  };

  resendVerification = async (req: Request, res: Response) => {
    const result = await this.service.resendVerification(req.body);
    res.json(result);
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
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    try {
      const result = await this.service.refresh(refreshToken);
      res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
      res.json({ accessToken: result.accessToken, user: result.user });
    } catch (error) {
      // Eksik/iptal edilmis/suresi dolmus token: cerezi da temizleyip 401.
      res.clearCookie('refreshToken');
      throw error;
    }
  };

  logout = async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    await this.service.logout(refreshToken);
    res.clearCookie('refreshToken');
    res.status(204).send();
  };
}
