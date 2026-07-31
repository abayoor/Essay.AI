import type { Locale } from './cyclingModels';

const languageByLocale: Record<Locale, 'ru' | 'kk' | 'en'> = {
  ru: 'ru',
  kz: 'kk',
  en: 'en',
};

export function geocodingLanguage(locale: Locale): 'ru' | 'kk' | 'en' {
  return languageByLocale[locale];
}

export function photonLanguage(locale: Locale): 'default' | 'en' {
  return locale === 'en' ? 'en' : 'default';
}

export function localizedCountryName(countryCode: string | null, fallback: string | null, locale: Locale): string | null {
  if (!countryCode) return fallback;
  try {
    return new Intl.DisplayNames([geocodingLanguage(locale)], { type: 'region' })
      .of(countryCode.toUpperCase()) ?? fallback;
  } catch {
    return fallback;
  }
}
