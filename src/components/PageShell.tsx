import { useEffect, useState, type ReactNode } from 'react';
import { Bike, BrainCircuit, CircleUserRound, Compass, Home, LogOut, Map, MessageCircle, Moon, Newspaper, Plus, Settings, Sun, Trophy, Wrench } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import type { Locale } from '../lib/cyclingModels';
import { usePreferences } from '../lib/preferences';
import { saveRiderProfile } from '../lib/rider';
import { supabase } from '../lib/supabase';
import { useTranslations } from '../lib/translations';
import { useLocaleText } from '../lib/localized';

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
  const text = useLocaleText();

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

  useEffect(() => {
    setProfileOpen(false);
  }, [location]);

  const profileActive = ['/profile', '/rides', '/bikes', '/settings'].some((path) => location.startsWith(path));
  const desktopNavigation = session && <>
    <MainLink href="/dashboard" label={text('Сегодня', 'Бүгін', 'Today')} icon={<Home size={18} />} active={location.startsWith('/dashboard')} />
    <MainLink href="/feed" label={t('feed')} icon={<Newspaper size={18} />} active={location.startsWith('/feed')} />
    <MainLink href="/map" label={t('map')} icon={<Map size={18} />} active={location.startsWith('/map') || location.startsWith('/routes')} />
    <MainLink href="/record" label={t('record')} icon={<Plus size={21} />} active={location.startsWith('/record')} central />
    <MainLink href="/competitions" label={t('competitions')} icon={<Trophy size={18} />} active={location.startsWith('/competitions')} />
  </>;

  const mobileNavigation = session && <>
    <MainLink href="/dashboard" label={text('Сегодня', 'Бүгін', 'Today')} icon={<Home size={20} />} active={location.startsWith('/dashboard')} />
    <MainLink href="/feed" label={t('feed')} icon={<Newspaper size={20} />} active={location.startsWith('/feed')} />
    <MainLink href="/record" label={t('record')} icon={<Plus size={22} />} active={location.startsWith('/record')} central />
    <MainLink href="/map" label={t('map')} icon={<Map size={20} />} active={location.startsWith('/map') || location.startsWith('/routes')} />
    <MainLink href="/profile" label={t('profile')} icon={<CircleUserRound size={20} />} active={profileActive} />
  </>;

  return <div className="cycle-shell">
    <header className="cycle-header">
      <Link href={session ? '/dashboard' : '/'} className="cycle-brand"><Compass size={20} aria-hidden="true" /> Slipstream</Link>
      {session ? <div className="header-session-actions"><nav className="primary-nav" aria-label={t('dashboard')}>{desktopNavigation}<div className="profile-nav"><button type="button" className={`main-nav-link profile-toggle${profileActive ? ' active' : ''}`} onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}><CircleUserRound size={18} /><span>{t('profile')}</span></button>{profileOpen && <div className="profile-popover"><Link href="/profile" onClick={() => setProfileOpen(false)}><CircleUserRound size={17} />{t('profile')}</Link><Link href="/coach" onClick={() => setProfileOpen(false)}><BrainCircuit size={17} />{text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}</Link><Link href="/rides" onClick={() => setProfileOpen(false)}><Bike size={17} />{t('myRides')}</Link><Link href="/bikes" onClick={() => setProfileOpen(false)}><Wrench size={17} />{t('bikesAndService')}</Link><Link href="/settings" onClick={() => setProfileOpen(false)}><Settings size={17} />{t('settings')}</Link><button type="button" onClick={() => void signOut()}><LogOut size={17} />{t('signOut')}</button></div>}</div></nav><Link href="/coach" className={`header-icon-link header-coach-link${location.startsWith('/coach') ? ' active' : ''}`} aria-label={text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}><BrainCircuit size={20} /></Link><Link href="/messages" className={`header-icon-link${location.startsWith('/messages') ? ' active' : ''}`} aria-label={t('messages')}><MessageCircle size={20} /></Link><span className="header-preferences"><select aria-label={t('settings')} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="ru">RU</option><option value="kz">KZ</option><option value="en">EN</option></select><button type="button" aria-label={theme === 'light' ? text('Включить тёмную тему', 'Қараңғы тақырыпты қосу', 'Use dark theme') : text('Включить светлую тему', 'Жарық тақырыпты қосу', 'Use light theme')} onClick={toggleTheme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></span></div> : <nav className="public-nav"><Link className="header-cta" href="/auth/sign-in">{t('signIn')}</Link><span className="header-preferences"><select aria-label={t('settings')} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="ru">RU</option><option value="kz">KZ</option><option value="en">EN</option></select><button type="button" aria-label={theme === 'light' ? text('Включить тёмную тему', 'Қараңғы тақырыпты қосу', 'Use dark theme') : text('Включить светлую тему', 'Жарық тақырыпты қосу', 'Use light theme')} onClick={toggleTheme}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></span></nav>}
    </header>
    {children}
    {session && <nav className="mobile-main-nav" aria-label={t('dashboard')}>{mobileNavigation}</nav>}
  </div>;
}
