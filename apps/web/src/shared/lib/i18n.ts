export type Language = 'tr' | 'en';

export const LANGUAGE_STORAGE_KEY = 'bora-language';

export function getLanguageLabel(language: Language) {
  return language === 'tr' ? 'TR' : 'EN';
}

export function getIntlLocale(language: Language) {
  return language === 'tr' ? 'tr-TR' : 'en-US';
}

export function getDefaultLanguage(): Language {
  return window.navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function translateCategoryName(language: Language, slug?: string, fallback?: string) {
  const dictionary: Record<string, { tr: string; en: string }> = {
    'camera-drones': { tr: 'Drone', en: 'Drone' },
    handheld: { tr: 'Creator Sistemleri', en: 'Creator Systems' },
    enterprise: { tr: 'Kurumsal', en: 'Enterprise' },
    drone: { tr: 'Drone', en: 'Drone' },
    gimbal: { tr: 'Gimbal', en: 'Gimbal' },
    'aksiyon-kamera': { tr: 'Aksiyon Kamera', en: 'Action Camera' },
    aksesuar: { tr: 'Aksesuar', en: 'Accessories' },
    kurumsal: { tr: 'Kurumsal', en: 'Enterprise' },
  };

  if (!slug || !dictionary[slug]) {
    return fallback ?? '';
  }

  return dictionary[slug][language];
}

export function translateRole(language: Language, role?: string) {
  if (!role) return '';

  const normalized = role.toLowerCase();
  const dictionary: Record<string, { tr: string; en: string }> = {
    admin: { tr: 'Yonetici', en: 'Admin' },
    customer: { tr: 'Musteri', en: 'Customer' },
  };

  return dictionary[normalized]?.[language] ?? role;
}

export function translateOrderStatus(language: Language, status?: string) {
  if (!status) return '';

  const normalized = status.toLowerCase();
  const dictionary: Record<string, { tr: string; en: string }> = {
    pending: { tr: 'Beklemede', en: 'Pending' },
    processing: { tr: 'Hazirlaniyor', en: 'Processing' },
    shipped: { tr: 'Kargoda', en: 'Shipped' },
    delivered: { tr: 'Teslim Edildi', en: 'Delivered' },
  };

  return dictionary[normalized]?.[language] ?? status;
}

export function translatePaymentStatus(language: Language, status?: string) {
  if (!status) return '';

  const normalized = status.toLowerCase();
  const dictionary: Record<string, { tr: string; en: string }> = {
    pending: { tr: 'Odeme Bekleniyor', en: 'Awaiting Payment' },
    paid: { tr: 'Odendi', en: 'Paid' },
    failed: { tr: 'Odeme Basarisiz', en: 'Payment Failed' },
  };

  return dictionary[normalized]?.[language] ?? status;
}

export function translateThemeMode(language: Language, mode: 'light' | 'dark' | 'system') {
  const dictionary = {
    light: { tr: 'Acik', en: 'Light' },
    dark: { tr: 'Koyu', en: 'Dark' },
    system: { tr: 'Sistem', en: 'System' },
  } as const;

  return dictionary[mode][language];
}
