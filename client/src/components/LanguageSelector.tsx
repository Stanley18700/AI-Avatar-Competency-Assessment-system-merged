import { useLanguage } from '../contexts/LanguageContext';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  /** `sidebar`: compact, high-contrast on dark green nav. `header`: light toolbar (legacy). */
  variant?: 'sidebar' | 'header';
}

export default function LanguageSelector({ variant = 'header' }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={
        isSidebar
          ? 'rounded-xl border border-white/15 bg-black/15 p-2 backdrop-blur-sm'
          : 'flex flex-row items-center gap-2 bg-surface-100 border border-surface-200 rounded-lg p-1.5'
      }
    >
      <div className={`flex items-center gap-1.5 ${isSidebar ? 'mb-2' : ''}`}>
        <Languages className={`w-3.5 h-3.5 shrink-0 ${isSidebar ? 'text-primary-100/90' : 'text-surface-700'}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSidebar ? 'text-primary-100/80' : 'text-surface-600'}`}>
          {t.language}
        </span>
      </div>
      <div className={`flex gap-1 ${isSidebar ? 'w-full' : ''}`}>
        <button
          type="button"
          onClick={() => setLanguage('th')}
          className={
            isSidebar
              ? `flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'th'
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-primary-100 hover:bg-white/10'
                }`
              : `px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'th'
                    ? 'bg-white text-primary-800 shadow-sm border border-surface-200'
                    : 'text-surface-700 hover:text-surface-900'
                }`
          }
        >
          {t.langThai}
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={
            isSidebar
              ? `flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-primary-100 hover:bg-white/10'
                }`
              : `px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-white text-primary-800 shadow-sm border border-surface-200'
                    : 'text-surface-700 hover:text-surface-900'
                }`
          }
        >
          {t.langEnglish}
        </button>
      </div>
    </div>
  );
}
