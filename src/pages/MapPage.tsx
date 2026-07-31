import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Map as MapIcon, Route, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { CityExploreMap } from '../components/CityExploreMap';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { CycleRoute } from '../lib/cyclingModels';
import { loadMapOverview, type HazardOverview, type MarketplaceOverview } from '../lib/explore';
import { featuredRoutes } from '../lib/featuredRoutes';
import { loadRoutes } from '../lib/routes';

type MapTab = 'places' | 'routes' | 'hazards' | 'marketplace';
type CityId = 'almaty' | 'astana';

const popularCities: Record<CityId, string> = { almaty: 'Алматы', astana: 'Астана' };

const tabs: { id: MapTab; label: string; icon: typeof Route }[] = [
  { id: 'places', label: 'Карта и навигация', icon: MapIcon },
  { id: 'routes', label: 'Популярные маршруты', icon: Route },
  { id: 'hazards', label: 'Опасные места', icon: AlertTriangle },
  { id: 'marketplace', label: 'Маркет', icon: ShoppingBag },
];

const hazardLabels: Record<HazardOverview['hazard_type'], string> = {
  pothole: 'Яма',
  no_lighting: 'Нет освещения',
  glass: 'Стекло',
  aggressive_dogs: 'Собаки',
  road_closed: 'Дорога перекрыта',
};

function routeMatchesCity(route: CycleRoute, city: string): boolean {
  return route.region?.toLocaleLowerCase('ru').includes(city.toLocaleLowerCase('ru')) ?? false;
}

export function MapPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MapTab>('places');
  const [popularCityId, setPopularCityId] = useState<CityId>('almaty');
  const [routes, setRoutes] = useState<CycleRoute[]>([]);
  const [hazards, setHazards] = useState<HazardOverview[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceOverview[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    const [routesResult, overviewResult] = await Promise.allSettled([loadRoutes(), loadMapOverview()]);
    setRoutes(routesResult.status === 'fulfilled' ? routesResult.value : featuredRoutes);
    if (overviewResult.status === 'fulfilled') {
      setHazards(overviewResult.value.hazards);
      setMarketplace(overviewResult.value.marketplace);
    }
    if (routesResult.status === 'rejected' || overviewResult.status === 'rejected') {
      setError('Часть данных сообщества пока недоступна. Карта мест продолжает работать.');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  const popularCity = popularCities[popularCityId];
  const cityRoutes = routes.filter((route) => routeMatchesCity(route, popularCity));

  return <PageShell><main className="cycle-page map-page">
    <header className="map-page-heading">
      <div><p className="kicker">Навигация для велосипеда</p><h1>Куда поедем?</h1><p>Места рядом — первыми. Лучший веломаршрут — в одно нажатие.</p></div>
      <Link className="outline-inline-button" href="/routes/new">Создать маршрут</Link>
    </header>

    <nav className="section-tabs map-section-tabs" aria-label="Разделы карты">
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}
    </nav>

    {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>Повторить</button></div>}

    {tab === 'places' && <>
      <CityExploreMap />
      <section className="popular-routes-section">
        <div className="section-heading"><div><p className="kicker">Готовые подборки</p><h2>Популярные маршруты Алматы и Астаны</h2></div><button type="button" className="text-link" onClick={() => setTab('routes')}>Смотреть все →</button></div>
        <div className="popular-city-tabs" aria-label="Город популярных маршрутов">{(Object.entries(popularCities) as [CityId, string][]).map(([id, name]) => <button type="button" className={popularCityId === id ? 'active' : ''} key={id} onClick={() => setPopularCityId(id)}>{name}</button>)}</div>
        {!ready ? <BikeLoader label="Загружаем маршруты…" /> : cityRoutes.length ? <div className="route-grid">{cityRoutes.slice(0, 3).map((route) => <RoutePreview route={route} key={route.id} />)}</div> : <section className="empty-panel"><h3>В этом городе маршрутов пока нет</h3><p>Нарисуй первый — после публикации он появится здесь.</p><Link className="signal-button" href="/routes/new">Создать маршрут</Link></section>}
      </section>
    </>}

    {tab === 'routes' && <section className="popular-routes-page-section">
      <header className="section-heading"><div><p className="kicker">{popularCity}</p><h2>Готовые веломаршруты</h2><p>Открой карточку, чтобы увидеть всю линию, описание, расстояние, подъём и покрытие.</p></div><Link className="signal-button" href="/routes/new">Добавить свой</Link></header>
      <div className="popular-city-tabs" aria-label="Город популярных маршрутов">{(Object.entries(popularCities) as [CityId, string][]).map(([id, name]) => <button type="button" className={popularCityId === id ? 'active' : ''} key={id} onClick={() => setPopularCityId(id)}>{name}</button>)}</div>
      {!ready ? <BikeLoader label="Загружаем маршруты…" /> : cityRoutes.length ? <div className="route-grid">{cityRoutes.map((route) => <RoutePreview route={route} key={route.id} />)}</div> : <section className="empty-panel"><h3>Маршрутов пока нет</h3><p>Создай маршрут по знакомой дороге и поделись им с городом.</p><Link className="signal-button" href="/routes/new">Создать маршрут</Link></section>}
    </section>}

    {tab === 'hazards' && <section className="explore-list">{hazards.length ? hazards.map((hazard) => <article key={hazard.id}><AlertTriangle size={22} aria-hidden="true" /><div><strong>{hazardLabels[hazard.hazard_type]}</strong><span>Подтверждений: {hazard.upvotes}</span><p>{hazard.description || 'Райдер отметил этот участок на карте.'}</p></div></article>) : <section className="empty-panel"><h2>Активных опасностей нет</h2><p>На карте пока нет отмеченных проблемных участков.</p></section>}</section>}

    {tab === 'marketplace' && <section className="marketplace-grid">{marketplace.length ? marketplace.map((listing) => <Link className="marketplace-map-card" href={`/marketplace/${listing.id}`} key={listing.id}>{listing.photos[0] && <img src={listing.photos[0]} alt="" />}<div><p>{listing.category} · {listing.condition}</p><h2>{listing.title}</h2><strong>{Number(listing.price).toLocaleString('ru-RU')} ₸</strong><span>{listing.city || 'Город не указан'}</span><small>{listing.description}</small></div></Link>) : <section className="empty-panel"><h2>Объявлений пока нет</h2><p>Когда кто-то выставит велосипед или запчасть, она появится здесь.</p><Link className="signal-button" href="/marketplace/new">Разместить объявление</Link></section>}</section>}
  </main></PageShell>;
}
