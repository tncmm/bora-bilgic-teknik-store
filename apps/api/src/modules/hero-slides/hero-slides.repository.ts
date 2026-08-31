import { prisma } from '../../db/prisma.js';

export class HeroSlidesRepository {
  listActive() {
    return prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listAll() {
    return prisma.heroSlide.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(data: { title: string; subtitle?: string | null; ctaText?: string | null; ctaLink?: string | null; imageUrl: string; isActive: boolean; sortOrder: number }) {
    return prisma.heroSlide.create({ data });
  }

  update(id: string, data: { title?: string; subtitle?: string | null; ctaText?: string | null; ctaLink?: string | null; imageUrl?: string; isActive?: boolean; sortOrder?: number }) {
    return prisma.heroSlide.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.heroSlide.delete({ where: { id } });
  }
}
