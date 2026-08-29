import { Request, Response } from 'express';

import { UsersService } from './users.service.js';

export class UsersController {
  constructor(private readonly service = new UsersService()) {}

  getProfile = async (req: Request, res: Response) => {
    const profile = await this.service.getProfile(req.auth!.userId);
    res.json(profile);
  };

  updateTheme = async (req: Request, res: Response) => {
    const profile = await this.service.updateTheme(req.auth!.userId, req.body);
    res.json(profile);
  };

  listAddresses = async (req: Request, res: Response) => {
    const addresses = await this.service.listAddresses(req.auth!.userId);
    res.json(addresses);
  };

  createAddress = async (req: Request, res: Response) => {
    const address = await this.service.createAddress(req.auth!.userId, req.body);
    res.status(201).json(address);
  };

  updateAddress = async (req: Request, res: Response) => {
    const address = await this.service.updateAddress(req.auth!.userId, String(req.params.addressId), req.body);
    res.json(address);
  };

  deleteAddress = async (req: Request, res: Response) => {
    await this.service.deleteAddress(req.auth!.userId, String(req.params.addressId));
    res.status(204).send();
  };

  getFavorites = async (req: Request, res: Response) => {
    const wishlist = await this.service.getFavorites(req.auth!.userId);
    res.json(wishlist);
  };

  addFavorite = async (req: Request, res: Response) => {
    const wishlist = await this.service.addFavorite(req.auth!.userId, req.body);
    res.status(201).json(wishlist);
  };

  removeFavorite = async (req: Request, res: Response) => {
    const wishlist = await this.service.removeFavorite(req.auth!.userId, String(req.params.productId));
    res.json(wishlist);
  };
}
