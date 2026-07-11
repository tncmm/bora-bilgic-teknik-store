import type { CatalogSectionSlug } from '@bora/types';

export interface SectionDefinition {
  slug: CatalogSectionSlug;
  label: string;
  path: string;
  legacyCategories?: string[];
}

export const storefrontSections: SectionDefinition[] = [
  { slug: 'drone', label: 'Drone', path: '/drone', legacyCategories: ['camera-drones'] },
  { slug: 'gimbal', label: 'Gimbal', path: '/gimbal', legacyCategories: ['handheld'] },
  { slug: 'aksiyon-kamera', label: 'Aksiyon Kamera', path: '/aksiyon-kamera' },
  { slug: 'aksesuar', label: 'Aksesuar', path: '/aksesuar' },
  { slug: 'kurumsal', label: 'Kurumsal', path: '/kurumsal', legacyCategories: ['enterprise'] },
];

export function findSectionBySlug(slug?: string | null) {
  if (!slug) return undefined;

  return storefrontSections.find(
    (section) => section.slug === slug || section.legacyCategories?.includes(slug),
  );
}

export function mapLegacyCategoryToSection(slug?: string | null) {
  return findSectionBySlug(slug)?.slug;
}
