import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
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
  if (!route) return <PageShell><main className="cycle-page loading-copy">{error || 'Открываем маршрут…'}{error && <button onClick={() => void refresh()}>Повторить</button>}</main></PageShell>;
  const labels = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };
  return <PageShell><main className="cycle-page route-detail"><header className="page-heading"><div><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p><h1>{route.title}</h1><p>{route.region || 'Регион не указан'}</p></div><Link className="text-link" href="/routes">← К маршрутам</Link></header><RouteMap points={route.path} className="detail-map" /><ElevationLine /><section className="route-data"><article><span>Дистанция</span><strong>{Number(route.distance_km).toFixed(1)} <small>км</small></strong></article><article><span>Набор</span><strong>{Math.round(Number(route.elevation_gain_m))} <small>м</small></strong></article><article><span>Точек</span><strong>{route.path.length}</strong></article></section>{route.description && <section className="route-description"><p className="kicker">Заметка автора</p><p>{route.description}</p></section>}</main></PageShell>;
}
