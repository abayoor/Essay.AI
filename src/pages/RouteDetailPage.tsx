import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { ElevationLine } from '../components/ElevationLine';
import { PageShell } from '../components/PageShell';
import { RouteMap } from '../components/RouteMap';
import { useSession } from '../lib/auth';
import type { CycleRoute } from '../lib/cyclingModels';
import { loadRoute } from '../lib/routes';

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>(); const { session, loading } = useSession(); const [, navigate] = useLocation(); const [route, setRoute] = useState<CycleRoute | null>(null); const [error, setError] = useState('');
  const refresh = useCallback(async () => { if (!id) return; try { setError(''); const item = await loadRoute(id); if (!item) navigate('/routes'); else setRoute(item); } catch { setError('Не удалось открыть маршрут.'); } }, [id, navigate]);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  if (!route) return <PageShell><main className="cycle-page">{error ? <p className="inline-error">{error}<button onClick={() => void refresh()}>Повторить</button></p> : <BikeLoader label="Открываем маршрут…" />}</main></PageShell>;
  const labels = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };
  const routeType = route.start_name && route.end_name
    ? route.start_name === route.end_name ? 'Круговой' : 'Из точки в точку'
    : 'Пользовательский';
  return <PageShell><main className="cycle-page route-detail">
    <Link className="route-detail-back" href="/map">← К карте и маршрутам</Link>
    <header className="page-heading route-detail-heading"><div><div className="route-detail-labels"><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p>{route.route_kind === 'curated' && <span>Выбор города</span>}</div><h1>{route.title}</h1><p>{route.region || 'Регион не указан'}{route.start_name ? ` · ${route.start_name}${route.end_name && route.end_name !== route.start_name ? ` → ${route.end_name}` : ' · круговой'}` : ''}</p></div><Link className="signal-button" href="/routes/new">Нарисовать свой</Link></header>
    <RouteMap points={route.path} className="detail-map" />
    <section className="route-data"><article><span>Дистанция</span><strong>{Number(route.distance_km).toFixed(1)} <small>км</small></strong></article><article><span>Набор высоты</span><strong>{Math.round(Number(route.elevation_gain_m))} <small>м</small></strong></article>{route.duration_minutes ? <article><span>Время в пути</span><strong>≈ {Math.round(route.duration_minutes)} <small>мин</small></strong></article> : <article><span>Точек трека</span><strong>{route.path.length}</strong></article>}<article><span>Сложность</span><strong className="route-difficulty-value">{labels[route.difficulty]}</strong></article></section>
    <div className="route-detail-copy-grid">
      {route.description && <section className="route-description"><p className="kicker">О маршруте</p><p>{route.description}</p></section>}
      <section className="route-description route-characteristics"><p className="kicker">Характеристики</p><dl>{route.surface && <div><dt>Покрытие</dt><dd>{route.surface}</dd></div>}<div><dt>Тип</dt><dd>{routeType}</dd></div><div><dt>Линия</dt><dd>{route.path.length} опорных точек</dd></div></dl>{route.source_url && <a href={route.source_url} target="_blank" rel="noreferrer">Источник линии: {route.source_name || 'OpenStreetMap'} →</a>}</section>
    </div>
    <ElevationLine />
  </main></PageShell>;
}
