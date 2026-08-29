import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { serializeAddress, serializeUser, serializeWishlist } from '../../lib/serializers.js';
import { UsersRepository } from './users.repository.js';

const themeSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']),
});

const favoriteSchema = z.object({
  productId: z.string().min(1),
});

const addressSchema = z.object({
  title: z.string().trim().min(2),
  line1: z.string().trim().min(5),
  city: z.string().trim().min(2),
  district: z.string().trim().min(2),
  postalCode: z.string().trim().optional().default(''),
  country: z.string().trim().optional().default('Turkey'),
  phone: z.string().trim().min(10),
});

const addressUpdateSchema = addressSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Guncellenecek en az bir alan gonderilmelidir.',
});

export class UsersService {
  constructor(private readonly repository = new UsersRepository()) {}

  async getProfile(userId: string) {
    const user = await this.repository.findProfile(userId);
    if (!user) {
      throw new AppError('Kullanici profili bulunamadi.', 404);
    }

    return {
      ...serializeUser(user),
      themeMode: user.themePreference?.mode ?? 'system',
    };
  }

  async updateTheme(userId: string, payload: unknown) {
    const data = themeSchema.parse(payload);
    await this.repository.updateTheme(userId, data.mode);
    return this.getProfile(userId);
  }

  async listAddresses(userId: string) {
    const addresses = await this.repository.listAddresses(userId);
    return addresses.map(serializeAddress);
  }

  async createAddress(userId: string, payload: unknown) {
    const data = addressSchema.parse(payload);
    const address = await this.repository.createAddress(userId, data);
    return serializeAddress(address);
  }

  async updateAddress(userId: string, addressId: string, payload: unknown) {
    const existingAddress = await this.repository.findAddress(userId, addressId);

    if (!existingAddress) {
      throw new AppError('Adres bulunamadi.', 404);
    }

    const data = addressUpdateSchema.parse(payload);
    const address = await this.repository.updateAddress(addressId, data);
    return serializeAddress(address);
  }

  async deleteAddress(userId: string, addressId: string) {
    const existingAddress = await this.repository.findAddress(userId, addressId);

    if (!existingAddress) {
      throw new AppError('Adres bulunamadi.', 404);
    }

    await this.repository.deleteAddress(addressId);
  }

  async getFavorites(userId: string) {
    const wishlist = await this.repository.ensureWishlist(userId);
    return serializeWishlist(wishlist);
  }

  async addFavorite(userId: string, payload: unknown) {
    const data = favoriteSchema.parse(payload);
    const product = await this.repository.findPublishedDjiProduct(data.productId);

    if (!product) {
      throw new AppError('Favorilere eklenmek istenen urun bulunamadi.', 404);
    }

    const wishlist = await this.repository.ensureWishlist(userId);
    await this.repository.addFavorite(wishlist.id, data.productId);
    const updatedWishlist = await this.repository.findWishlist(userId);
    return serializeWishlist(updatedWishlist);
  }

  async removeFavorite(userId: string, productId: string) {
    const wishlist = await this.repository.ensureWishlist(userId);
    await this.repository.removeFavorite(wishlist.id, productId);
    const updatedWishlist = await this.repository.findWishlist(userId);
    return serializeWishlist(updatedWishlist);
  }
}
