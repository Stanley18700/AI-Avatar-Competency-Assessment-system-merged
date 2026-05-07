import thData from '../locales/th.json';
import enData from '../locales/en.json';

export type Language = 'th' | 'en';

/** Shape of UI strings; sourced from JSON so copy can be edited without rebuilding TS. */
export type Translation = typeof thData;

const translations: Record<Language, Translation> = {
  th: thData,
  en: enData,
};

export const th = thData;
export const en = enData;

export function getTranslations(lang: Language): Translation {
  return translations[lang];
}

export function getExperienceLevelLabels(lang: Language) {
  const t = translations[lang];
  return {
    LEVEL_1: t.level1,
    LEVEL_2: t.level2,
    LEVEL_3: t.level3,
    LEVEL_4: t.level4,
    LEVEL_5: t.level5,
  };
}

export function getStatusLabels(lang: Language) {
  const t = translations[lang];
  return {
    IN_PROGRESS: t.inProgress,
    SELF_ASSESSED: t.selfAssessed,
    AI_SCORED: t.aiScored,
    AI_FAILED: t.aiFailed,
    REVIEWED: t.reviewed,
    APPROVED: t.approved,
  };
}

export const experienceLevelLabels: Record<string, string> = {
  LEVEL_1: th.level1,
  LEVEL_2: th.level2,
  LEVEL_3: th.level3,
  LEVEL_4: th.level4,
  LEVEL_5: th.level5,
};

export const statusLabels: Record<string, string> = {
  IN_PROGRESS: th.inProgress,
  SELF_ASSESSED: th.selfAssessed,
  AI_SCORED: th.aiScored,
  AI_FAILED: th.aiFailed,
  REVIEWED: th.reviewed,
  APPROVED: th.approved,
};

export const statusColors: Record<string, string> = {
  IN_PROGRESS: 'badge-gray',
  SELF_ASSESSED: 'badge-info',
  AI_SCORED: 'badge-warning',
  AI_FAILED: 'badge-danger',
  REVIEWED: 'badge-info',
  APPROVED: 'badge-success',
};
