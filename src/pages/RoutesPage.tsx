import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { CycleRoute, Difficulty } from '../lib/cyclingModels';
import { loadRoutes } from '../lib/routes';

export function RoutesPage() {
  const { session, loading } = useSession(); const [, navigate] = useLocation(); const [routes, setRoutes] = useState<CycleRoute[]>([]); const [routesLoading, setRoutesLoading] = useState(true); const [filter, setFilter] = useState<Difficulty | 'all'>('all'); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setRoutesLoading(true); try { setError(''); setRoutes(await loadRoutes()); } catch { setError('Не удалось загрузить маршруты.'); } finally { setRoutesLoading(false); } }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  const visible = filter === 'all' ? routes : routes.filter((route) => route.difficulty === filter);
  return <PageShell><main className="cycle-page routes-page"><header className="page-heading"><div><p className="kicker">Карман региона</p><h1>Куда сегодня?</h1><p>Живые треки от райдеров, которые уже знают эту дорогу.</p></div><Link className="signal-button" href="/routes/new">Нарисовать маршрут</Link></header><div className="route-filters" aria-label="Фильтр сложности"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Все</button><button className={filter === 'easy' ? 'active' : ''} onClick={() => setFilter('easy')}>Лёгкие</button><button className={filter === 'moderate' ? 'active' : ''} onClick={() => setFilter('moderate')}>Средние</button><button className={filter === 'hard' ? 'active' : ''} onClick={() => setFilter('hard')}>Сложные</button></div>{error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Повторить</button></div>}{routesLoading ? <BikeLoader label="Загружаем маршруты…" /> : visible.length ? <section className="route-grid">{visible.map((route) => <RoutePreview route={route} key={route.id} />)}</section> : <section className="empty-panel"><h2>Пока нет подходящих маршрутов</h2><p>Покажи сообществу дорогу, которой сам(а) доверяешь.</p><Link className="signal-button" href="/routes/new">Создать первый маршрут</Link></section>}</main></PageShell>;
}
