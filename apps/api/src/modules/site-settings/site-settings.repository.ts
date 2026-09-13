import { prisma } from '../../db/prisma.js';

export class SiteSettingsRepository {
  findMain() {
    return prisma.siteSettings.findUnique({ where: { id: 'main' } });
  }

  async upsertMain(data: Record<string, unknown>) {
    return prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: data,
      create: { id: 'main', ...data },
    });
  }
}
