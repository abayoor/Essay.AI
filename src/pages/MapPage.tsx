import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bike, Route, ShoppingBag, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import { loadMapOverview, type GroupRideOverview, type HazardOverview, type MarketplaceOverview } from '../lib/explore';
import type { CycleRoute } from '../lib/cyclingModels';
import { loadRoutes } from '../lib/routes';

type MapTab = 'routes' | 'rides' | 'hazards' | 'marketplace';

const tabs: { id: MapTab; label: string; icon: typeof Route }[] = [
  { id: 'routes', label: 'Маршруты', icon: Route },
  { id: 'rides', label: 'Групповые заезды', icon: Users },
  { id: 'hazards', label: 'Опасные места', icon: AlertTriangle },
  { id: 'marketplace', label: 'Маркет', icon: ShoppingBag },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const hazardLabels: Record<HazardOverview['hazard_type'], string> = { pothole: 'Яма', no_lighting: 'Нет освещения', glass: 'Стекло', aggressive_dogs: 'Собаки', road_closed: 'Дорога перекрыта' };

export function MapPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MapTab>('routes');
  const [routes, setRoutes] = useState<CycleRoute[]>([]);
  const [groupRides, setGroupRides] = useState<GroupRideOverview[]>([]);
  const [hazards, setHazards] = useState<HazardOverview[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceOverview[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [nextRoutes, overview] = await Promise.all([loadRoutes(), loadMapOverview()]);
      setRoutes(nextRoutes); setGroupRides(overview.groupRides); setHazards(overview.hazards); setMarketplace(overview.marketplace);
    } catch { setError('Не удалось загрузить карту сообщества.'); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);

  return <PageShell><main className="cycle-page map-page"><header className="page-heading"><div><p className="kicker">Карта сообщества</p><h1>Дорога вокруг тебя</h1><p>Маршруты, заезды, опасности и объявления собраны в одном месте.</p></div>{tab === 'routes' && <Link className="signal-button" href="/routes/new">Нарисовать маршрут</Link>}{tab === 'marketplace' && <div className="page-heading-actions"><Link className="outline-inline-button" href="/marketplace">Открыть маркет</Link><Link className="signal-button" href="/marketplace/new">Продать вещь</Link></div>}</header><nav className="section-tabs" aria-label="Разделы карты">{tabs.map(({ id, label, icon: Icon }) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>{error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Повторить</button></div>}{!ready ? <BikeLoader label="Собираем карту…" /> : <>{tab === 'routes' && (routes.length ? <section className="route-grid">{routes.map((route) => <RoutePreview route={route} key={route.id} />)}</section> : <section className="empty-panel"><h2>Маршрутов ещё нет</h2><p>Нарисуй первый трек, которому доверяешь.</p><Link className="signal-button" href="/routes/new">Создать маршрут</Link></section>)}{tab === 'rides' && <section className="explore-list">{groupRides.length ? groupRides.map((ride) => <article key={ride.id}><Bike size={22} aria-hidden="true" /><div><strong>{ride.title}</strong><span>{formatDate(ride.scheduled_at)}{ride.max_participants ? ` · до ${ride.max_participants} райдеров` : ''}</span><p>{ride.description || 'Описание заезда появится у организатора.'}</p></div></article>) : <section className="empty-panel"><h2>Ближайших заездов пока нет</h2><p>Как только райдеры назначат совместную поездку, она появится здесь.</p></section>}</section>}{tab === 'hazards' && <section className="explore-list">{hazards.length ? hazards.map((hazard) => <article key={hazard.id}><AlertTriangle size={22} aria-hidden="true" /><div><strong>{hazardLabels[hazard.hazard_type]}</strong><span>Подтверждений: {hazard.upvotes}</span><p>{hazard.description || 'Райдер отметил этот участок на карте.'}</p></div></article>) : <section className="empty-panel"><h2>Активных опасностей нет</h2><p>На карте пока нет отмеченных проблемных участков.</p></section>}</section>}{tab === 'marketplace' && <section className="marketplace-grid">{marketplace.length ? marketplace.map((listing) => <Link className="marketplace-map-card" href={`/marketplace/${listing.id}`} key={listing.id}>{listing.photos[0] && <img src={listing.photos[0]} alt="" />}<div><p>{listing.category} · {listing.condition}</p><h2>{listing.title}</h2><strong>{Number(listing.price).toLocaleString('ru-RU')} ₸</strong><span>{listing.city || 'Город не указан'}</span><small>{listing.description}</small></div></Link>) : <section className="empty-panel"><h2>Объявлений пока нет</h2><p>Когда кто-то выставит велосипед или запчасть, она появится здесь.</p><Link className="signal-button" href="/marketplace/new">Разместить объявление</Link></section>}</section>}</>}</main></PageShell>;
}
