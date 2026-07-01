import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { serializeUser, serializeWishlist } from '../../lib/serializers.js';
import { UsersRepository } from './users.repository.js';

const themeSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']),
});

const favoriteSchema = z.object({
  productId: z.string().min(1),
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
