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
      description: 'Govde, temel aksesuarlar ve hizli baslangic kurulumu.',
      isDefault: true,
    },
    {
      id: 'combo',
      name: 'Fly More Combo',
      price: deluxePrice,
      description: 'Ek pil, sarj hub, tasima cozumleri ve creator aksesuarlar.',
      isDefault: false,
    },
  ];
}

function detailSections(name: string, narrative: string, bullets: string[], imageUrl: string) {
  return [
    {
      id: 'aciklama',
      label: 'Aciklama',
      heading: `${name} ile yeni cekim standardi`,
      body: narrative,
      bullets,
      imageUrl,
    },
    {
      id: 'ozellikler',
      label: 'Ozellikler',
      heading: 'One cikan teknik noktalar',
      bullets,
      imageUrl: null,
    },
    {
      id: 'kutu-icerigi',
      label: 'Kutu Icerigi',
      body: 'Govde, koruyucu aksesuarlari ve gunluk uretim akisini tamamlayan temel set icerigi ile gelir.',
      bullets: ['Ana govde', 'Batarya / guc paketi', 'Baglanti kablolari', 'Tasima ve koruma aksesuarlari'],
      imageUrl: null,
    },
    {
      id: 'yorumlar',
      label: 'Yorumlar',
      body: 'Demo surumde yorum kartlari yerine ozet puanlama ve kullanim senaryosu gorunur.',
      bullets: ['Profesyonel cekim ekipleri tarafindan tercih edilir', 'Hizli kurulum ve teknik destek akisina uygundur'],
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
    description: "DJI drone'lari ile sinema, seyahat ve creator cekimleri icin hava platformlari.",
    heroTitle: 'DRONE',
    heroDescription: "DJI drone'lari ile sinirlari asin ve gokyuzunden carpici acilari yakalayin.",
    heroImageUrl: media.heroDrone,
    sortOrder: 1,
  },
  {
    name: 'Gimbal',
    slug: 'gimbal',
    description: "DJI gimbal'lari ile her cekimde profesyonel stabilizasyon.",
    heroTitle: 'GIMBAL',
    heroDescription: "DJI gimbal'lari ile her cekimde profesyonel stabilizasyon.",
    heroImageUrl: media.heroGimbal,
    sortOrder: 2,
  },
  {
    name: 'Aksiyon Kamera',
    slug: 'aksiyon-kamera',
    description: 'DJI aksiyon kameralar, pocket serileri ve mobil creator sistemleri.',
    heroTitle: 'AKSIYON KAMERA',
    heroDescription: 'Her ani yakalayan aksiyon kamera ve pocket sistemleri.',
    heroImageUrl: media.heroAction,
    sortOrder: 3,
  },
  {
    name: 'Aksesuar',
    slug: 'aksesuar',
    description: 'Batarya, sarj, tasima, filtre ve medya tarafinda DJI ekosistemini tamamlayan aksesuarlar.',
    heroTitle: 'AKSESUAR',
    heroDescription: 'DJI aksesuarlari ile deneyimini en ust seviyeye cikarin.',
    heroImageUrl: media.heroAccessory,
    sortOrder: 4,
  },
  {
    name: 'Kurumsal',
    slug: 'kurumsal',
    description: 'Denetim, guvenlik ve saha operasyonlari icin enterprise DJI platformlari.',
    heroTitle: 'KURUMSAL',
    heroDescription: 'Kurumsal gorevler icin guvenilir, uzun dayanimli ve saha odakli DJI platformlari.',
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
    shortDescription: 'Uc kameralı amiral gemisi sinema dronu.',
    description: 'DJI Mavic 3 Pro, coklu odak uzakliklari ve profesyonel hava hikaye anlatimi icin tasarlanmis amiral gemisi hava platformudur.',
    sku: 'DJI-MAVIC-3-PRO',
    badge: 'Yeni',
    heroTag: 'Ilham Veren Goruntuler',
    price: 88999,
    stock: 8,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.9,
    reviewCount: 125,
    featureTags: ['4K Video', 'Uzun Ucus Suresi', 'Katlanabilir', 'Profesyonel Kamera'],
    categorySlug: 'drone',
    heroImageUrl: media.heroDrone,
    heroTitle: 'DJI Mavic 3 Pro',
    heroDescription: 'Hasselblad uclu kamera sistemi ile profesyonel cekimlerinizi zirveye tasir.',
    images: [
      { url: media.productDrone, alt: 'DJI Mavic 3 Pro ana goruntu', isPrimary: true },
      { url: media.productDroneCompact, alt: 'DJI Mavic 3 Pro yan goruntu', isPrimary: false },
      { url: media.heroDrone, alt: 'DJI Mavic 3 Pro ucus goruntu', isPrimary: false },
    ],
    specs: [
      { name: 'Kamera', value: '4/3 CMOS Hasselblad' },
      { name: 'Ucus Suresi', value: '46 dakika' },
      { name: 'Video', value: '5.1K / 50fps' },
      { name: 'Iletim', value: '15 km HD video iletim' },
    ],
    gallery: gallery([
      { url: media.productDrone, alt: 'DJI Mavic 3 Pro on goruntu' },
      { url: media.productDroneCompact, alt: 'DJI Mavic 3 Pro ucus karesi' },
      { url: media.heroDrone, alt: 'DJI Mavic 3 Pro detay' },
    ]),
    packageOptions: packageOptions(88999, 107999),
    detailSections: detailSections(
      'DJI Mavic 3 Pro',
      'Uclu kamera sistemi, uzun ucus suresi ve profesyonel aktarma ozellikleri ile sinema, reklam ve yuksek kalitede hava icerikleri icin optimize edilmistir.',
      ['Hasselblad uclu kamera sistemi', '4/3 CMOS Hasselblad kamera', '46 dakika ucus suresi', '15 km HD video iletim'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Air 3',
    slug: 'dji-air-3',
    brand: 'DJI',
    series: 'Air Serisi',
    shortDescription: 'Cift kameralı, seyahat odakli creator drone.',
    description: 'DJI Air 3; tasinabilirlik, cift odak uzakligi ve akici creator deneyimi icin dengeli bir seyahat platformudur.',
    sku: 'DJI-AIR-3',
    badge: 'Yeni',
    heroTag: 'Travel Creator',
    price: 49999,
    stock: 14,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.8,
    reviewCount: 84,
    featureTags: ['4K Video', 'Katlanabilir', 'Uzun Menzil'],
    categorySlug: 'drone',
    images: [
      { url: media.productDroneCompact, alt: 'DJI Air 3 ana goruntu', isPrimary: true },
      { url: media.heroDrone, alt: 'DJI Air 3 ucus goruntu', isPrimary: false },
    ],
    specs: [
      { name: 'Kamera', value: '1 inch CMOS + 70mm tele' },
      { name: 'Ucus Suresi', value: '45 dakika' },
      { name: 'Video', value: '4K / 60fps HDR' },
    ],
    gallery: gallery([
      { url: media.productDroneCompact, alt: 'DJI Air 3 on goruntu' },
      { url: media.heroDrone, alt: 'DJI Air 3 havada' },
    ]),
    packageOptions: packageOptions(49999, 61999),
    detailSections: detailSections(
      'DJI Air 3',
      'Cift kamera yapisi ve uzun pil omru ile seyahat icerik ureticileri icin hizli kurulumlu bir ucus deneyimi sunar.',
      ['Cift kamera sistemi', '45 dakika ucus', '4K/60fps HDR', 'O4 iletim'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Mini 4 Pro',
    discountPercent: 10,
    slug: 'dji-mini-4-pro',
    brand: 'DJI',
    series: 'Mini Serisi',
    shortDescription: 'Hafif ve her gun cekimlerine hazir creator drone.',
    description: 'Sub-249g govdesi ile hizli deploy edilen, mobil creator ve seyahat cekimleri icin ideal DJI Mini serisi modeli.',
    sku: 'DJI-MINI-4-PRO',
    badge: null,
    heroTag: 'Ultra Light',
    price: 34999,
    stock: 18,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 61,
    featureTags: ['Katlanabilir', 'Uzun Ucus Suresi', '4K Video'],
    categorySlug: 'drone',
    images: [{ url: media.productDroneCompact, alt: 'DJI Mini 4 Pro ana goruntu', isPrimary: true }],
    specs: [
      { name: 'Agirlik', value: 'Sub-249g' },
      { name: 'Kamera', value: '1/1.3 inch CMOS' },
      { name: 'Takip', value: 'ActiveTrack 360' },
    ],
    gallery: gallery([{ url: media.productDroneCompact, alt: 'DJI Mini 4 Pro' }]),
    packageOptions: packageOptions(34999, 44999),
    detailSections: detailSections(
      'DJI Mini 4 Pro',
      'Hafif yapisi, mobil cekim hizina ve hava hikayeleri icin pratik kullanim deneyimine odaklanir.',
      ['Sub-249g govde', '4K HDR video', '360 takip', 'Tasinabilir tasarim'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Avata 2',
    slug: 'dji-avata-2',
    brand: 'DJI',
    series: 'FPV Serisi',
    shortDescription: 'Immersive FPV deneyimi icin kompakt creator drone.',
    description: 'DJI Avata 2, yakin plan, hizli gecisler ve etkileyici POV anlatimi icin optimize edilmistir.',
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
      'POV anlatimi, akici gecisler ve yakindan hareketli sahneler icin kompakt bir FPV cozumudur.',
      ['4K/100fps video', 'Korumali govde', 'FPV odakli kontrol', 'Yuksek manevra kabiliyeti'],
      media.heroDrone,
    ),
  },
  {
    name: 'DJI Inspire 3',
    slug: 'dji-inspire-3',
    brand: 'DJI',
    series: 'Enterprise Serisi',
    shortDescription: 'Sinema prodüksiyonlari icin full-frame hava platformu.',
    description: 'DJI Inspire 3; yuksek butceli setler, reklam ve uzun metraj prodüksiyonlari icin premium sinema drone sistemidir.',
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
      { name: 'Sensor', value: 'Full Frame 8K' },
      { name: 'Platform', value: 'Cinema Drone' },
      { name: 'Durum', value: 'Teklif Uzerine' },
    ],
    gallery: gallery([{ url: media.productEnterprise, alt: 'DJI Inspire 3 set ustu goruntu' }]),
    packageOptions: packageOptions(249999, 279999),
    detailSections: detailSections(
      'DJI Inspire 3',
      'Set ustu sinema uretimlerinde hava kamera hareketlerini profesyonel kaliteyle destekler.',
      ['Full frame 8K sistem', 'Sinema setlerine uygun govde', 'Teklif ve kesif odakli satis akisi'],
      media.heroEnterprise,
    ),
  },
  {
    name: 'DJI RS 3 Pro',
    slug: 'dji-rs-3-pro',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Agir kamera rigleri icin profesyonel stabilizer.',
    description: 'DJI RS 3 Pro, set ici prodüksiyonlarda agir kamera kurulumlarini mobil bicimde stabilize eder.',
    sku: 'DJI-RS-3-PRO',
    badge: null,
    heroTag: 'Ronin Motion',
    price: 49999,
    stock: 7,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.8,
    reviewCount: 36,
    featureTags: ['4K Video', 'Uzun Pil Omru', 'Katlanabilir'],
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
      'Ronin serisinin profesyonel cine rig ve reklam prodüksiyonlari icin tasarlanmis tasinabilir stabilizer cozumudur.',
      ['4.5 kg payload', 'Bluetooth shutter', '12 saat pil', 'Set ici hizli dengeleme'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI RS 3 Mini',
    slug: 'dji-rs-3-mini',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Daha hafif kamera kurulumlari icin kompakt gimbal.',
    description: 'RS 3 Mini, aynasiz kamera kullanan creator ve ekipler icin kolay tasinabilir bir gimbal deneyimi sunar.',
    sku: 'DJI-RS-3-MINI',
    badge: null,
    heroTag: 'Compact Motion',
    price: 14999,
    stock: 16,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 54,
    featureTags: ['Katlanabilir', 'Uzun Pil Omru'],
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
      'Aynasiz kamera kurulumlari ve mobil prodüksiyon ekipleri icin dengeli ve pratik bir stabilizasyon sunar.',
      ['2 kg payload', '10 saat pil', 'Travel creator odağı'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Osmo Mobile 6',
    slug: 'dji-osmo-mobile-6',
    brand: 'DJI',
    series: 'Osmo Mobile Serisi',
    shortDescription: 'Telefon icerikleri icin takip odakli mobil gimbal.',
    description: 'Osmo Mobile 6, hizli kurulum, takip ve sosyal icerik ureten ekipler icin hafif bir mobil gimbal cozumudur.',
    sku: 'DJI-OSMO-MOBILE-6',
    badge: null,
    heroTag: 'Mobile Creator',
    price: 6499,
    stock: 19,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.6,
    reviewCount: 73,
    featureTags: ['Katlanabilir', 'Uzun Pil Omru'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI Osmo Mobile 6', isPrimary: true }],
    specs: [
      { name: 'Takip', value: 'ActiveTrack' },
      { name: 'Kullanim', value: 'Telefon icerikleri' },
      { name: 'Pil', value: '6.5 saat' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI Osmo Mobile 6 yakin plan' }]),
    packageOptions: packageOptions(6499, 7999),
    detailSections: detailSections(
      'DJI Osmo Mobile 6',
      'Telefon tabanli cekimlerde takip, hizli acilis ve tek kisilik prodüksiyon akisini destekler.',
      ['ActiveTrack', 'Telefon odakli tasarim', '6.5 saat pil'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Ronin 4D',
    slug: 'dji-ronin-4d',
    brand: 'DJI',
    series: 'Ronin Serisi',
    shortDescription: 'Set ici sinema prodüksiyonlari icin entegre kamera platformu.',
    description: 'Ronin 4D, entegre stabilizasyon, fokus ve kamera sistemini tek govdede toplayan premium set ustu cozumdur.',
    sku: 'DJI-RONIN-4D',
    badge: 'Cinema',
    heroTag: 'Integrated Cinema',
    price: 329999,
    stock: 2,
    isPublished: true,
    isPurchasable: false,
    ratingAverage: 4.9,
    reviewCount: 12,
    featureTags: ['Profesyonel Kamera', 'Uzun Pil Omru'],
    categorySlug: 'gimbal',
    images: [{ url: media.productGimbal, alt: 'DJI Ronin 4D', isPrimary: true }],
    specs: [
      { name: 'Kamera', value: '4 eksenli entegre sistem' },
      { name: 'Profil', value: 'Cinema prodüksiyon' },
      { name: 'Durum', value: 'Teklif Uzerine' },
    ],
    gallery: gallery([{ url: media.productGimbal, alt: 'DJI Ronin 4D detay' }]),
    packageOptions: packageOptions(329999, 359999),
    detailSections: detailSections(
      'DJI Ronin 4D',
      'Tek govdede kamera, stabilizasyon ve fokus kontrolu isteyen profesyonel setler icin ust seviye cozum sunar.',
      ['4 eksenli entegre sistem', 'Cinema set workflow', 'Teklif odakli satis akisi'],
      media.heroGimbal,
    ),
  },
  {
    name: 'DJI Osmo Action 4',
    slug: 'dji-osmo-action-4',
    brand: 'DJI',
    series: 'Osmo Action Serisi',
    shortDescription: 'Zor kosullar icin cift ekranli amiral gemisi aksiyon kamerası.',
    description: 'Osmo Action 4, hizli hareket, spor ve dayaniklilik isteyen cekimler icin tasarlanmis amiral gemisi aksiyon kameradir.',
    sku: 'DJI-OSMO-ACTION-4',
    badge: null,
    heroTag: 'Motion POV',
    price: 10999,
    stock: 20,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 91,
    featureTags: ['4K Video', 'Uzun Pil Omru'],
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
      { name: 'Govde', value: 'Dayanikli ve kompakt' },
      { name: 'Su Gecirmezlik', value: '18 m' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Action 4 detay' }]),
    packageOptions: packageOptions(10999, 13999),
    detailSections: detailSections(
      'DJI Osmo Action 4',
      'POV cekimler, outdoor sporlar ve aksiyon dolu icerikler icin dayanikli bir aksiyon kamera platformudur.',
      ['4K/120fps', '18 m su gecirmezlik', 'Cift ekran'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Osmo Pocket 3',
    slug: 'dji-osmo-pocket-3',
    brand: 'DJI',
    series: 'Osmo Pocket Serisi',
    shortDescription: 'Cep boyutunda gimbal kameralı creator araci.',
    description: 'Osmo Pocket 3, vlog, backstage ve tek kisi icerik akislari icin ceplerde tasinabilen gimbal kamerasidir.',
    sku: 'DJI-OSMO-POCKET-3',
    badge: null,
    heroTag: 'Pocket Creator',
    price: 17999,
    stock: 13,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.8,
    reviewCount: 58,
    featureTags: ['4K Video', 'Katlanabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Osmo Pocket 3', isPrimary: true }],
    specs: [
      { name: 'Sensor', value: '1 inch CMOS' },
      { name: 'Ekran', value: 'Dondurulebilir OLED' },
      { name: 'Kontrol', value: '3 eksenli gimbal' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Pocket 3 dikey goruntu' }]),
    packageOptions: packageOptions(17999, 21999),
    detailSections: detailSections(
      'DJI Osmo Pocket 3',
      'Vlog ve run-and-gun cekimlerde tek kisilik prodüksiyonlari hizlandiran kompakt bir gimbal kameradir.',
      ['1 inch CMOS', '3 eksenli gimbal', 'Dondurulebilir ekran'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Osmo Pocket 2',
    slug: 'dji-osmo-pocket-2',
    brand: 'DJI',
    series: 'Osmo Pocket Serisi',
    shortDescription: 'Kompakt creator cekimleri icin tasinabilir pocket kamera.',
    description: 'Osmo Pocket 2, gunluk vlog, backstage ve hafif creator setuplari icin hizli kullanimli pocket kamera secenegidir.',
    sku: 'DJI-OSMO-POCKET-2',
    badge: null,
    heroTag: 'Pocket Daily',
    price: 11999,
    stock: 17,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.6,
    reviewCount: 43,
    featureTags: ['4K Video', 'Tasinabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Osmo Pocket 2', isPrimary: true }],
    specs: [
      { name: 'Sensor', value: '1/1.7 inch CMOS' },
      { name: 'Profil', value: 'Gunluk creator cekimleri' },
      { name: 'Kontrol', value: '3 eksenli gimbal' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Osmo Pocket 2 detay' }]),
    packageOptions: packageOptions(11999, 14999),
    detailSections: detailSections(
      'DJI Osmo Pocket 2',
      'Kompakt govdesi ile hareket halindeki creator akislari, backstage ve gunluk hikaye cekimleri icin ideal bir kamera deneyimi sunar.',
      ['1/1.7 inch CMOS', '3 eksenli gimbal', 'Gunluk creator akisi'],
      media.heroAction,
    ),
  },
  {
    name: 'DJI Mic 2',
    slug: 'dji-mic-2',
    brand: 'DJI',
    series: 'Creator Audio',
    shortDescription: 'Tek kisilik ve iki kisilik setuplar icin kablosuz creator audio sistemi.',
    description: 'DJI Mic 2, vlog, set ici ve mobil creator prodüksiyonlarinda net kablosuz ses toplamak icin tasarlanmistir.',
    sku: 'DJI-MIC-2',
    badge: null,
    heroTag: 'Creator Audio',
    price: 14999,
    stock: 19,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 37,
    featureTags: ['Uzun Pil Omru', 'Tasinabilir'],
    categorySlug: 'aksiyon-kamera',
    images: [{ url: media.productAction, alt: 'DJI Mic 2', isPrimary: true }],
    specs: [
      { name: 'Kayit', value: '32-bit float' },
      { name: 'Menzil', value: '250m' },
      { name: 'Profil', value: 'Kablosuz audio' },
    ],
    gallery: gallery([{ url: media.productAction, alt: 'DJI Mic 2 detay' }]),
    packageOptions: packageOptions(14999, 17999),
    detailSections: detailSections(
      'DJI Mic 2',
      'Kablosuz ses kalitesini mobil ve sahadaki creator prodüksiyonlara tasiyan kompakt audio cozumudur.',
      ['32-bit float kayit', '250m menzil', 'Kablosuz creator audio'],
      media.heroAction,
    ),
  },
  {
    name: 'Intelligent Flight Battery',
    slug: 'intelligent-flight-battery',
    brand: 'DJI',
    series: 'Mavic Serisi',
    shortDescription: 'Ucus suresini uzatan resmi DJI batarya cozumü.',
    description: 'Mavic serisi cekim gunlerinde daha uzun operasyon icin resmi DJI yedek batarya.',
    sku: 'DJI-BATTERY-MAVIC',
    badge: 'Yeni',
    heroTag: 'Power',
    price: 6999,
    stock: 27,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.7,
    reviewCount: 33,
    featureTags: ['Orijinal DJI', 'Uzun Omurlu'],
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
      'Saha cekim gunlerinde yedek guc ihtiyacini karsilar ve ucus suresini operasyona uygun bicimde uzatir.',
      ['Resmi DJI batarya', 'Mavic serisi uyumu', 'Uzun omurlu hucre yapisi'],
      media.heroAccessory,
    ),
  },
  {
    name: 'Battery Charging Hub',
    slug: 'battery-charging-hub',
    brand: 'DJI',
    series: 'Mavic Serisi',
    shortDescription: 'Coklu batarya yonetimi icin sarj merkezi.',
    description: 'Birden fazla bataryayi sirali ve guvenli sekilde yonetmek isteyen ekipler icin sarj merkezi.',
    sku: 'DJI-CHARGING-HUB',
    badge: null,
    heroTag: 'Charging',
    price: 2499,
    stock: 24,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.5,
    reviewCount: 26,
    featureTags: ['Hizli Sarj', 'Tasinabilir'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'Battery Charging Hub', isPrimary: true }],
    specs: [
      { name: 'Kapasite', value: '3 batarya' },
      { name: 'Profil', value: 'Set ici sarj' },
      { name: 'Tip', value: 'Hub' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'Sarj hub detay' }]),
    packageOptions: [{ id: 'standard', name: 'Sarj Hub', price: 2499, isDefault: true }],
    detailSections: detailSections(
      'Battery Charging Hub',
      'Set gunlerinde batarya dongusunu hizlandirir ve pil yonetimini tek merkezde toplar.',
      ['3 batarya kapasitesi', 'Set ici hizli kullanim', 'Tasinabilir govde'],
      media.heroAccessory,
    ),
  },
  {
    name: 'DJI Shoulder Bag',
    slug: 'dji-shoulder-bag',
    brand: 'DJI',
    series: 'Tasima',
    shortDescription: 'Gunluk saha tasimasi icin kompakt DJI canta.',
    description: 'Drone govde, kumanda ve temel aksesuarlar icin hafif saha tasima cantasi.',
    sku: 'DJI-SHOULDER-BAG',
    badge: null,
    heroTag: 'Carry',
    price: 1999,
    stock: 31,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.4,
    reviewCount: 47,
    featureTags: ['Tasinabilir', 'Orijinal DJI'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: 'DJI Shoulder Bag', isPrimary: true }],
    specs: [
      { name: 'Profil', value: 'Gunluk saha kullanimi' },
      { name: 'Koruma', value: 'Yumusak ic hacim' },
      { name: 'Uyumluluk', value: 'Drone ve aksesuarlar' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'DJI Shoulder Bag detay' }]),
    packageOptions: [{ id: 'standard', name: 'Omuz Cantasi', price: 1999, isDefault: true }],
    detailSections: detailSections(
      'DJI Shoulder Bag',
      'Kompakt saha operasyonlarinda ekipmani guvenle ve hizli sekilde tasimak icin tasarlanmistir.',
      ['Kompakt tasima', 'Drone ve aksesuar uyumu', 'Gunluk saha kullanimi'],
      media.heroAccessory,
    ),
  },
  {
    name: 'ND Filter Set',
    slug: 'nd-filter-set',
    brand: 'DJI',
    series: 'Filtre',
    shortDescription: 'Kontrollu pozlama icin resmi ND filtre seti.',
    description: 'Gunesli cekim gunlerinde sinematik shutter kontrolu icin ND filtre cozumü.',
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
      { name: 'Govde', value: 'Hafif celik cerceve' },
      { name: 'Kullanim', value: 'Gunisikta poz kontrolu' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'ND filtre seti detay' }]),
    packageOptions: [{ id: 'standard', name: 'Filtre Seti', price: 1199, isDefault: true }],
    detailSections: detailSections(
      'ND Filter Set',
      'Pozlama kontrolu ve sinematik goruntu akisi icin standart drone cekim kitinin temel aksesuarlarindandir.',
      ['ND8 / ND16 / ND32', 'Hafif cerceve', 'Gunisikta shutter kontrolu'],
      media.heroAccessory,
    ),
  },
  {
    name: '128GB microSD Card',
    slug: '128gb-microsd-card',
    brand: 'DJI',
    series: 'Depolama',
    shortDescription: '4K video kaydi icin hizli depolama cozumü.',
    description: 'Drone ve aksiyon kameralar icin yuksek hizli 128GB medya karti.',
    sku: 'DJI-MICROSD-128',
    badge: null,
    heroTag: 'Media',
    price: 699,
    stock: 56,
    isPublished: true,
    isPurchasable: true,
    ratingAverage: 4.4,
    reviewCount: 40,
    featureTags: ['Hizli Sarj', 'Tasinabilir'],
    categorySlug: 'aksesuar',
    images: [{ url: media.productAccessory, alt: '128GB microSD card', isPrimary: true }],
    specs: [
      { name: 'Kapasite', value: '128GB' },
      { name: 'Sinif', value: 'UHS-I U3' },
      { name: 'Kullanim', value: '4K kayit' },
    ],
    gallery: gallery([{ url: media.productAccessory, alt: 'Medya karti detay' }]),
    packageOptions: [{ id: 'standard', name: '128GB Kart', price: 699, isDefault: true }],
    detailSections: detailSections(
      '128GB microSD Card',
      'Drone ve kamera iceriklerinin guvenli ve akici sekilde kaydedilmesini destekleyen hizli depolama cozumudur.',
      ['128GB kapasite', 'UHS-I U3', '4K kayit uyumu'],
      media.heroAccessory,
    ),
  },
  {
    name: 'DJI Matrice 350 RTK',
    slug: 'dji-matrice-350-rtk',
    brand: 'DJI',
    series: 'Enterprise Serisi',
    shortDescription: 'Denetim ve kamu guvenligi icin kurumsal gorev platformu.',
    description: 'Matrice 350 RTK, enerji, denetim ve kamu guvenligi operasyonlari icin uzun dayanimli kurumsal ucus platformudur.',
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
      { name: 'Gorev', value: 'Inspection & Public Safety' },
      { name: 'Sure', value: '55 dakika' },
      { name: 'Durum', value: 'Teklif Uzerine' },
    ],
    gallery: gallery([{ url: media.productEnterprise, alt: 'Matrice 350 RTK saha goruntu' }]),
    packageOptions: packageOptions(329999, 369999),
    detailSections: detailSections(
      'DJI Matrice 350 RTK',
      'Enerji, haritalama, kamu guvenligi ve saha operasyonlari icin uzun dayanimli enterprise platformudur.',
      ['55 dakika sure', 'RTK destekli gorev kabiliyeti', 'Teklif odakli satis akisi'],
      media.heroEnterprise,
    ),
  },
];

const demoUsers: Array<any> = [
  { firstName: 'Bora', lastName: 'Admin', email: 'admin@borabilgicteknik.com', role: Role.ADMIN, themeMode: 'dark' },
  { firstName: 'Demo', lastName: 'Musteri', email: 'musteri@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
  { firstName: 'Ayse', lastName: 'Yildirim', email: 'ayse@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'dark' },
  { firstName: 'Can', lastName: 'Kara', email: 'can@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'system' },
  { firstName: 'Selin', lastName: 'Arslan', email: 'selin@borabilgicteknik.com', role: Role.CUSTOMER, themeMode: 'light' },
];

const userAddresses: Record<string, Array<{ title: string; line1: string; city: string; district: string; postalCode: string; phone: string }>> = {
  'musteri@borabilgicteknik.com': [{ title: 'Ev', line1: 'Bagdat Caddesi No: 140', city: 'Istanbul', district: 'Kadikoy', postalCode: '34728', phone: '5551112233' }],
  'ayse@borabilgicteknik.com': [{ title: 'Ofis', line1: 'Ataturk Bulvari No: 44', city: 'Ankara', district: 'Cankaya', postalCode: '06680', phone: '5551112244' }],
  'can@borabilgicteknik.com': [{ title: 'Ev', line1: 'Ihsaniye Mah. 1443 Sok. No: 21', city: 'Izmir', district: 'Konak', postalCode: '35220', phone: '5551112255' }],
  'selin@borabilgicteknik.com': [{ title: 'Studyo', line1: 'Barbaros Bulvari No: 87', city: 'Istanbul', district: 'Besiktas', postalCode: '34349', phone: '5551112266' }],
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
    shippingName: 'Demo Musteri',
    shippingPhone: '5551112233',
    shippingCity: 'Istanbul',
    shippingDistrict: 'Kadikoy',
    shippingAddressLine: 'Bagdat Caddesi No: 140',
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
    shippingName: 'Ayse Yildirim',
    shippingPhone: '5551112244',
    shippingCity: 'Ankara',
    shippingDistrict: 'Cankaya',
    shippingAddressLine: 'Ataturk Bulvari No: 44',
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
    shippingCity: 'Izmir',
    shippingDistrict: 'Konak',
    shippingAddressLine: 'Ihsaniye Mah. 1443 Sok. No: 21',
    notes: 'Kutu ici kontrol bekleniyor.',
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
    shippingCity: 'Istanbul',
    shippingDistrict: 'Besiktas',
    shippingAddressLine: 'Barbaros Bulvari No: 87',
    notes: 'Muhasebe onayi bekleniyor.',
    items: [{ slug: 'dji-osmo-mobile-6', quantity: 1 }],
  },
];

const campaignFixtures = [
  {
    title: 'Yaz Sezonu Drone Kampanyasi',
    badge: '%10 indirim',
    description: 'Secili drone ve aksesuarlarda sezon indirimi basladi. Stoklar sinirlidir.',
    linkUrl: '/kategori/drone',
    sortOrder: 0,
    isActive: true,
  },
  {
    title: 'Creator Ekipmani Paket Firsati',
    badge: 'Set avantaji',
    description: 'Gimbal ve mobil video urunlerinde set alimlarina ozel fiyatlar.',
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
