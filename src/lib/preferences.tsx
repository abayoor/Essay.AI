import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale, ThemePreference } from './cyclingModels';
import { useSession } from './auth';
import { loadRiderProfile } from './rider';

type Preferences = {
  locale: Locale;
  theme: ThemePreference;
  setPreferences: (next: { locale: Locale; theme: ThemePreference }) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [locale, setLocale] = useState<Locale>('ru');
  const [theme, setTheme] = useState<ThemePreference>('light');

  useEffect(() => {
    let active = true;
    if (!session) {
      setLocale('ru');
      setTheme('light');
      return () => { active = false; };
    }
    void loadRiderProfile().then((profile) => {
      if (!active || !profile) return;
      setLocale(profile.locale);
      setTheme(profile.theme_preference);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  const value = useMemo<Preferences>(() => ({
    locale,
    theme,
    setPreferences: (next) => {
      setLocale(next.locale);
      setTheme(next.theme);
    },
  }), [locale, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing.');
  return context;
}
