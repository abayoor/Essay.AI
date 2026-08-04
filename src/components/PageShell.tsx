import { useEffect, useState, type ReactNode } from 'react';
import {
  Bike,
  BadgeCheck,
  BrainCircuit,
  CircleUserRound,
  Home,
  LogOut,
  Map,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
  Trophy,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import type { Locale } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import { saveRiderProfile } from '../lib/rider';
import { supabase } from '../lib/supabase';
import { useTranslations } from '../lib/translations';
import { FriendLocationPublisher } from './FriendLocationPublisher';
import { BrandLogo } from './BrandLogo';

type MainLinkProps = {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  central?: boolean;
};

function MainLink({ href, label, icon, active, central = false }: MainLinkProps) {
  return <Link
    href={href}
    className={`main-nav-link${active ? ' active' : ''}${central ? ' main-nav-record' : ''}`}
  >
    {icon}
    <span>{label}</span>
  </Link>;
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
    setPreferences({ locale: nextLocale, theme: 'light' });
    if (session) void saveRiderProfile({ locale: nextLocale });
  }

  useEffect(() => {
    setProfileOpen(false);
  }, [location]);

  useEffect(() => {
    if (theme !== 'light') setPreferences({ locale, theme: 'light' });
  }, [locale, setPreferences, theme]);

  const profileActive = ['/profile', '/pro', '/coach', '/friends', '/competitions', '/rides', '/bikes', '/settings'].some((path) => location.startsWith(path));
  const desktopNavigation = session && <>
    <MainLink
      href="/dashboard"
      label={text('Сегодня', 'Бүгін', 'Today')}
      icon={<Home size={18} />}
      active={location.startsWith('/dashboard')}
    />
    <MainLink
      href="/feed"
      label={t('feed')}
      icon={<Newspaper size={18} />}
      active={location.startsWith('/feed')}
    />
    <MainLink
      href="/map"
      label={t('map')}
      icon={<Map size={18} />}
      active={location.startsWith('/map') || location.startsWith('/routes')}
    />
    <MainLink
      href="/record"
      label={t('record')}
      icon={<Plus size={21} />}
      active={location.startsWith('/record')}
      central
    />
    <MainLink
      href="/competitions"
      label={t('competitions')}
      icon={<Trophy size={18} />}
      active={location.startsWith('/competitions')}
    />
  </>;

  const mobileNavigation = session && <>
    <MainLink
      href="/dashboard"
      label={text('Сегодня', 'Бүгін', 'Today')}
      icon={<Home size={20} />}
      active={location.startsWith('/dashboard')}
    />
    <MainLink
      href="/feed"
      label={t('feed')}
      icon={<Newspaper size={20} />}
      active={location.startsWith('/feed')}
    />
    <MainLink
      href="/record"
      label={t('record')}
      icon={<Plus size={22} />}
      active={location.startsWith('/record')}
      central
    />
    <MainLink
      href="/map"
      label={t('map')}
      icon={<Map size={20} />}
      active={location.startsWith('/map') || location.startsWith('/routes')}
    />
    <button type="button" className={`main-nav-link mobile-profile-trigger${profileActive ? ' active' : ''}`} onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
      <CircleUserRound size={20} />
      <span>{t('profile')}</span>
    </button>
  </>;

  const languageSelect = <span className="header-preferences">
    <select
      aria-label={t('settings')}
      value={locale}
      onChange={(event) => changeLocale(event.target.value as Locale)}
    >
      <option value="ru">RU</option>
      <option value="kz">KZ</option>
      <option value="en">EN</option>
    </select>
  </span>;

  return <div className="cycle-shell">
    <FriendLocationPublisher />
    <header className="cycle-header">
      <Link href={session ? '/dashboard' : '/'} className="cycle-brand">
        <BrandLogo />
      </Link>
      {session ? <div className="header-session-actions">
        <nav className="primary-nav" aria-label={t('dashboard')}>
          {desktopNavigation}
          <div className="profile-nav">
            <button
              type="button"
              className={`main-nav-link profile-toggle${profileActive ? ' active' : ''}`}
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
            >
              <CircleUserRound size={18} />
              <span>{t('profile')}</span>
            </button>
            {profileOpen && <div className="profile-popover">
              <Link href="/profile" onClick={() => setProfileOpen(false)}>
                <CircleUserRound size={17} />
                {t('profile')}
              </Link>
              <Link href="/friends" onClick={() => setProfileOpen(false)}>
                <UsersRound size={17} />
                {text('Друзья', 'Достар', 'Friends')}
              </Link>
              <Link href="/coach" onClick={() => setProfileOpen(false)}>
                <BrainCircuit size={17} />
                {text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}
              </Link>
              <Link href="/pro" onClick={() => setProfileOpen(false)}>
                <BadgeCheck size={17} />
                Slipstream Pro
              </Link>
              <Link href="/rides" onClick={() => setProfileOpen(false)}>
                <Bike size={17} />
                {t('myRides')}
              </Link>
              <Link href="/bikes" onClick={() => setProfileOpen(false)}>
                <Wrench size={17} />
                {t('bikesAndService')}
              </Link>
              <Link href="/competitions" onClick={() => setProfileOpen(false)}>
                <Trophy size={17} />
                {text('Челленджи', 'Челлендждер', 'Challenges')}
              </Link>
              <Link href="/settings" onClick={() => setProfileOpen(false)}>
                <Settings size={17} />
                {t('settings')}
              </Link>
              <button type="button" onClick={() => void signOut()}>
                <LogOut size={17} />
                {t('signOut')}
              </button>
            </div>}
          </div>
          </nav>
        <Link
          href="/pro"
          className={`header-pro-link${location.startsWith('/pro') ? ' active' : ''}`}
          aria-label="Slipstream Pro"
        >
          <BadgeCheck size={17} />
          <span>PRO</span>
        </Link>
        <Link
          href="/coach"
          className={`header-icon-link header-coach-link${location.startsWith('/coach') ? ' active' : ''}`}
          aria-label={text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}
        >
          <BrainCircuit size={20} />
        </Link>
        <Link
          href="/messages"
          className={`header-icon-link${location.startsWith('/messages') ? ' active' : ''}`}
          aria-label={t('messages')}
        >
          <MessageCircle size={20} />
        </Link>
        {languageSelect}
      </div> : <nav className="public-nav">
        <Link className="header-cta" href="/auth/sign-in">{t('signIn')}</Link>
        {languageSelect}
      </nav>}
    </header>
    {children}
    {session && <nav className="mobile-main-nav" aria-label={t('dashboard')}>
      {mobileNavigation}
    </nav>}
    {session && profileOpen && <>
      <button type="button" className="mobile-profile-backdrop" aria-label={text('Закрыть меню профиля', 'Профиль мәзірін жабу', 'Close profile menu')} onClick={() => setProfileOpen(false)} />
      <nav className="mobile-profile-sheet" aria-label={text('Меню профиля', 'Профиль мәзірі', 'Profile menu')}>
        <header><div><span><CircleUserRound size={21} /></span><div><strong>{text('Твой профиль', 'Сенің профилің', 'Your profile')}</strong><small>{text('Все личные разделы', 'Барлық жеке бөлімдер', 'All personal sections')}</small></div></div><button type="button" onClick={() => setProfileOpen(false)} aria-label={text('Закрыть', 'Жабу', 'Close')}>×</button></header>
        <div className="mobile-profile-grid">
          <Link href="/profile"><CircleUserRound size={20} /><span>{t('profile')}</span></Link>
          <Link href="/friends"><UsersRound size={20} /><span>{text('Друзья', 'Достар', 'Friends')}</span></Link>
          <Link href="/coach"><BrainCircuit size={20} /><span>{text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}</span></Link>
          <Link href="/pro"><BadgeCheck size={20} /><span>Slipstream Pro</span></Link>
          <Link href="/rides"><Bike size={20} /><span>{t('myRides')}</span></Link>
          <Link href="/bikes"><Wrench size={20} /><span>{t('bikesAndService')}</span></Link>
          <Link href="/competitions"><Trophy size={20} /><span>{text('Челленджи', 'Челлендждер', 'Challenges')}</span></Link>
          <Link href="/messages"><MessageCircle size={20} /><span>{t('messages')}</span></Link>
          <Link href="/settings"><Settings size={20} /><span>{t('settings')}</span></Link>
        </div>
        <button type="button" className="mobile-profile-signout" onClick={() => void signOut()}><LogOut size={18} />{t('signOut')}</button>
      </nav>
    </>}
  </div>;
}
