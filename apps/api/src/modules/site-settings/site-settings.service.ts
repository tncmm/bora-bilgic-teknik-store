import type { SiteSettings } from '@bora/types';
import { z } from 'zod';

import { SiteSettingsRepository } from './site-settings.repository.js';

/**
 * Satır yoksa (taze veritabanı) public sayfa boş kalmasın diye kullanılan
 * varsayılanlar; seed ile aynı değerler.
 */
export const CONTACT_INFO_DEFAULTS: SiteSettings = {
  contactHeroTitle: 'İLETİŞİM',
  contactHeroDescription: 'Kurumsal projeler, teknik keşif, stok teyidi ve satış sonrası destek için bizimle hızla iletişime geçin.',
  contactAddress: 'Hayyam Çarşısı (Hayyam Pasajı), Hoca Paşa Mah. Muradiye Cad., Sirkeci / Fatih / İstanbul',
  contactPhone: '+90 552 355 79 83',
  contactEmail: 'destek@borabilgicteknik.com',
  contactWhatsapp: null,
  contactMapUrl: 'https://www.google.com/maps?q=Hayyam+Pasaj%C4%B1+Sirkeci+%C4%B0stanbul&output=embed',
  contactHoursDays: 'Pazartesi - Cumartesi',
  contactHoursTime: '09:00 - 19:00',
  contactRemoteNote: 'Uzaktan teknik destek: 7/24 kayıt oluşturma',
  contactCorporateNote: 'Kurumsal projeler ve toplu alımlar için bizimle iletişime geçin; ekibimiz stok ve termin bilgisiyle hızlı teklif hazırlar.',
};

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalShortText = (max: number) => z.string().trim().max(max).optional().nullable();

export const siteSettingsSchema = z.object({
  contactHeroTitle: optionalShortText(120),
  contactHeroDescription: optionalShortText(300),
  contactAddress: optionalShortText(400),
  contactPhone: optionalShortText(40),
  contactEmail: optionalShortText(200),
  contactWhatsapp: optionalShortText(40),
  contactMapUrl: optionalShortText(600),
  contactHoursDays: optionalShortText(80),
  contactHoursTime: optionalShortText(80),
  contactRemoteNote: optionalShortText(200),
  contactCorporateNote: optionalShortText(400),
});

export type SiteSettingsUpdate = z.infer<typeof siteSettingsSchema>;

export class SiteSettingsService {
  constructor(private readonly repository = new SiteSettingsRepository()) {}

  /** Public iletişim bilgileri; satır yoksa defaults ile döner. */
  async getContactInfo(): Promise<SiteSettings> {
    const row = await this.repository.findMain();
    return this.serialize(row);
  }

  async getSettings(): Promise<SiteSettings> {
    return this.serialize(await this.repository.findMain());
  }

  async updateSettings(payload: unknown): Promise<SiteSettings> {
    const data = siteSettingsSchema.parse(payload);
    if (Object.keys(data).length === 0) {
      throw new Error('Guncellenecek alan gonderilmedi.');
    }
    const row = await this.repository.upsertMain(data);
    return this.serialize(row);
  }

  private serialize(row: unknown): SiteSettings {
    const record = (row ?? {}) as Record<string, unknown>;
    const result = {} as SiteSettings;
    for (const key of Object.keys(CONTACT_INFO_DEFAULTS) as Array<keyof SiteSettings>) {
      const value = record[key];
      // null/undefined (satir yok/alan hic yazilmamis) -> varsayilan; ''
      // bilincli bos birakma oldugu icin oldugu gibi korunur (kart gizlenir).
      result[key] = value === undefined || value === null ? CONTACT_INFO_DEFAULTS[key] : (value as string | null);
    }
    return result;
  }
}
