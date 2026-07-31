import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useLocaleText } from '../lib/localized';

export function NotFoundPage() { const t = useLocaleText(); return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">404</p><h1>{t('Этой дороги нет на карте.', 'Бұл жол картада жоқ.', 'This road is not on the map.')}</h1><p>{t('Проверь ссылку или вернись к маршрутам.', 'Сілтемені тексер немесе бағыттарға орал.', 'Check the link or return to routes.')}</p><Link className="signal-button" href="/routes">{t('К маршрутам', 'Бағыттарға', 'View routes')}</Link></section></main></PageShell>; }
