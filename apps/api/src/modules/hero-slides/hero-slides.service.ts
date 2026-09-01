import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { resolveMediaUrl } from '../../lib/serializers.js';
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

  private serializeSlide<T extends { imageUrl: string }>(slide: T) {
    return { ...slide, imageUrl: resolveMediaUrl(slide.imageUrl) ?? slide.imageUrl };
  }

  async listActive() {
    const slides = await this.repository.listActive();
    return slides.map((slide) => this.serializeSlide(slide));
  }

  async listAll() {
    const slides = await this.repository.listAll();
    return slides.map((slide) => this.serializeSlide(slide));
  }

  async create(payload: unknown) {
    const data = heroSlideSchema.parse(payload);
    const slide = await this.repository.create(data);
    return this.serializeSlide(slide);
  }

  async update(id: string, payload: unknown) {
    const data = heroSlideSchema.partial().parse(payload);

    if (Object.keys(data).length === 0) {
      throw new AppError('Guncellenecek alan gonderilmedi.', 400);
    }

    const slide = await this.repository.update(id, data);
    return this.serializeSlide(slide);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}
