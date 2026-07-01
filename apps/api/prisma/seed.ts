import bcrypt from 'bcryptjs';
import { OrderStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Camera Drones',
    slug: 'camera-drones',
    description: 'DJI hava goruntuleme ailesi: Mavic, Air, Mini, Avata ve Inspire platformlari.',
  },
  {
    name: 'Handheld',
    slug: 'handheld',
    description: 'DJI creator ve production ekosistemi: RS, Osmo ve Mic serileri.',
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'DJI saha, denetim ve lojistik operasyon platformlari.',
  },
];

const products = [
  {
    name: 'DJI Mavic 4 Pro',
    slug: 'dji-mavic-4-pro',
    brand: 'DJI',
    shortDescription: 'Triple-lens amiral gemisi kamera dronu.',
    description: 'Resmi DJI urun sayfasindaki amiral gemisi hava platformu; premium cekim, ticari prodüksiyon ve ileri seviye creator akislari icin konumlanir.',
    sku: 'DJI-MAVIC-4-PRO',
    badge: 'Triple Lens',
    heroTag: 'Flagship Aerial',
    price: 154900,
    stock: 6,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'camera-drones',
    images: [
      { url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Mavic 4 Pro', isPrimary: true },
    ],
    specs: [
      { name: 'Camera', value: '100MP 4/3 CMOS Hasselblad' },
      { name: 'Video', value: '6K/60fps HDR' },
      { name: 'Transmission', value: 'O4+' },
    ],
  },
  {
    name: 'DJI Air 3S',
    slug: 'dji-air-3s',
    brand: 'DJI',
    shortDescription: 'Dual-camera drone for travel photography.',
    description: 'DJI kamera dronlari icinde tasinabilirlik ve cift odak araligini dengeleyen seyahat ve saha odakli sistem.',
    sku: 'DJI-AIR-3S',
    badge: 'Dual Cam',
    heroTag: 'Travel Pro',
    price: 78900,
    stock: 14,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'camera-drones',
    images: [
      { url: 'https://images.unsplash.com/photo-1524143986875-3b098d78b363?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Air 3S', isPrimary: true },
    ],
    specs: [
      { name: 'Camera', value: '1-inch CMOS + 70mm medium tele' },
      { name: 'Flight Time', value: '45 dakika' },
      { name: 'Video', value: '4K/60fps HDR' },
    ],
  },
  {
    name: 'DJI Mini 5 Pro',
    slug: 'dji-mini-5-pro',
    brand: 'DJI',
    shortDescription: 'Lightweight creator drone with pro imaging.',
    description: 'DJI products sayfasinda guncel hafif creator drone olarak yer alan seri; mobil prodüksiyon ve hizli deployment icin uygundur.',
    sku: 'DJI-MINI-5-PRO',
    badge: 'Ultra Light',
    heroTag: 'Creator',
    price: 56900,
    stock: 18,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'camera-drones',
    images: [
      { url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Mini 5 Pro', isPrimary: true },
    ],
    specs: [
      { name: 'Weight', value: 'Sub-249g' },
      { name: 'Sensor', value: '1-inch CMOS' },
      { name: 'Tracking', value: 'ActiveTrack 360' },
    ],
  },
  {
    name: 'DJI Avata 360',
    slug: 'dji-avata-360',
    brand: 'DJI',
    shortDescription: '8K flagship 360 degree drone.',
    description: 'Immersive cekimler ve 360 derece hava anlatimi icin kurgulanmis guncel DJI creator platformu.',
    sku: 'DJI-AVATA-360',
    badge: '360 Drone',
    heroTag: 'Immersive',
    price: 89900,
    stock: 8,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'camera-drones',
    images: [
      { url: 'https://images.unsplash.com/photo-1524143986875-3b098d78b363?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Avata 360', isPrimary: true },
    ],
    specs: [
      { name: 'Video', value: '8K/60fps HDR' },
      { name: 'View', value: '360 Capture' },
      { name: 'Transmission', value: 'O4+' },
    ],
  },
  {
    name: 'DJI Inspire 3',
    slug: 'dji-inspire-3',
    brand: 'DJI',
    shortDescription: 'Full-frame cinema drone platform.',
    description: 'Yuksek butceli setler ve ileri seviye sinema ekipleri icin premium DJI hava sinemasi sistemi.',
    sku: 'DJI-INSPIRE-3',
    badge: 'Cinema',
    heroTag: 'Pro Filmmaking',
    price: 649900,
    stock: 2,
    isPublished: true,
    isPurchasable: false,
    categorySlug: 'camera-drones',
    images: [
      { url: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Inspire 3', isPrimary: true },
    ],
    specs: [
      { name: 'Sensor', value: 'Full Frame 8K' },
      { name: 'Flight Time', value: '28 dakika' },
      { name: 'Status', value: 'Quote Required' },
    ],
  },
  {
    name: 'DJI RS 5',
    slug: 'dji-rs-5',
    brand: 'DJI',
    shortDescription: 'Lightweight commercial stabilizer.',
    description: 'Handheld kategori altinda profesyonel kamera rigleri icin yeni nesil DJI stabilizer platformu.',
    sku: 'DJI-RS-5',
    badge: 'Stabilizer',
    heroTag: 'Motion',
    price: 45990,
    stock: 11,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'handheld',
    images: [
      { url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80', alt: 'DJI RS 5', isPrimary: true },
    ],
    specs: [
      { name: 'Payload', value: '4.5kg' },
      { name: 'Charge Time', value: '1 saat tam dolum' },
      { name: 'Control', value: 'Intelligent Tracking Module' },
    ],
  },
  {
    name: 'Osmo Action 6',
    slug: 'osmo-action-6',
    brand: 'DJI',
    shortDescription: 'All-in-one flagship action camera.',
    description: 'DJI handheld ailesinde spor, POV ve hareketli cekimler icin one cikan aksiyon kamera sistemi.',
    sku: 'DJI-OSMO-ACTION-6',
    badge: 'Action Cam',
    heroTag: 'Motion POV',
    price: 18990,
    stock: 21,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'handheld',
    images: [
      { url: 'https://images.unsplash.com/photo-1520672106821-15c55e1a4a14?auto=format&fit=crop&w=1200&q=80', alt: 'Osmo Action 6', isPrimary: true },
    ],
    specs: [
      { name: 'Sensor', value: '1/1.1 inch square sensor' },
      { name: 'Lens', value: 'f/2.0 to f/4.0 variable aperture' },
      { name: 'Waterproof', value: '20m' },
    ],
  },
  {
    name: 'DJI Mic 2',
    slug: 'dji-mic-2',
    brand: 'DJI',
    shortDescription: 'Internal recording mini wireless mic system.',
    description: 'DJI creator ekosistemi icin mobil, set ici ve run-and-gun cekimlerde kullanilan kablosuz ses sistemi.',
    sku: 'DJI-MIC-2',
    badge: 'Audio',
    heroTag: 'Creator Audio',
    price: 14990,
    stock: 22,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'handheld',
    images: [
      { url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Mic 2', isPrimary: true },
    ],
    specs: [
      { name: 'Recording', value: '32-bit Float' },
      { name: 'Range', value: '250m' },
      { name: 'Battery', value: '18 saat set toplam kullanim' },
    ],
  },
  {
    name: 'Osmo Mobile 8P',
    slug: 'osmo-mobile-8p',
    brand: 'DJI',
    shortDescription: 'Pro framing and tracking phone gimbal.',
    description: 'Telefon tabanli cekim akislari icin DJI handheld ailesindeki takip ve kadraj odakli kompakt gimbal.',
    sku: 'DJI-OSMO-MOBILE-8P',
    badge: 'Mobile Gimbal',
    heroTag: 'Mobile Creator',
    price: 8990,
    stock: 16,
    isPublished: true,
    isPurchasable: true,
    categorySlug: 'handheld',
    images: [
      { url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80', alt: 'Osmo Mobile 8P', isPrimary: true },
    ],
    specs: [
      { name: 'Tracking', value: 'Pro Framing' },
      { name: 'Use Case', value: 'Phone Content' },
      { name: 'Status', value: 'Buy Now' },
    ],
  },
  {
    name: 'DJI Matrice 400',
    slug: 'dji-matrice-400',
    brand: 'DJI',
    shortDescription: 'Long-endurance drone platform with power-line-level obstacle sensing.',
    description: 'DJI enterprise ailesinde denetim, enerji, kamu guvenligi ve uzun gorev profilleri icin konumlanan ana platform.',
    sku: 'DJI-MATRICE-400',
    badge: 'Enterprise',
    heroTag: 'Inspection',
    price: 489900,
    stock: 3,
    isPublished: true,
    isPurchasable: false,
    categorySlug: 'enterprise',
    images: [
      { url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80', alt: 'DJI Matrice 400', isPrimary: true },
    ],
    specs: [
      { name: 'Mission', value: 'Inspection and Public Safety' },
      { name: 'Obstacle Sensing', value: 'Power-Line-Level' },
      { name: 'Status', value: 'Quote Required' },
    ],
  },
  {
    name: 'DJI FlyCart 100',
    slug: 'dji-flycart-100',
    brand: 'DJI',
    shortDescription: 'All-in-one intelligent transportation flagship.',
    description: 'Lojistik ve agir yuk tasima senaryolari icin DJI delivery segmentinden secilen enterprise platform.',
    sku: 'DJI-FLYCART-100',
    badge: 'Delivery',
    heroTag: 'Logistics',
    price: 559900,
    stock: 2,
    isPublished: true,
    isPurchasable: false,
    categorySlug: 'enterprise',
    images: [
      { url: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80', alt: 'DJI FlyCart 100', isPrimary: true },
    ],
    specs: [
      { name: 'Mission', value: 'Intelligent Transportation' },
      { name: 'Use Case', value: 'Heavy Delivery' },
      { name: 'Status', value: 'Quote Required' },
    ],
  },
];

const demoUsers = [
  { firstName: 'Bora', lastName: 'Admin', email: 'admin@borabilgicteknik.com', role: Role.ADMIN, themeMode: 'dark' },
  { firstName: 'Demo', lastName: 'Musteri', email: 'musteri@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
  { firstName: 'Ayse', lastName: 'Yildirim', email: 'ayse@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'dark' },
  { firstName: 'Can', lastName: 'Kara', email: 'can@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'system' },
  { firstName: 'Selin', lastName: 'Arslan', email: 'selin@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
  { firstName: 'Emre', lastName: 'Demir', email: 'emre@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'dark' },
];

const userAddresses: Record<string, Array<{ title: string; line1: string; city: string; district: string; postalCode: string; phone: string }>> = {
  'musteri@borabilgicteknik.com': [
    { title: 'Ev', line1: 'Bagdat Caddesi No: 140', city: 'Istanbul', district: 'Kadikoy', postalCode: '34728', phone: '5551112233' },
  ],
  'ayse@borabilgicteknik.com': [
    { title: 'Ofis', line1: 'Ataturk Bulvari No: 44', city: 'Ankara', district: 'Cankaya', postalCode: '06680', phone: '5551112244' },
    { title: 'Depo', line1: 'Saray Mah. 1128 Sok. No: 4', city: 'Ankara', district: 'Kazan', postalCode: '06980', phone: '5551112245' },
  ],
  'can@borabilgicteknik.com': [
    { title: 'Ev', line1: 'Ihsaniye Mah. 1443 Sok. No: 21', city: 'Izmir', district: 'Konak', postalCode: '35220', phone: '5551112255' },
  ],
  'selin@borabilgicteknik.com': [
    { title: 'Stüdyo', line1: 'Barbaros Bulvari No: 87', city: 'Istanbul', district: 'Besiktas', postalCode: '34349', phone: '5551112266' },
  ],
  'emre@borabilgicteknik.com': [
    { title: 'Saha Ofisi', line1: 'Liman Mah. 22. Cadde No: 8', city: 'Antalya', district: 'Konyaalti', postalCode: '07070', phone: '5551112277' },
  ],
};

const cartScenarios: Record<string, Array<{ slug: string; quantity: number }>> = {
  'musteri@borabilgicteknik.com': [
    { slug: 'dji-mavic-4-pro', quantity: 1 },
    { slug: 'dji-mic-2', quantity: 1 },
  ],
  'ayse@borabilgicteknik.com': [{ slug: 'dji-mini-5-pro', quantity: 1 }],
  'can@borabilgicteknik.com': [
    { slug: 'dji-rs-5', quantity: 1 },
    { slug: 'osmo-action-6', quantity: 1 },
  ],
};

const wishlistScenarios: Record<string, string[]> = {
  'musteri@borabilgicteknik.com': ['dji-mavic-4-pro', 'dji-rs-5', 'osmo-action-6'],
  'ayse@borabilgicteknik.com': ['dji-inspire-3', 'dji-matrice-400'],
  'can@borabilgicteknik.com': ['dji-mini-5-pro', 'dji-mic-2'],
  'selin@borabilgicteknik.com': ['osmo-mobile-8p', 'dji-air-3s'],
};

const orderScenarios = [
  {
    orderNumber: 'BBT-DEMO-1001',
    email: 'musteri@borabilgicteknik.com',
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2026-05-20T10:00:00.000Z'),
    shippingName: 'Demo Musteri',
    shippingPhone: '5551112233',
    shippingCity: 'Istanbul',
    shippingDistrict: 'Kadikoy',
    shippingAddressLine: 'Bagdat Caddesi No: 140',
    notes: 'Kurye ile teslim edildi.',
    items: [
      { slug: 'dji-mini-5-pro', quantity: 1 },
      { slug: 'dji-mic-2', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-1002',
    email: 'ayse@borabilgicteknik.com',
    status: OrderStatus.SHIPPED,
    createdAt: new Date('2026-05-28T14:30:00.000Z'),
    shippingName: 'Ayse Yildirim',
    shippingPhone: '5551112244',
    shippingCity: 'Ankara',
    shippingDistrict: 'Cankaya',
    shippingAddressLine: 'Ataturk Bulvari No: 44',
    notes: 'Film setine teslimat.',
    items: [
      { slug: 'dji-mavic-4-pro', quantity: 1 },
      { slug: 'dji-rs-5', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-1003',
    email: 'can@borabilgicteknik.com',
    status: OrderStatus.PROCESSING,
    createdAt: new Date('2026-06-02T09:00:00.000Z'),
    shippingName: 'Can Kara',
    shippingPhone: '5551112255',
    shippingCity: 'Izmir',
    shippingDistrict: 'Konak',
    shippingAddressLine: 'Ihsaniye Mah. 1443 Sok. No: 21',
    notes: 'Kutu içi kontrol bekleniyor.',
    items: [
      { slug: 'dji-rs-5', quantity: 1 },
      { slug: 'dji-air-3s', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-1004',
    email: 'selin@borabilgicteknik.com',
    status: OrderStatus.PENDING,
    createdAt: new Date('2026-06-05T12:15:00.000Z'),
    shippingName: 'Selin Arslan',
    shippingPhone: '5551112266',
    shippingCity: 'Istanbul',
    shippingDistrict: 'Besiktas',
    shippingAddressLine: 'Barbaros Bulvari No: 87',
    notes: 'Muhasebe onayi bekleniyor.',
    items: [{ slug: 'osmo-mobile-8p', quantity: 1 }],
  },
  {
    orderNumber: 'BBT-DEMO-1005',
    email: 'emre@borabilgicteknik.com',
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2026-04-12T11:20:00.000Z'),
    shippingName: 'Emre Demir',
    shippingPhone: '5551112277',
    shippingCity: 'Antalya',
    shippingDistrict: 'Konyaalti',
    shippingAddressLine: 'Liman Mah. 22. Cadde No: 8',
    notes: 'Saha operasyonu icin teslim edildi.',
    items: [
      { slug: 'dji-air-3s', quantity: 1 },
      { slug: 'dji-mic-2', quantity: 2 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-1006',
    email: 'musteri@borabilgicteknik.com',
    status: OrderStatus.SHIPPED,
    createdAt: new Date('2026-05-31T15:45:00.000Z'),
    shippingName: 'Demo Musteri',
    shippingPhone: '5551112233',
    shippingCity: 'Istanbul',
    shippingDistrict: 'Kadikoy',
    shippingAddressLine: 'Bagdat Caddesi No: 140',
    notes: 'Kargo çıkışı yapıldı.',
    items: [{ slug: 'dji-avata-360', quantity: 1 }],
  },
  {
    orderNumber: 'BBT-DEMO-1007',
    email: 'ayse@borabilgicteknik.com',
    status: OrderStatus.PROCESSING,
    createdAt: new Date('2026-06-10T08:45:00.000Z'),
    shippingName: 'Ayse Yildirim',
    shippingPhone: '5551112245',
    shippingCity: 'Ankara',
    shippingDistrict: 'Kazan',
    shippingAddressLine: 'Saray Mah. 1128 Sok. No: 4',
    notes: 'Depo transferi planlandı.',
    items: [{ slug: 'dji-rs-5', quantity: 2 }],
  },
  {
    orderNumber: 'BBT-DEMO-1008',
    email: 'can@borabilgicteknik.com',
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2026-03-18T13:00:00.000Z'),
    shippingName: 'Can Kara',
    shippingPhone: '5551112255',
    shippingCity: 'Izmir',
    shippingDistrict: 'Konak',
    shippingAddressLine: 'Ihsaniye Mah. 1443 Sok. No: 21',
    notes: 'Uzaktan teslim teyit edildi.',
    items: [
      { slug: 'dji-mini-5-pro', quantity: 1 },
      { slug: 'dji-mic-2', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-1009',
    email: 'selin@borabilgicteknik.com',
    status: OrderStatus.PENDING,
    createdAt: new Date('2026-06-14T16:05:00.000Z'),
    shippingName: 'Selin Arslan',
    shippingPhone: '5551112266',
    shippingCity: 'Istanbul',
    shippingDistrict: 'Besiktas',
    shippingAddressLine: 'Barbaros Bulvari No: 87',
    notes: 'Kurumsal teklif bekleniyor.',
    items: [{ slug: 'osmo-action-6', quantity: 1 }],
  },
];

async function upsertCategories() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
}

async function cleanupCatalog() {
  const validProductSlugs = products.map((product) => product.slug);

  const legacyProducts = await prisma.product.findMany({
    where: {
      OR: [{ brand: { not: 'DJI' } }, { slug: { notIn: validProductSlugs } }],
    },
    select: { id: true },
  });

  const legacyProductIds = legacyProducts.map((product) => product.id);

  if (legacyProductIds.length > 0) {
    await prisma.cartItem.deleteMany({
      where: {
        productId: {
          in: legacyProductIds,
        },
      },
    });

    await prisma.orderItem.deleteMany({
      where: {
        productId: {
          in: legacyProductIds,
        },
      },
    });

    await prisma.wishlistItem.deleteMany({
      where: {
        productId: {
          in: legacyProductIds,
        },
      },
    });

    await prisma.productImage.deleteMany({
      where: {
        productId: {
          in: legacyProductIds,
        },
      },
    });

    await prisma.productSpec.deleteMany({
      where: {
        productId: {
          in: legacyProductIds,
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        id: {
          in: legacyProductIds,
        },
      },
    });
  }
}

async function cleanupCategories() {
  const validCategorySlugs = categories.map((category) => category.slug);

  await prisma.category.deleteMany({
    where: {
      slug: {
        notIn: validCategorySlugs,
      },
    },
  });
}

async function upsertProducts() {
  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
    });

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        brand: product.brand,
        shortDescription: product.shortDescription,
        description: product.description,
        sku: product.sku,
        badge: product.badge,
        heroTag: product.heroTag,
        price: product.price,
        stock: product.stock,
        isPublished: product.isPublished,
        isPurchasable: product.isPurchasable,
        categoryId: category.id,
        images: {
          deleteMany: {},
          create: product.images,
        },
        specs: {
          deleteMany: {},
          create: product.specs,
        },
      },
      create: {
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        shortDescription: product.shortDescription,
        description: product.description,
        sku: product.sku,
        badge: product.badge,
        heroTag: product.heroTag,
        price: product.price,
        stock: product.stock,
        isPublished: product.isPublished,
        isPurchasable: product.isPurchasable,
        categoryId: category.id,
        images: { create: product.images },
        specs: { create: product.specs },
      },
    });
  }
}

async function upsertUsers() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash,
        role: user.role,
      },
      create: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }
}

async function seedThemePreferences() {
  for (const user of demoUsers) {
    const record = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    await prisma.themePreference.upsert({
      where: { userId: record.id },
      update: { mode: user.themeMode },
      create: { userId: record.id, mode: user.themeMode },
    });
  }
}

async function seedAddresses() {
  for (const [email, addresses] of Object.entries(userAddresses)) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.address.deleteMany({ where: { userId: user.id } });
    if (addresses.length > 0) {
      await prisma.address.createMany({
        data: addresses.map((address) => ({
          ...address,
          userId: user.id,
        })),
      });
    }
  }
}

async function seedCarts() {
  const productRecords = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
    },
  });

  const productBySlug = new Map(productRecords.map((product) => [product.slug, product.id]));

  for (const [email, items] of Object.entries(cartScenarios)) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    if (items.length > 0) {
      await prisma.cartItem.createMany({
        data: items.map((item) => ({
          cartId: cart.id,
          productId: productBySlug.get(item.slug)!,
          quantity: item.quantity,
        })),
      });
    }
  }
}

async function seedWishlists() {
  const productRecords = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
    },
  });

  const productBySlug = new Map(productRecords.map((product) => [product.slug, product.id]));

  for (const [email, slugs] of Object.entries(wishlistScenarios)) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const wishlist = await prisma.wishlist.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });

    if (slugs.length > 0) {
      await prisma.wishlistItem.createMany({
        data: slugs.map((slug) => ({
          wishlistId: wishlist.id,
          productId: productBySlug.get(slug)!,
        })),
      });
    }
  }
}

async function seedOrders() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: demoUsers.filter((user) => user.role === Role.CUSTOMER).map((user) => user.email),
      },
    },
    select: {
      id: true,
      email: true,
    },
  });
  const userByEmail = new Map(users.map((user) => [user.email, user.id]));

  const productsFromDb = await prisma.product.findMany({
    where: { isPurchasable: true },
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
    },
  });
  const productBySlug = new Map(productsFromDb.map((product) => [product.slug, product]));

  await prisma.order.deleteMany({
    where: {
      orderNumber: {
        startsWith: 'BBT-DEMO-',
      },
    },
  });

  for (const scenario of orderScenarios) {
    const items = scenario.items.map((item) => {
      const product = productBySlug.get(item.slug);
      if (!product) {
        throw new Error(`Seed order item product not found or not purchasable: ${item.slug}`);
      }

      const unitPrice = Number(product.price);

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    await prisma.order.create({
      data: {
        orderNumber: scenario.orderNumber,
        status: scenario.status,
        total,
        shippingName: scenario.shippingName,
        shippingPhone: scenario.shippingPhone,
        shippingCity: scenario.shippingCity,
        shippingDistrict: scenario.shippingDistrict,
        shippingAddressLine: scenario.shippingAddressLine,
        notes: scenario.notes,
        userId: userByEmail.get(scenario.email)!,
        createdAt: scenario.createdAt,
        items: {
          create: items,
        },
      },
    });
  }
}

async function main() {
  await upsertCategories();
  await cleanupCatalog();
  await upsertProducts();
  await cleanupCategories();
  await upsertUsers();
  await seedThemePreferences();
  await seedAddresses();
  await seedCarts();
  await seedWishlists();
  await seedOrders();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
