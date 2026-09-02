export type Language = 'tr' | 'en';

export function getIntlLocale(language: Language) {
  return language === 'tr' ? 'tr-TR' : 'en-US';
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
    admin: { tr: 'Yönetici', en: 'Admin' },
    customer: { tr: 'Müşteri', en: 'Customer' },
  };

  return dictionary[normalized]?.[language] ?? role;
}

export function translateOrderStatus(language: Language, status?: string) {
  if (!status) return '';

  const normalized = status.toLowerCase();
  const dictionary: Record<string, { tr: string; en: string }> = {
    pending: { tr: 'Beklemede', en: 'Pending' },
    processing: { tr: 'Hazırlanıyor', en: 'Processing' },
    shipped: { tr: 'Kargoda', en: 'Shipped' },
    delivered: { tr: 'Teslim Edildi', en: 'Delivered' },
  };

  return dictionary[normalized]?.[language] ?? status;
}

export function translatePaymentStatus(language: Language, status?: string) {
  if (!status) return '';

  const normalized = status.toLowerCase();
  const dictionary: Record<string, { tr: string; en: string }> = {
    pending: { tr: 'Ödeme Bekleniyor', en: 'Awaiting Payment' },
    paid: { tr: 'Ödendi', en: 'Paid' },
    failed: { tr: 'Ödeme Başarısız', en: 'Payment Failed' },
    partially_refunded: { tr: 'Kısmi İade', en: 'Partially Refunded' },
    refunded: { tr: 'İade Edildi', en: 'Refunded' },
  };

  return dictionary[normalized]?.[language] ?? status;
}
