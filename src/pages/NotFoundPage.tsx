import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';

export function NotFoundPage() { return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">404</p><h1>Этой дороги нет на карте.</h1><p>Проверь ссылку или вернись к маршрутам.</p><Link className="signal-button" href="/routes">К маршрутам</Link></section></main></PageShell>; }
