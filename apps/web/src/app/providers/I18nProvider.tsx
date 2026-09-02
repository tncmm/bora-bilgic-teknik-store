import { createContext, useContext, useEffect, useMemo } from 'react';

import { getIntlLocale, type Language } from '../../shared/lib/i18n';

interface I18nContextValue {
  language: Language;
  locale: string;
}

/**
 * The storefront is Turkish-only by product decision. The context still hands
 * out `language`/`locale` for date/currency formatting and translation helpers,
 * and sets `<html lang>` for accessibility.
 */
const SITE_LANGUAGE: Language = 'tr';

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = getIntlLocale(SITE_LANGUAGE);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ language: SITE_LANGUAGE, locale: getIntlLocale(SITE_LANGUAGE) }),
    [],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}
