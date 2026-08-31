import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { HeroSlidesRepository } from './hero-slides.repository.js';

const heroSlideSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().nullable().optional(),
  ctaText: z.string().trim().nullable().optional(),
  ctaLink: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export class HeroSlidesService {
  constructor(private readonly repository = new HeroSlidesRepository()) {}

  listActive() {
    return this.repository.listActive();
  }

  listAll() {
    return this.repository.listAll();
  }

  create(payload: unknown) {
    const data = heroSlideSchema.parse(payload);
    return this.repository.create(data);
  }

  async update(id: string, payload: unknown) {
    const data = heroSlideSchema.partial().parse(payload);

    if (Object.keys(data).length === 0) {
      throw new AppError('Guncellenecek alan gonderilmedi.', 400);
    }

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}
