import { prisma } from '../../db/prisma.js';

export class CampaignsRepository {
  listActive() {
    return prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listAll() {
    return prisma.campaign.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(data: { title: string; description?: string | null; badge?: string | null; imageUrl?: string | null; linkUrl?: string | null; isActive: boolean; sortOrder: number }) {
    return prisma.campaign.create({ data });
  }

  update(id: string, data: { title?: string; description?: string | null; badge?: string | null; imageUrl?: string | null; linkUrl?: string | null; isActive?: boolean; sortOrder?: number }) {
    return prisma.campaign.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.campaign.delete({ where: { id } });
  }
}
