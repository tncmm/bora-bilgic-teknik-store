import type { Language } from './i18n';
import { getIntlLocale } from './i18n';

export function formatCurrency(value: number, language: Language = 'tr') {
  return new Intl.NumberFormat(getIntlLocale(language), {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string, language: Language = 'tr') {
  return new Intl.DateTimeFormat(getIntlLocale(language), {
    dateStyle: 'medium',
  }).format(new Date(value));
}
