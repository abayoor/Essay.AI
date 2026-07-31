import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { CycleRoute, Difficulty } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { loadRoutes } from '../lib/routes';

export function RoutesPage() {
  const { session, loading } = useSession(); const [, navigate] = useLocation(); const [routes, setRoutes] = useState<CycleRoute[]>([]); const [routesLoading, setRoutesLoading] = useState(true); const [filter, setFilter] = useState<Difficulty | 'all'>('all'); const [error, setError] = useState('');
  const t = useLocaleText();
  const refresh = useCallback(async () => { setRoutesLoading(true); try { setError(''); setRoutes(await loadRoutes()); } catch { setError(t('Не удалось загрузить маршруты.', 'Бағыттарды жүктеу мүмкін болмады.', 'Could not load routes.')); } finally { setRoutesLoading(false); } }, [t]);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  const visible = filter === 'all' ? routes : routes.filter((route) => route.difficulty === filter);
  return <PageShell><main className="cycle-page routes-page"><header className="page-heading"><div><p className="kicker">{t('Маршруты сообщества', 'Қауымдастық бағыттары', 'Community routes')}</p><h1>{t('Куда сегодня?', 'Бүгін қайда барамыз?', 'Where to today?')}</h1><p>{t('Живые треки от райдеров, которые уже знают эту дорогу.', 'Бұл жолды білетін райдерлердің нақты бағыттары.', 'Real tracks from riders who already know the road.')}</p></div><Link className="signal-button" href="/routes/new">{t('Нарисовать маршрут', 'Бағыт сызу', 'Draw a route')}</Link></header><div className="route-filters" aria-label={t('Фильтр сложности', 'Күрделілік сүзгісі', 'Difficulty filter')}><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('Все', 'Барлығы', 'All')}</button><button className={filter === 'easy' ? 'active' : ''} onClick={() => setFilter('easy')}>{t('Лёгкие', 'Жеңіл', 'Easy')}</button><button className={filter === 'moderate' ? 'active' : ''} onClick={() => setFilter('moderate')}>{t('Средние', 'Орташа', 'Moderate')}</button><button className={filter === 'hard' ? 'active' : ''} onClick={() => setFilter('hard')}>{t('Сложные', 'Күрделі', 'Hard')}</button></div>{error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>{t('Повторить', 'Қайталау', 'Retry')}</button></div>}{routesLoading ? <BikeLoader label={t('Загружаем маршруты…', 'Бағыттар жүктелуде…', 'Loading routes…')} /> : visible.length ? <section className="route-grid">{visible.map((route) => <RoutePreview route={route} key={route.id} />)}</section> : <section className="empty-panel"><h2>{t('Пока нет подходящих маршрутов', 'Сәйкес бағыттар әзірге жоқ', 'No matching routes yet')}</h2><p>{t('Покажи сообществу дорогу, которой доверяешь.', 'Қауымдастыққа өзің сенетін жолды көрсет.', 'Show the community a road you trust.')}</p><Link className="signal-button" href="/routes/new">{t('Создать первый маршрут', 'Алғашқы бағытты жасау', 'Create the first route')}</Link></section>}</main></PageShell>;
}
