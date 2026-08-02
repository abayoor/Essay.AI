import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Locale, ThemePreference } from './cyclingModels';
import { useSession } from './auth';
import { geocodingLanguage } from './geography';
import { loadRiderProfile } from './rider';

type Preferences = {
  locale: Locale;
  theme: ThemePreference;
  setPreferences: (next: { locale: Locale; theme: ThemePreference }) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);
const preferencesStorageKey = 'slipstream-preferences';

function readStoredPreferences(): { locale: Locale; theme: ThemePreference } {
  try {
    const stored = window.localStorage.getItem(preferencesStorageKey);
    if (!stored) return { locale: 'ru', theme: 'dark' };
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return { locale: 'ru', theme: 'dark' };
    const { locale } = value as { locale?: unknown };
    return {
      locale: locale === 'kz' || locale === 'en' ? locale : 'ru',
      theme: 'dark',
    };
  } catch {
    return { locale: 'ru', theme: 'dark' };
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [storedPreferences] = useState(readStoredPreferences);
  const [locale, setLocale] = useState<Locale>(storedPreferences.locale);
  const theme: ThemePreference = 'dark';
  const hasLocalChange = useRef(false);

  useEffect(() => {
    let active = true;
    if (!session) {
      return () => { active = false; };
    }
    void loadRiderProfile().then((profile) => {
      if (!active || !profile || hasLocalChange.current) return;
      setLocale(profile.locale);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify({ locale, theme }));
  }, [locale, theme]);

  useEffect(() => {
    document.documentElement.lang = geocodingLanguage(locale);
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  const value = useMemo<Preferences>(() => ({
    locale,
    theme,
    setPreferences: (next) => {
      hasLocalChange.current = true;
      setLocale(next.locale);
    },
  }), [locale, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing.');
  return context;
}
