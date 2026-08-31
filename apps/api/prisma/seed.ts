import bcrypt from 'bcryptjs';
import { OrderStatus, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

function gallery(images: Array<{ url: string; alt: string }>) {
  return images.map((image, index) => ({
    id: `gallery-${index + 1}`,
    url: image.url,
    alt: image.alt,
    isPrimary: index === 0,
    kind: 'image',
    thumbnailUrl: image.url,
  }));
}

function packageOptions(basePrice: number, deluxePrice: number) {
  return [
    {
      id: 'standard',
      name: 'Standart Paket',
      price: basePrice,
      description: 'Gövde, temel aksesuarlar ve hızlı başlangıç kurulumu.',
      isDefault: true,
    },
    {
      id: 'combo',
      name: 'Fly More Combo',
      price: deluxePrice,
      description: 'Ek pil, şarj hub, taşıma çözümleri ve creator aksesuarlar.',
      isDefault: false,
    },
  ];
}

function detailSections(name: string, narrative: string, bullets: string[], imageUrl: string) {
  return [
    {
      id: 'aciklama',
      label: 'Açıklama',
      heading: `${name} ile yeni çekim standardı`,
      body: narrative,
      bullets,
      imageUrl,
    },
    {
      id: 'ozellikler',
      label: 'Özellikler',
      heading: 'Öne çıkan teknik noktalar',
      bullets,
      imageUrl: null,
    },
    {
      id: 'kutu-icerigi',
      label: 'Kutu İçeriği',
      body: 'Gövde, koruyucu aksesuarları ve günlük üretim akışını tamamlayan temel set içeriği ile gelir.',
      bullets: ['Ana gövde', 'Batarya / güç paketi', 'Bağlantı kabloları', 'Taşıma ve koruma aksesuarları'],
      imageUrl: null,
    },
    {
      id: 'yorumlar',
      label: 'Yorumlar',
      body: 'Demo sürümde yorum kartları yerine özet puanlama ve kullanım senaryosu görünür.',
      bullets: ['Profesyonel çekim ekipleri tarafından tercih edilir', 'Hızlı kurulum ve teknik destek akışına uygundur'],
      imageUrl: null,
    },
  ];
}

const media = {
  heroDrone: 'https://pub-d17f1f58ed49462b8a262a3aa2a07ff3.r2.dev/storefront/categories/drone.png',
  heroGimbal: 'https://pub-d17f1f58ed49462b8a262a3aa2a07ff3.r2.dev/storefront/categories/gimbal.png',
  heroAction: 'https://pub-d17f1f58ed49462b8a262a3aa2a07ff3.r2.dev/storefront/categories/aksiyon-kamera.png',
  heroAccessory: 'https://pub-d17f1f58ed49462b8a262a3aa2a07ff3.r2.dev/storefront/categories/aksesuar.png',
  heroEnterprise: 'https://pub-d17f1f58ed49462b8a262a3aa2a07ff3.r2.dev/storefront/categories/kurumsal.png',
  productDrone: '/storefront/product-drone.png',
  productDroneCompact: '/storefront/product-drone-compact.png',
  productGimbal: '/storefront/product-gimbal.png',
  productAction: '/storefront/product-action.png',
  productAccessory: '/storefront/product-accessory.png',
  productEnterprise: '/storefront/product-enterprise.png',
  demoVideo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
};

const categories: Array<any> = [
  {
    name: 'Drone',
    slug: 'drone',
    description: "DJI drone'ları ile sinema, seyahat ve creator çekimleri için hava platformları.",
    heroTitle: 'DRONE',
    heroDescription: "DJI drone'ları ile sınırları aşın ve gökyüzünden çarpıcı açıları yakalayın.",
    heroImageUrl: media.heroDrone,
    sortOrder: 1,
  },
  {
    name: 'Gimbal',
    slug: 'gimbal',
    description: "DJI gimbal'ları ile her çekimde profesyonel stabilizasyon.",
    heroTitle: 'GIMBAL',
    heroDescription: "DJI gimbal'ları ile her çekimde profesyonel stabilizasyon.",
    heroImageUrl: media.heroGimbal,
    sortOrder: 2,
  },
  {
    name: 'Aksiyon Kamera',
    slug: 'aksiyon-kamera',
    description: 'DJI aksiyon kameralar, pocket serileri ve mobil creator sistemleri.',
    heroTitle: 'AKSİYON KAMERA',
    heroDescription: 'Her anı yakalayan aksiyon kamera ve pocket sistemleri.',
    heroImageUrl: media.heroAction,
    sortOrder: 3,
  },
  {
    name: 'Aksesuar',
    slug: 'aksesuar',
    description: 'Batarya, şarj, taşıma, filtre ve medya tarafında DJI ekosistemini tamamlayan aksesuarlar.',
    heroTitle: 'AKSESUAR',
    heroDescription: 'DJI aksesuarları ile deneyimini en üst seviyeye çıkarın.',
    heroImageUrl: media.heroAccessory,
    sortOrder: 4,
  },
  {
    name: 'Kurumsal',
    slug: 'kurumsal',
    description: 'Denetim, güvenlik ve saha operasyonları için enterprise DJI platformları.',
    heroTitle: 'KURUMSAL',
    heroDescription: 'Kurumsal görevler için güvenilir, uzun dayanımlı ve saha odaklı DJI platformları.',
    heroImageUrl: media.heroEnterprise,
    sortOrder: 5,
  },
];

const products: Array<any> = [
  {
    name: 'DJI Mavic 3 Pro',
    slug: 'dji-mavic-3-pro',
    brand: 'DJI',
    series: 'Mavic Serisi',
    shortDescription: 'Üç kameralı amiral gemisi sinema dronu.',
    description: 'DJI Mavic 3 Pro, çoklu odak uzaklıkları ve profesyonel hava hikâye anlatımı için tasarlanmış amiral gemisi hava platformudur.',
    sku: 'DJI-MAVIC-3-PRO',
    badge: 'Yeni',
    heroTag: 'İlham Veren Görüntüler',
    price: 88999,
    stock: 8,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.9,
    reviewCount: 125,
    featureTags: ['4K Video', 'Uzun Uçuş Süresi', 'Katlanabilir', 'Profesyonel Kamera'],
    categorySlug: 'drone',
    heroImageUrl: media.heroDrone,
    heroTitle: 'DJI Mavic 3 Pro',
    heroDescription: 'Hasselblad uçlu kamera sistemi ile profesyonel çekimlerinizi zirveye taşır.',
    images: [
      { url: media.productDrone, alt: 'DJI Mavic 3 Pro ana görüntü', isPrimary: true },
      { url: media.productDroneCompact, alt: 'DJI Mavic 3 Pro yan görüntü', isPrimary: false },
      { url: media.heroDrone, alt: 'DJI Mavic 3 Pro uçuş görüntüsü', isPrimary: false },
    ],
    specs: [
      { name: 'Kamera', value: '4/3 CMOS Hasselblad' },
      { name: 'Uçuş Süresi', value: '46 dakika' },
      { name: 'Video', value: '5.1K / 50fps' },
      { name: 'İletim', value: '15 km HD video iletim' },
    ],
    gallery: gallery([
      { url: media.productDrone, alt: 'DJI Mavic 3 Pro ön görüntü' },
      { url: media.productDroneCompact, alt: 'DJI Mavic 3 Pro uçuş karesi' },
      { url: media.heroDrone, alt: 'DJI Mavic 3 Pro detay' },
    ]),
    packageOptions: packageOptions(88999, 107999),
    detailSections: detailSections(
      'DJI Mavic 3 Pro',
      'Uçlu kamera sistemi, uzun uçuş süresi ve profesyonel aktarma özellikleri ile sinema, reklam ve yüksek kalitede hava içerikleri için optimize edilmiştir.',
      ['Hasselblad uçlu kamera sistemi', '4/3 CMOS Hasselblad kamera', '46 dakika uçuş süresi', '15 km HD video iletim'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Air 3',
    slug: 'dji-air-3',
    brand: 'DJI',
    series: 'Air Serisi',
    shortDescription: 'Çift kameralı, seyahat odaklı creator drone.',
    description: 'DJI Air 3; taşınabilirlik, çift odak uzaklığı ve akıcı creator deneyimi için dengeli bir seyahat platformudur.',
    sku: 'DJI-AIR-3',
    badge: 'Yeni',
    heroTag: 'Travel Creator',
    price: 49999,
    stock: 14,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.8,
    reviewCount: 84,
    featureTags: ['4K Video', 'Katlanabilir', 'Uzun Menzil'],
    categorySlug: 'drone',
    images: [
      { url: media.productDroneCompact, alt: 'DJI Air 3 ana görüntü', isPrimary: true },
      { url: media.heroDrone, alt: 'DJI Air 3 uçuş görüntüsü', isPrimary: false },
    ],
    specs: [
      { name: 'Kamera', value: '1 inch CMOS + 70mm tele' },
      { name: 'Uçuş Süresi', value: '45 dakika' },
      { name: 'Video', value: '4K / 60fps HDR' },
    ],
    gallery: gallery([
      { url: media.productDroneCompact, alt: 'DJI Air 3 ön görüntü' },
      { url: media.heroDrone, alt: 'DJI Air 3 havada' },
    ]),
    packageOptions: packageOptions(49999, 61999),
    detailSections: detailSections(
      'DJI Air 3',
      'Çift kamera yapısı ve uzun pil ömrü ile seyahat içerik üreticileri için hızlı kurulumlu bir uçuş deneyimi sunar.',
      ['Çift kamera sistemi', '45 dakika uçuş', '4K/60fps HDR', 'O4 iletim'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Mini 4 Pro',
    discountPercent: 10,
    slug: 'dji-mini-4-pro',
    brand: 'DJI',
    series: 'Mini Serisi',
    shortDescription: 'Hafif ve her gün çekimlerine hazır creator drone.',
    description: 'Sub-249g gövdesi ile hızlı deploy edilen, mobil creator ve seyahat çekimleri için ideal DJI Mini serisi modeli.',
    sku: 'DJI-MINI-4-PRO',
    badge: null,
    heroTag: 'Ultra Light',
    price: 34999,
    stock: 18,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.7,
    reviewCount: 61,
    featureTags: ['Katlanabilir', 'Uzun Uçuş Süresi', '4K Video'],
    categorySlug: 'drone',
    images: [{ url: media.productDroneCompact, alt: 'DJI Mini 4 Pro ana görüntü', isPrimary: true }],
    specs: [
      { name: 'Ağırlık', value: 'Sub-249g' },
      { name: 'Kamera', value: '1/1.3 inch CMOS' },
      { name: 'Takip', value: 'ActiveTrack 360' },
    ],
    gallery: gallery([{ url: media.productDroneCompact, alt: 'DJI Mini 4 Pro' }]),
    packageOptions: packageOptions(34999, 44999),
    detailSections: detailSections(
      'DJI Mini 4 Pro',
      'Hafif yapısı, mobil çekim hızına ve hava hikâyeleri için pratik kullanım deneyimine odaklanır.',
      ['Sub-249g gövde', '4K HDR video', '360 takip', 'Taşınabilir tasarım'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Avata 2',
    slug: 'dji-avata-2',
    brand: 'DJI',
    series: 'FPV Serisi',
    shortDescription: 'Immersive FPV deneyimi için kompakt creator drone.',
    description: 'DJI Avata 2, yakın plan, hızlı geçişler ve etkileyici POV anlatımı için optimize edilmiştir.',
    sku: 'DJI-AVATA-2',
    badge: null,
    heroTag: 'FPV Motion',
    price: 24999,
    stock: 11,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.6,
    reviewCount: 42,
    featureTags: ['4K Video', 'Katlanabilir', 'Uzun Menzil'],
    categorySlug: 'drone',
    images: [{ url: media.productDroneCompact, alt: 'DJI Avata 2', isPrimary: true }],
    specs: [
      { name: 'Video', value: '4K / 100fps' },
      { name: 'Kontrol', value: 'FPV kontrol sistemi' },
      { name: 'Koruma', value: 'Propeller guard' },
    ],
    gallery: gallery([{ url: media.productDroneCompact, alt: 'DJI Avata 2 detay' }]),
    packageOptions: packageOptions(24999, 32999),
    detailSections: detailSections(
      'DJI Avata 2',
      'POV anlatımı, akıcı geçişler ve yakından hareketli sahneler için kompakt bir FPV çözümüdür.',
      ['4K/100fps video', 'Korumalı gövde', 'FPV odaklı kontrol', 'Yüksek manevra kabiliyeti'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Inspire 3',
    slug: 'dji-inspire-3',
    brand: 'DJI',
    series: 'Enterprise Serisi',
    shortDescription: 'Sinema prodüksiyonları için full-frame hava platformu.',
    description: 'DJI Inspire 3; yüksek bütçeli setler, reklam ve uzun metraj prodüksiyonları için premium sinema drone sistemidir.',
    sku: 'DJI-INSPIRE-3',
    badge: 'Premium',
    heroTag: 'Cinema',
    price: 249999,
    stock: 2,
    isPublished: true,
    isPurchasable: false,
    ratingAverage: 5,
    reviewCount: 18,
    featureTags: ['Profesyonel Kamera', 'Uzun Menzil'],
    categorySlug: 'drone',
    images: [{ url: media.productEnterprise, alt: 'DJI Inspire 3', isPrimary: true }],
    specs: [
      { name: 'Sensör', value: 'Full Frame 8K' },
      { name: 'Platform', value: 'Cinema Drone' },
      { name: 'Durum', value: 'Teklif Üzerine' },
    ],
    gallery: gallery([{ url: media.productEnterprise, alt: 'DJI Inspire 3 set üstü görüntü' }]),
    packageOptions: packageOptions(249999, 279999),
    detailSections: detailSections(
      'DJI Inspire 3',
      'Set üstü sinema üretimlerinde hava kamera hareketlerini profesyonel kaliteyle destekler.',
      ['Full frame 8K sistem', 'Sinema setlerine uygun gövde', 'Teklif ve keşif odaklı satış akışı'],
      media.heroEnterprise,
    ),
  },
  {
    name: 'DJI RS 3 Pro',
    slug: 'dji-rs-3-pro',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Ağır kamera rigleri için profesyonel stabilizer.',
    description: 'DJI RS 3 Pro, set içi prodüksiyonlarda ağır kamera kurulumlarını mobil biçimde stabilize eder.',
    sku: 'DJI-RS-3-PRO',
    badge: null,
    heroTag: 'Ronin Motion',
    price: 49999,
    stock: 7,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.8,
    reviewCount: 36,
    featureTags: ['4K Video', 'Uzun Pil Ömrü', 'Katlanabilir'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI RS 3 Pro', isPrimary: true }],
    specs: [
      { name: 'Payload', value: '4.5 kg' },
      { name: 'Kontrol', value: 'Bluetooth shutter' },
      { name: 'Pil', value: '12 saat' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI RS 3 Pro detay' }]),
    packageOptions: packageOptions(49999, 56999),
    detailSections: detailSections(
      'DJI RS 3 Pro',
      'Ronin serisinin profesyonel cine rig ve reklam prodüksiyonları için tasarlanmış taşınabilir stabilizer çözümüdür.',
      ['4.5 kg payload', 'Bluetooth shutter', '12 saat pil', 'Set içi hızlı dengeleme'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI RS 3 Mini',
    slug: 'dji-rs-3-mini',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Daha hafif kamera kurulumları için kompakt gimbal.',
    description: 'RS 3 Mini, aynasız kamera kullanan creator ve ekipler için kolay taşınabilir bir gimbal deneyimi sunar.',
    sku: 'DJI-RS-3-MINI',
    badge: null,
    heroTag: 'Compact Motion',
    price: 14999,
    stock: 16,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.7,
    reviewCount: 54,
    featureTags: ['Katlanabilir', 'Uzun Pil Ömrü'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI RS 3 Mini', isPrimary: true }],
    specs: [
      { name: 'Payload', value: '2 kg' },
      { name: 'Pil', value: '10 saat' },
      { name: 'Profil', value: 'Travel creator' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI RS 3 Mini detay' }]),
    packageOptions: packageOptions(14999, 18999),
    detailSections: detailSections(
      'DJI RS 3 Mini',
      'Aynasız kamera kurulumları ve mobil prodüksiyon ekipleri için dengeli ve pratik bir stabilizasyon sunar.',
      ['2 kg payload', '10 saat pil', 'Travel creator odağı'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Osmo Mobile 6',
    slug: 'dji-osmo-mobile-6',
    brand: 'DJI',
    series: 'Osmo Mobile Serisi',
    shortDescription: 'Telefon içerikleri için takip odaklı mobil gimbal.',
    description: 'Osmo Mobile 6, hızlı kurulum, takip ve sosyal içerik üreten ekipler için hafif bir mobil gimbal çözümüdür.',
    sku: 'DJI-OSMO-MOBILE-6',
    badge: null,
    heroTag: 'Mobile Creator',
    price: 6499,
    stock: 19,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.6,
    reviewCount: 73,
    featureTags: ['Katlanabilir', 'Uzun Pil Ömrü'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI Osmo Mobile 6', isPrimary: true }],
    specs: [
      { name: 'Takip', value: 'ActiveTrack' },
      { name: 'Kullanım', value: 'Telefon içerikleri' },
      { name: 'Pil', value: '6.5 saat' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI Osmo Mobile 6 yakın plan' }]),
    packageOptions: packageOptions(6499, 7999),
    detailSections: detailSections(
      'DJI Osmo Mobile 6',
      'Telefon tabanlı çekimlerde takip, hızlı açılış ve tek kişilik prodüksiyon akışını destekler.',
      ['ActiveTrack', 'Telefon odaklı tasarım', '6.5 saat pil'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Ronin 4D',
    slug: 'dji-ronin-4d',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Set içi sinema prodüksiyonları için entegre kamera platformu.',
    description: 'Ronin 4D, entegre stabilizasyon, fokus ve kamera sistemini tek gövdede toplayan premium set üstü çözümdür.',
    sku: 'DJI-RONIN-4D',
    badge: 'Cinema',
    heroTag: 'Integrated Cinema',
    price: 329999,
    stock: 2,
    isPublished: true,
    isPurchasable: false,
    ratingAverage: 4.9,
    reviewCount: 12,
    featureTags: ['Profesyonel Kamera', 'Uzun Pil Ömrü'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI Ronin 4D', isPrimary: true }],
    specs: [
      { name: 'Kamera', value: '4 eksenli entegre sistem' },
      { name: 'Profil', value: 'Cinema prodüksiyon' },
      { name: 'Durum', value: 'Teklif Üzerine' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI Ronin 4D detay' }]),
    packageOptions: packageOptions(329999, 359999),
    detailSections: detailSections(
      'DJI Ronin 4D',
      'Tek gövdede kamera, stabilizasyon ve fokus kontrolü isteyen profesyonel setler için üst seviye çözüm sunar.',
      ['4 eksenli entegre sistem', 'Cinema set workflow', 'Teklif odaklı satış akışı'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Osmo Action 4',
    slug: 'dji-osmo-action-4',
    brand: 'DJI',
    series: 'Osmo Action Serisi',
    shortDescription: 'Zor koşullar için çift ekranlı amiral gemisi aksiyon kamerası.',
    description: 'Osmo Action 4, hızlı hareket, spor ve dayanıklılık isteyen çekimler için tasarlanmış amiral gemisi aksiyon kameradır.',
    sku: 'DJI-OSMO-ACTION-4',
    badge: null,
    heroTag: 'Motion POV',
    price: 10999,
    stock: 20,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.7,
    reviewCount: 91,
    featureTags: ['4K Video', 'Uzun Pil Ömrü'],
    categorySlug: 'aksiyon-kamera',
    images: [
      { url: media.productAction, alt: 'DJI Osmo Action 4', isPrimary: true, kind: 'image', thumbnailUrl: media.productAction, mimeType: 'image/png' },
      {
        url: media.demoVideo,
        alt: 'DJI Osmo Action 4 demo video',
        isPrimary: false,
        kind: 'video',
        thumbnailUrl: media.productAction,
        mimeType: 'video/mp4',
      },
    ],
    specs: [
      { name: 'Video', value: '4K / 120fps' },
      { name: 'Gövde', value: 'Dayanıklı ve kompakt' },
      { name: 'Su Geçirmezlik', value: '18 m' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Action 4 detay' }]),
    packageOptions: packageOptions(10999, 13999),
    detailSections: detailSections(
      'DJI Osmo Action 4',
      'POV çekimler, outdoor sporlar ve aksiyon dolu içerikler için dayanıklı bir aksiyon kamera platformudur.',
      ['4K/120fps', '18 m su geçirmezlik', 'Çift ekran'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Osmo Pocket 3',
    slug: 'dji-osmo-pocket-3',
    brand: 'DJI',
    series: 'Osmo Pocket Serisi',
    shortDescription: 'Cep boyutunda gimbal kameralı creator aracı.',
    description: 'Osmo Pocket 3, vlog, backstage ve tek kişi içerik akışları için ceplerde taşınabilen gimbal kamerasıdır.',
    sku: 'DJI-OSMO-POCKET-3',
    badge: null,
    heroTag: 'Pocket Creator',
    price: 17999,
    stock: 13,
    isPublished: true,
    isPurchasable: true,
    isBestseller: true,
    ratingAverage: 4.8,
    reviewCount: 58,
    featureTags: ['4K Video', 'Katlanabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Osmo Pocket 3', isPrimary: true }],
    specs: [
      { name: 'Sensör', value: '1 inch CMOS' },
      { name: 'Ekran', value: 'Döndürülebilir OLED' },
      { name: 'Kontrol', value: '3 eksenli gimbal' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Pocket 3 dikey görüntü' }]),
    packageOptions: packageOptions(17999, 21999),
    detailSections: detailSections(
      'DJI Osmo Pocket 3',
      'Vlog ve run-and-gun çekimlerde tek kişilik prodüksiyonları hızlandıran kompakt bir gimbal kameradır.',
      ['1 inch CMOS', '3 eksenli gimbal', 'Döndürülebilir ekran'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Osmo Pocket 2',
    slug: 'dji-osmo-pocket-2',
    brand: 'DJI',
    series: 'Osmo Pocket Serisi',
    shortDescription: 'Kompakt creator çekimleri için taşınabilir pocket kamera.',
    description: 'Osmo Pocket 2, günlük vlog, backstage ve hafif creator setupları için hızlı kullanımlı pocket kamera seçeneğidir.',
    sku: 'DJI-OSMO-POCKET-2',
    badge: null,
    heroTag: 'Pocket Daily',
    price: 11999,
    stock: 17,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.6,
    reviewCount: 43,
    featureTags: ['4K Video', 'Taşınabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Osmo Pocket 2', isPrimary: true }],
    specs: [
      { name: 'Sensör', value: '1/1.7 inch CMOS' },
      { name: 'Profil', value: 'Günlük creator çekimleri' },
      { name: 'Kontrol', value: '3 eksenli gimbal' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Pocket 2 detay' }]),
    packageOptions: packageOptions(11999, 14999),
    detailSections: detailSections(
      'DJI Osmo Pocket 2',
      'Kompakt gövdesi ile hareket halindeki creator akışları, backstage ve günlük hikâye çekimleri için ideal bir kamera deneyimi sunar.',
      ['1/1.7 inch CMOS', '3 eksenli gimbal', 'Günlük creator akışı'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Mic 2',
    slug: 'dji-mic-2',
    brand: 'DJI',
    series: 'Creator Audio',
    shortDescription: 'Tek kişilik ve iki kişilik setuplar için kablosuz creator audio sistemi.',
    description: 'DJI Mic 2, vlog, set içi ve mobil creator prodüksiyonlarında net kablosuz ses toplamak için tasarlanmıştır.',
    sku: 'DJI-MIC-2',
    badge: null,
    heroTag: 'Creator Audio',
    price: 14999,
    stock: 19,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 37,
    featureTags: ['Uzun Pil Ömrü', 'Taşınabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Mic 2', isPrimary: true }],
    specs: [
      { name: 'Kayıt', value: '32-bit float' },
      { name: 'Menzil', value: '250m' },
      { name: 'Profil', value: 'Kablosuz audio' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Mic 2 detay' }]),
    packageOptions: packageOptions(14999, 17999),
    detailSections: detailSections(
      'DJI Mic 2',
      'Kablosuz ses kalitesini mobil ve sahadaki creator prodüksiyonlara taşıyan kompakt audio çözümüdür.',
      ['32-bit float kayıt', '250m menzil', 'Kablosuz creator audio'],
      media.heroAction,
    ),
  },
  {
    name: 'Intelligent Flight Battery',
    slug: 'intelligent-flight-battery',
    brand: 'DJI',
    series: 'Mavic Serisi',
    shortDescription: 'Uçuş süresini uzatan resmi DJI batarya çözümü.',
    description: 'Mavic serisi çekim günlerinde daha uzun operasyon için resmi DJI yedek batarya.',
    sku: 'DJI-BATTERY-MAVIC',
    badge: 'Yeni',
    heroTag: 'Power',
    price: 6999,
    stock: 27,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 33,
    featureTags: ['Orijinal DJI', 'Uzun Ömürlü'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'Intelligent Flight Battery', isPrimary: true }],
    specs: [
      { name: 'Uyumluluk', value: 'Mavic Serisi' },
      { name: 'Tip', value: 'Li-ion' },
      { name: 'Durum', value: 'Stokta' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'Batarya detay' }]),
    packageOptions: [{ id: 'standard', name: 'Tekli Batarya', price: 6999, isDefault: true }],
    detailSections: detailSections(
      'Intelligent Flight Battery',
      'Saha çekim günlerinde yedek güç ihtiyacını karşılar ve uçuş süresini operasyona uygun biçimde uzatır.',
      ['Resmi DJI batarya', 'Mavic serisi uyumu', 'Uzun ömürlü hücre yapısı'],
      media.heroAccessory,
    ),
  },
  {
    name: 'Battery Charging Hub',
    slug: 'battery-charging-hub',
    brand: 'DJI',
    series: 'Mavic Serisi',
    shortDescription: 'Çoklu batarya yönetimi için şarj merkezi.',
    description: 'Birden fazla bataryayı sıralı ve güvenli şekilde yönetmek isteyen ekipler için şarj merkezi.',
    sku: 'DJI-CHARGING-HUB',
    badge: null,
    heroTag: 'Charging',
    price: 2499,
    stock: 24,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.5,
    reviewCount: 26,
    featureTags: ['Hızlı Şarj', 'Taşınabilir'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'Battery Charging Hub', isPrimary: true }],
    specs: [
      { name: 'Kapasite', value: '3 batarya' },
      { name: 'Profil', value: 'Set içi şarj' },
      { name: 'Tip', value: 'Hub' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'Şarj hub detay' }]),
    packageOptions: [{ id: 'standard', name: 'Şarj Hub', price: 2499, isDefault: true }],
    detailSections: detailSections(
      'Battery Charging Hub',
      'Set günlerinde batarya döngüsünü hızlandırır ve pil yönetimini tek merkezde toplar.',
      ['3 batarya kapasitesi', 'Set içi hızlı kullanım', 'Taşınabilir gövde'],
      media.heroAccessory,
    ),
  },
  {
    name: 'DJI Shoulder Bag',
    slug: 'dji-shoulder-bag',
    brand: 'DJI',
    series: 'Taşıma',
    shortDescription: 'Günlük saha taşıması için kompakt DJI çanta.',
    description: 'Drone gövde, kumanda ve temel aksesuarlar için hafif saha taşıma çantası.',
    sku: 'DJI-SHOULDER-BAG',
    badge: null,
    heroTag: 'Carry',
    price: 1999,
    stock: 31,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.4,
    reviewCount: 47,
    featureTags: ['Taşınabilir', 'Orijinal DJI'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'DJI Shoulder Bag', isPrimary: true }],
    specs: [
      { name: 'Profil', value: 'Günlük saha kullanımı' },
      { name: 'Koruma', value: 'Yumuşak iç hacim' },
      { name: 'Uyumluluk', value: 'Drone ve aksesuarlar' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'DJI Shoulder Bag detay' }]),
    packageOptions: [{ id: 'standard', name: 'Omuz Çantası', price: 1999, isDefault: true }],
    detailSections: detailSections(
      'DJI Shoulder Bag',
      'Kompakt saha operasyonlarında ekipmanı güvenle ve hızlı şekilde taşımak için tasarlanmıştır.',
      ['Kompakt taşıma', 'Drone ve aksesuar uyumu', 'Günlük saha kullanımı'],
      media.heroAccessory,
    ),
  },
  {
    name: 'ND Filter Set',
    slug: 'nd-filter-set',
    brand: 'DJI',
    series: 'Filtre',
    shortDescription: 'Kontrollü pozlama için resmi ND filtre seti.',
    description: 'Güneşli çekim günlerinde sinematik shutter kontrolü için ND filtre çözümü.',
    sku: 'DJI-ND-FILTER-SET',
    badge: null,
    heroTag: 'Optics',
    price: 1199,
    stock: 29,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.5,
    reviewCount: 22,
    featureTags: ['Hafif', 'Orijinal DJI'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'ND Filter Set', isPrimary: true }],
    specs: [
      { name: 'Paket', value: 'ND8 / ND16 / ND32' },
      { name: 'Gövde', value: 'Hafif çelik çerçeve' },
      { name: 'Kullanım', value: 'Gün ışığında poz kontrolü' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'ND filtre seti detay' }]),
    packageOptions: [{ id: 'standard', name: 'Filtre Seti', price: 1199, isDefault: true }],
    detailSections: detailSections(
      'ND Filter Set',
      'Pozlama kontrolü ve sinematik görüntü akışı için standart drone çekim kitinin temel aksesuarlarındandır.',
      ['ND8 / ND16 / ND32', 'Hafif çerçeve', 'Gün ışığında shutter kontrolü'],
      media.heroAccessory,
    ),
  },
  {
    name: '128GB microSD Card',
    slug: '128gb-microsd-card',
    brand: 'DJI',
    series: 'Depolama',
    shortDescription: '4K video kaydı için hızlı depolama çözümü.',
    description: 'Drone ve aksiyon kameralar için yüksek hızlı 128GB medya kartı.',
    sku: 'DJI-MICROSD-128',
    badge: null,
    heroTag: 'Media',
    price: 699,
    stock: 56,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.4,
    reviewCount: 40,
    featureTags: ['Hızlı Şarj', 'Taşınabilir'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: '128GB microSD card', isPrimary: true }],
    specs: [
      { name: 'Kapasite', value: '128GB' },
      { name: 'Sınıf', value: 'UHS-I U3' },
      { name: 'Kullanım', value: '4K kayıt' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'Medya kartı detay' }]),
    packageOptions: [{ id: 'standard', name: '128GB Kart', price: 699, isDefault: true }],
    detailSections: detailSections(
      '128GB microSD Card',
      'Drone ve kamera içeriklerinin güvenli ve akıcı şekilde kaydedilmesini destekleyen hızlı depolama çözümüdür.',
      ['128GB kapasite', 'UHS-I U3', '4K kayıt uyumu'],
      media.heroAccessory,
    ),
  },
  {
    name: 'DJI Matrice 350 RTK',
    slug: 'dji-matrice-350-rtk',
    brand: 'DJI',
    series: 'Enterprise Serisi',
    shortDescription: 'Denetim ve kamu güvenliği için kurumsal görev platformu.',
    description: 'Matrice 350 RTK, enerji, denetim ve kamu güvenliği operasyonları için uzun dayanımlı kurumsal uçuş platformudur.',
    sku: 'DJI-MATRICE-350-RTK',
    badge: 'Kurumsal',
    heroTag: 'Inspection',
    price: 329999,
    stock: 3,
    isPublished: true,
    isPurchasable: false,
    ratingAverage: 4.9,
    reviewCount: 14,
    featureTags: ['Uzun Menzil', 'Profesyonel Kamera'],
    categorySlug: 'kurumsal',
    images: [{ url: media.productEnterprise, alt: 'DJI Matrice 350 RTK', isPrimary: true }],
    specs: [
      { name: 'Görev', value: 'Inspection & Public Safety' },
      { name: 'Süre', value: '55 dakika' },
      { name: 'Durum', value: 'Teklif Üzerine' },
    ],
    gallery: gallery([{ url: media.productEnterprise, alt: 'Matrice 350 RTK saha görüntüsü' }]),
    packageOptions: packageOptions(329999, 369999),
    detailSections: detailSections(
      'DJI Matrice 350 RTK',
      'Enerji, haritalama, kamu güvenliği ve saha operasyonları için uzun dayanımlı enterprise platformudur.',
      ['55 dakika süre', 'RTK destekli görev kabiliyeti', 'Teklif odaklı satış akışı'],
      media.heroEnterprise,
    ),
  },
];

const demoUsers: Array<any> = [
  { firstName: 'Bora', lastName: 'Admin', email: 'admin@borabilgicteknik.com', role: Role.ADMIN, themeMode: 'dark' },
  { firstName: 'Demo', lastName: 'Müşteri', email: 'musteri@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
  { firstName: 'Ayşe', lastName: 'Yıldırım', email: 'ayse@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'dark' },
  { firstName: 'Can', lastName: 'Kara', email: 'can@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'system' },
  { firstName: 'Selin', lastName: 'Arslan', email: 'selin@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
];

const userAddresses: Record<string, Array<{ title: string; line1: string; city: string; district: string; postalCode: string; phone: string }>> = {
  'musteri@borabilgicteknik.com': [{ title: 'Ev', line1: 'Bağdat Caddesi No: 140', city: 'İstanbul', district: 'Kadıköy', postalCode: '34728', phone: '5551112233' }],
  'ayse@borabilgicteknik.com': [{ title: 'Ofis', line1: 'Atatürk Bulvarı No: 44', city: 'Ankara', district: 'Çankaya', postalCode: '06680', phone: '5551112244' }],
  'can@borabilgicteknik.com': [{ title: 'Ev', line1: 'Ihsaniye Mah. 1443 Sok. No: 21', city: 'İzmir', district: 'Konak', postalCode: '35220', phone: '5551112255' }],
  'selin@borabilgicteknik.com': [{ title: 'Stüdyo', line1: 'Barbaros Bulvarı No: 87', city: 'İstanbul', district: 'Beşiktaş', postalCode: '34349', phone: '5551112266' }],
};

const cartScenarios: Record<string, Array<{ slug: string; quantity: number }>> = {
  'musteri@borabilgicteknik.com': [
    { slug: 'dji-mavic-3-pro', quantity: 1 },
    { slug: 'intelligent-flight-battery', quantity: 1 },
  ],
  'ayse@borabilgicteknik.com': [{ slug: 'dji-rs-3-pro', quantity: 1 }],
  'can@borabilgicteknik.com': [
    { slug: 'dji-osmo-action-4', quantity: 1 },
    { slug: '128gb-microsd-card', quantity: 2 },
  ],
};

const wishlistScenarios: Record<string, string[]> = {
  'musteri@borabilgicteknik.com': ['dji-air-3', 'dji-rs-3-mini', 'dji-osmo-pocket-3'],
  'ayse@borabilgicteknik.com': ['dji-inspire-3', 'dji-matrice-350-rtk'],
  'can@borabilgicteknik.com': ['dji-mini-4-pro', 'nd-filter-set'],
  'selin@borabilgicteknik.com': ['dji-osmo-mobile-6', 'dji-shoulder-bag'],
};

const orderScenarios: Array<any> = [
  {
    orderNumber: 'BBT-DEMO-2001',
    email: 'musteri@borabilgicteknik.com',
    status: OrderStatus.DELIVERED,
    createdAt: new Date('2026-05-20T10:00:00.000Z'),
    shippingName: 'Demo Müşteri',
    shippingPhone: '5551112233',
    shippingCity: 'İstanbul',
    shippingDistrict: 'Kadıköy',
    shippingAddressLine: 'Bağdat Caddesi No: 140',
    notes: 'Kurye ile teslim edildi.',
    items: [
      { slug: 'dji-mini-4-pro', quantity: 1 },
      { slug: 'battery-charging-hub', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-2002',
    email: 'ayse@borabilgicteknik.com',
    status: OrderStatus.SHIPPED,
    createdAt: new Date('2026-05-28T14:30:00.000Z'),
    shippingName: 'Ayşe Yıldırım',
    shippingPhone: '5551112244',
    shippingCity: 'Ankara',
    shippingDistrict: 'Çankaya',
    shippingAddressLine: 'Atatürk Bulvarı No: 44',
    notes: 'Film setine teslimat.',
    items: [
      { slug: 'dji-mavic-3-pro', quantity: 1 },
      { slug: 'dji-rs-3-mini', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-2003',
    email: 'can@borabilgicteknik.com',
    status: OrderStatus.PROCESSING,
    createdAt: new Date('2026-06-02T09:00:00.000Z'),
    shippingName: 'Can Kara',
    shippingPhone: '5551112255',
    shippingCity: 'İzmir',
    shippingDistrict: 'Konak',
    shippingAddressLine: 'Ihsaniye Mah. 1443 Sok. No: 21',
    notes: 'Kutu içi kontrol bekleniyor.',
    items: [
      { slug: 'dji-osmo-action-4', quantity: 1 },
      { slug: '128gb-microsd-card', quantity: 1 },
    ],
  },
  {
    orderNumber: 'BBT-DEMO-2004',
    email: 'selin@borabilgicteknik.com',
    status: OrderStatus.PENDING,
    createdAt: new Date('2026-06-05T12:15:00.000Z'),
    shippingName: 'Selin Arslan',
    shippingPhone: '5551112266',
    shippingCity: 'İstanbul',
    shippingDistrict: 'Beşiktaş',
    shippingAddressLine: 'Barbaros Bulvarı No: 87',
    notes: 'Muhasebe onayı bekleniyor.',
    items: [{ slug: 'dji-osmo-mobile-6', quantity: 1 }],
  },
];

const campaignFixtures = [
  {
    title: 'Yaz Sezonu Drone Kampanyası',
    badge: '%10 indirim',
    description: 'Seçili drone ve aksesuarlarda sezon indirimi başladı. Stoklar sınırlıdır.',
    linkUrl: '/kategori/drone',
    sortOrder: 0,
    isActive: true,
  },
  {
    title: 'Creator Ekipmanı Paket Fırsatı',
    badge: 'Set avantajı',
    description: 'Gimbal ve mobil video ürünlerinde set alımlarına özel fiyatlar.',
    linkUrl: '/kategori/gimbal',
    sortOrder: 1,
    isActive: true,
  },
];

async function upsertCampaigns() {
  for (const fixture of campaignFixtures) {
    const existing = await prisma.campaign.findFirst({ where: { title: fixture.title } });

    if (existing) {
      await prisma.campaign.update({ where: { id: existing.id }, data: fixture });
    } else {
      await prisma.campaign.create({ data: fixture });
    }
  }
}

const heroSlideFixtures = [
  {
    title: 'İlham Veren Görüntüler',
    subtitle: 'DJI Mavic 3 Pro ile sinema kalitesinde hava çekimleri.',
    ctaText: 'KEŞFET',
    ctaLink: '/kategori/drone',
    imageUrl: media.heroDrone,
    sortOrder: 0,
    isActive: true,
  },
  {
    title: 'Yaratıcılığını Harekete Geçir',
    subtitle: 'Osmo Pocket 3 ve gimbal sistemleri ile akıcı hikâyeler anlat.',
    ctaText: 'İNCELE',
    ctaLink: '/kategori/gimbal',
    imageUrl: media.heroGimbal,
    sortOrder: 1,
    isActive: true,
  },
  {
    title: 'Her Anı Yakala',
    subtitle: 'Aksiyon kameralar ve pocket serisi ile macerayı kaydet.',
    ctaText: 'KATALOG',
    ctaLink: '/katalog',
    imageUrl: media.heroAction,
    sortOrder: 2,
    isActive: true,
  },
];

async function upsertHeroSlides() {
  for (const fixture of heroSlideFixtures) {
    const existing = await prisma.heroSlide.findFirst({ where: { title: fixture.title } });

    if (existing) {
      await prisma.heroSlide.update({ where: { id: existing.id }, data: fixture });
    } else {
      await prisma.heroSlide.create({ data: fixture });
    }
  }
}

async function upsertCategories() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
}

/**
 * Custom (admin-created) products must survive a re-seed: the seed upserts
 * its own fixtures and never deletes what it does not own.
 */
async function cleanupCatalog() {
  return;
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

    const productData = {
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      series: product.series,
      shortDescription: product.shortDescription,
      description: product.description,
      sku: product.sku,
      badge: product.badge,
      heroTag: product.heroTag,
      price: product.price,
      stock: product.stock,
      discountPercent: product.discountPercent ?? 0,
      isPublished: product.isPublished,
      isPurchasable: product.isPurchasable,
      isBestseller: product.isBestseller ?? false,
      featureTags: [...product.featureTags],
      ratingAverage: product.ratingAverage,
      reviewCount: product.reviewCount,
      heroImageUrl: product.heroImageUrl ?? null,
      heroTitle: product.heroTitle ?? null,
      heroDescription: product.heroDescription ?? null,
      gallery: product.gallery,
      packageOptions: product.packageOptions,
      detailSections: product.detailSections,
      categoryId: category.id,
    };

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...productData,
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
        ...productData,
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
        emailVerified: true,
      },
      create: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash,
        role: user.role,
        emailVerified: true,
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
    const items = scenario.items.map((item: { slug: string; quantity: number }) => {
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

    const total = items.reduce((sum: number, item: { lineTotal: number }) => sum + item.lineTotal, 0);

    await prisma.order.create({
      data: {
        orderNumber: scenario.orderNumber,
        status: scenario.status,
        total,
        // Demo orders represent completed sales: they must appear in the
        // paid-only admin queue and dashboard totals.
        paymentStatus: 'PAID',
        paymentAmount: total,
        paymentCurrency: 'TL',
        paymentMethod: 'card',
        paymentType: 'card',
        paidAt: scenario.createdAt,
        paymentNotifiedAt: scenario.createdAt,
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
  await upsertCampaigns();
  await upsertHeroSlides();
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
