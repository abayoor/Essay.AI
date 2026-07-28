import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeIcon } from '../components/BikeIcon';
import { ElevationLine } from '../components/ElevationLine';
import { MetricCard } from '../components/MetricCard';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { Bike, CycleRoute, RiderProfile, RiderStats } from '../lib/cyclingModels';
import { loadBikes } from '../lib/bikes';
import { loadRiderProfile, loadRiderStats } from '../lib/rider';
import { loadRoutes } from '../lib/routes';

export function DashboardPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [routes, setRoutes] = useState<CycleRoute[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextProfile, nextStats, nextBikes, nextRoutes] = await Promise.all([loadRiderProfile(), loadRiderStats(), loadBikes(), loadRoutes()]);
      setProfile(nextProfile); setStats(nextStats); setBikes(nextBikes); setRoutes(nextRoutes);
    } catch { setError('Не удалось загрузить твою велосводку. Попробуй ещё раз.'); }
  }, []);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  const name = profile?.full_name?.trim() || session?.user.email?.split('@')[0] || 'Райдер';

  return <PageShell><main className="cycle-page dashboard-page">
    <header className="page-heading"><div><p className="kicker">Твоя сводка</p><h1>Привет, {name}.</h1><p>{profile?.home_city || 'Добавь город в профиле — так маршруты станут ближе.'}</p></div><Link className="signal-button" href="/bikes">Записать заезд</Link></header>
    {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Повторить</button></div>}
    {!stats ? <p className="loading-copy">Собираем данные поездки…</p> : <section className="metrics"><MetricCard label="За всё время" value={stats.distanceKm.toFixed(1)} unit="км" /><MetricCard label="Заездов" value={String(stats.ridesCount)} /><MetricCard label="Набор" value={String(Math.round(stats.elevationM))} unit="м" /><MetricCard label="Самый длинный" value={stats.longestRideKm.toFixed(1)} unit="км" /></section>}
    <ElevationLine />
    <section className="dashboard-section"><div className="section-heading"><div><p className="kicker">Гараж</p><h2>Техника готова?</h2></div><Link href="/bikes">Открыть гараж →</Link></div>{bikes.length ? <div className="bike-strip">{bikes.slice(0, 3).map((bike) => <article className="bike-mini" key={bike.id}><BikeIcon type={bike.bike_type} /><div><h3>{bike.name}</h3><p>{bike.brand || 'Без бренда'}</p></div><strong>{Number(bike.total_distance_km).toFixed(0)} <small>км</small></strong></article>)}</div> : <div className="empty-panel"><h3>Пока нет велосипеда</h3><p>Добавь первый байк — и журнал обслуживания будет считать всё за тебя.</p><Link className="signal-button" href="/bikes">Добавить велосипед</Link></div>}</section>
    <section className="dashboard-section"><div className="section-heading"><div><p className="kicker">Выбор сообщества</p><h2>Маршруты рядом</h2></div><Link href="/routes">Все маршруты →</Link></div>{routes.length ? <div className="route-grid">{routes.slice(0, 3).map((route) => <RoutePreview key={route.id} route={route} />)}</div> : <div className="empty-panel"><h3>Маршрутов ещё нет</h3><p>Нарисуй первый трек на карте — он станет ориентиром для сообщества.</p><Link className="signal-button" href="/routes/new">Создать маршрут</Link></div>}</section>
  </main></PageShell>;
}
