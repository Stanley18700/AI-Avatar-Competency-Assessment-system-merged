import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Language, getTranslations, getExperienceLevelLabels, getStatusLabels, type Translation } from '../lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translation;
  experienceLevelLabels: ReturnType<typeof getExperienceLevelLabels>;
  statusLabels: ReturnType<typeof getStatusLabels>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'th') ? saved : 'th';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: getTranslations(language),
    experienceLevelLabels: getExperienceLevelLabels(language),
    statusLabels: getStatusLabels(language),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
