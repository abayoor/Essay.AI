import { useCallback } from 'react';
import type { Locale } from './cyclingModels';
import { usePreferences } from './preferences';

export type LocalizedValue = Record<Locale, string>;
export type LocaleText = (ru: string, kz: string, en: string) => string;

export function localeValue(locale: Locale, values: LocalizedValue): string {
  return values[locale];
}

export function useLocaleText(): LocaleText {
  const { locale } = usePreferences();
  return useCallback((ru: string, kz: string, en: string) => ({ ru, kz, en })[locale], [locale]);
}
