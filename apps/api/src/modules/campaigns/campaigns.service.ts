import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
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

  listActive() {
    return this.repository.listActive();
  }

  listAll() {
    return this.repository.listAll();
  }

  create(payload: unknown) {
    const data = campaignSchema.parse(payload);
    return this.repository.create(data);
  }

  async update(id: string, payload: unknown) {
    const data = campaignSchema.partial().parse(payload);

    if (Object.keys(data).length === 0) {
      throw new AppError('Guncellenecek alan gonderilmedi.', 400);
    }

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }
}
