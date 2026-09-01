import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { resolveMediaUrl } from '../../lib/serializers.js';
import { CampaignsRepository } from './campaigns.repository.js';

const optionalLinkOrPath = z
  .string()
  .trim()
  .refine((value) => value === '' || /^https?:\/\//.test(value) || (value.startsWith('/') && !value.startsWith('//')), {
    message: 'Link http(s) adresi veya /ile-baslayan bir sayfa yolu olmalidir.',
  })
  .nullable()
  .optional();

const campaignSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
  badge: z.string().trim().nullable().optional(),
  imageUrl: optionalLinkOrPath,
  linkUrl: optionalLinkOrPath,
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export class CampaignsService {
  constructor(private readonly repository = new CampaignsRepository()) {}

  private serializeCampaign<T extends { imageUrl: string | null }>(campaign: T) {
    return { ...campaign, imageUrl: resolveMediaUrl(campaign.imageUrl) };
  }

  async listActive() {
    const campaigns = await this.repository.listActive();
    return campaigns.map((campaign) => this.serializeCampaign(campaign));
  }

  async listAll() {
    const campaigns = await this.repository.listAll();
    return campaigns.map((campaign) => this.serializeCampaign(campaign));
  }

  async create(payload: unknown) {
    const data = campaignSchema.parse(payload);
    const campaign = await this.repository.create(data);
    return this.serializeCampaign(campaign);
  }

  async update(id: string, payload: unknown) {
    const data = campaignSchema.partial().parse(payload);

    if (Object.keys(data).length === 0) {
      throw new AppError('Guncellenecek alan gonderilmedi.', 400);
    }

    const campaign = await this.repository.update(id, data);
    return this.serializeCampaign(campaign);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}
