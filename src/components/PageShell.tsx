import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import type { Locale } from '../lib/cyclingModels';
import { usePreferences } from '../lib/preferences';
import { saveRiderProfile } from '../lib/rider';
import { supabase } from '../lib/supabase';
import { useTranslations } from '../lib/translations';

export function PageShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [, navigate] = useLocation();
  const { locale, theme, setPreferences } = usePreferences();
  const t = useTranslations();

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  function changeLocale(nextLocale: Locale) {
    setPreferences({ locale: nextLocale, theme });
    if (session) void saveRiderProfile({ locale: nextLocale });
  }

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setPreferences({ locale, theme: nextTheme });
    if (session) void saveRiderProfile({ theme_preference: nextTheme });
  }

  return (
    <div className="cycle-shell">
      <header className="cycle-header">
        <Link href="/" className="cycle-brand"><span>↗</span> Slipstream</Link>
        <nav aria-label="Основная навигация">
          {session ? <>
            <Link href="/dashboard">{t('dashboard')}</Link><Link href="/feed">{t('feed')}</Link><Link href="/record">{t('record')}</Link><Link href="/rides">Заезды</Link><Link href="/routes">{t('routes')}</Link><Link href="/bikes">{t('bikes')}</Link><Link href="/messages">{t('messages')}</Link><Link href="/profile">{t('profile')}</Link>
            <button className="quiet-button" onClick={() => void signOut()}>{t('signOut')}</button>
          </> : <Link className="header-cta" href="/auth/sign-in">{t('signIn')}</Link>}
          <span className="header-preferences"><select aria-label={t('settings')} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="ru">RU</option><option value="kz">KZ</option><option value="en">EN</option></select><button type="button" aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} onClick={toggleTheme}>{theme === 'light' ? '◐' : '☼'}</button></span>
        </nav>
      </header>
      {children}
    </div>
  );
}
