import { useState, type ReactNode } from 'react';
import { Bike, CircleUserRound, Compass, LogOut, Map, MessageCircle, Moon, Newspaper, Plus, Settings, Sun, Trophy, Wrench } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import type { Locale } from '../lib/cyclingModels';
import { usePreferences } from '../lib/preferences';
import { saveRiderProfile } from '../lib/rider';
import { supabase } from '../lib/supabase';
import { useTranslations } from '../lib/translations';

type MainLinkProps = { href: string; label: string; icon: ReactNode; active: boolean; central?: boolean };

function MainLink({ href, label, icon, active, central = false }: MainLinkProps) {
  return <Link href={href} className={`main-nav-link${active ? ' active' : ''}${central ? ' main-nav-record' : ''}`}>{icon}<span>{label}</span></Link>;
}

export function PageShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [location, navigate] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
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

  const profileActive = ['/profile', '/rides', '/bikes', '/settings'].some((path) => location.startsWith(path));
  const primaryNavigation = session && <>
    <MainLink href="/feed" label="Лента" icon={<Newspaper size={18} />} active={location.startsWith('/feed')} />
    <MainLink href="/map" label="Карта" icon={<Map size={18} />} active={location.startsWith('/map') || location.startsWith('/routes')} />
    <MainLink href="/record" label="Запись" icon={<Plus size={21} />} active={location.startsWith('/record')} central />
    <MainLink href="/competitions" label="Соревнования" icon={<Trophy size={18} />} active={location.startsWith('/competitions')} />
  </>;

  return <div className="cycle-shell">
    <header className="cycle-header">
      <Link href={session ? '/feed' : '/'} className="cycle-brand"><Compass size={20} aria-hidden="true" /> Slipstream</Link>
      {session ? <div className="header-session-actions"><nav className="primary-nav" aria-label="Основная навигация">{primaryNavigation}<div className="profile-nav"><button type="button" className={`main-nav-link profile-toggle${profileActive ? ' active' : ''}`} onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}><CircleUserRound size={18} /><span>Профиль</span></button>{profileOpen && <div className="profile-popover"><Link href="/profile" onClick={() => setProfileOpen(false)}><CircleUserRound size={17} />Профиль</Link><Link href="/rides" onClick={() => setProfileOpen(false)}><Bike size={17} />Мои заезды</Link><Link href="/bikes" onClick={() => setProfileOpen(false)}><Wrench size={17} />Велосипеды и ТО</Link><Link href="/settings" onClick={() => setProfileOpen(false)}><Settings size={17} />Настройки</Link><button type="button" onClick={() => void signOut()}><LogOut size={17} />Выйти</button></div>}</div></nav><Link href="/messages" className={`header-icon-link${location.startsWith('/messages') ? ' active' : ''}`} aria-label="Сообщения"><MessageCircle size={20} /></Link><span className="header-preferences"><select aria-label={t('settings')} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="ru">RU</option><option value="kz">KZ</option><option value="en">EN</option></select><button type="button" aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} onClick={toggleTheme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></span></div> : <nav className="public-nav"><Link className="header-cta" href="/auth/sign-in">{t('signIn')}</Link><span className="header-preferences"><select aria-label={t('settings')} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="ru">RU</option><option value="kz">KZ</option><option value="en">EN</option></select><button type="button" aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} onClick={toggleTheme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></span></nav>}
    </header>
    {children}
    {session && <nav className="mobile-main-nav" aria-label="Основная навигация">{primaryNavigation}<MainLink href="/profile" label="Профиль" icon={<CircleUserRound size={20} />} active={profileActive} /></nav>}
  </div>;
}
