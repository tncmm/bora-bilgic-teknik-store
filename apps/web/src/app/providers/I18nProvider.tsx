import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getDefaultLanguage, getIntlLocale, LANGUAGE_STORAGE_KEY, type Language } from '../../shared/lib/i18n';

interface I18nContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    return stored === 'tr' || stored === 'en' ? stored : getDefaultLanguage();
  });

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = getIntlLocale(language);
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: getIntlLocale(language),
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((current) => (current === 'tr' ? 'en' : 'tr')),
    }),
    [language],
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
