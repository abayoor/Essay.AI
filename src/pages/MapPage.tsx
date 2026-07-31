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
import { useLocaleText } from '../lib/localized';
import { loadRoutes } from '../lib/routes';

type MapTab = 'places' | 'routes' | 'hazards' | 'marketplace';
type CityId = 'almaty' | 'astana';

function routeMatchesCity(route: CycleRoute, city: string): boolean {
  return route.region?.toLocaleLowerCase('ru').includes(city.toLocaleLowerCase('ru')) ?? false;
}

export function MapPage() {
  const { session, loading } = useSession();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MapTab>('places');
  const [popularCityId, setPopularCityId] = useState<CityId>('almaty');
  const [routes, setRoutes] = useState<CycleRoute[]>([]);
  const [hazards, setHazards] = useState<HazardOverview[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceOverview[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const popularCities: Record<CityId, string> = { almaty: text('Алматы', 'Алматы', 'Almaty'), astana: text('Астана', 'Астана', 'Astana') };
  const cityFilterNames: Record<CityId, string> = { almaty: 'Алматы', astana: 'Астана' };
  const tabs: { id: MapTab; label: string; icon: typeof Route }[] = [
    { id: 'places', label: text('Карта', 'Карта', 'Map'), icon: MapIcon },
    { id: 'routes', label: text('Популярные маршруты', 'Танымал бағыттар', 'Popular routes'), icon: Route },
    { id: 'hazards', label: text('Опасные места', 'Қауіпті орындар', 'Hazards'), icon: AlertTriangle },
    { id: 'marketplace', label: text('Маркет', 'Маркет', 'Market'), icon: ShoppingBag },
  ];
  const hazardLabels: Record<HazardOverview['hazard_type'], string> = {
    pothole: text('Яма', 'Шұңқыр', 'Pothole'),
    no_lighting: text('Нет освещения', 'Жарық жоқ', 'No lighting'),
    glass: text('Стекло', 'Шыны', 'Glass'),
    aggressive_dogs: text('Собаки', 'Иттер', 'Dogs'),
    road_closed: text('Дорога перекрыта', 'Жол жабық', 'Road closed'),
  };

  const refresh = useCallback(async () => {
    setError('');
    const [routesResult, overviewResult] = await Promise.allSettled([loadRoutes(), loadMapOverview()]);
    setRoutes(routesResult.status === 'fulfilled' ? routesResult.value : featuredRoutes);
    if (overviewResult.status === 'fulfilled') {
      setHazards(overviewResult.value.hazards);
      setMarketplace(overviewResult.value.marketplace);
    }
    if (routesResult.status === 'rejected' || overviewResult.status === 'rejected') {
      setError(text(
        'Часть данных сообщества пока недоступна. Карта продолжает работать.',
        'Қауымдастық деректерінің бір бөлігі қолжетімсіз. Карта жұмысын жалғастырады.',
        'Some community data is unavailable. The map is still working.',
      ));
    }
    setReady(true);
  }, [text]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  const popularCity = popularCities[popularCityId];
  const cityRoutes = routes.filter((route) => routeMatchesCity(route, cityFilterNames[popularCityId]));
  const loadingRoutes = text('Загружаем маршруты…', 'Бағыттар жүктелуде…', 'Loading routes…');

  return <PageShell><main className="cycle-page map-page">
    <header className="map-page-heading">
      <div><p className="kicker">{text('Навигация для велосипеда', 'Велосипед навигациясы', 'Cycling navigation')}</p><h1>{text('Куда поедем?', 'Қайда барамыз?', 'Where to?')}</h1><p>{text('Места рядом — первыми. Лучший веломаршрут — в одно нажатие.', 'Жақын орындар бірінші. Үздік велобағыт бір басуда.', 'Nearby places first. The best bike route in one tap.')}</p></div>
      <Link className="outline-inline-button" href="/routes/new">{text('Создать маршрут', 'Бағыт жасау', 'Create route')}</Link>
    </header>

    <nav className="section-tabs map-section-tabs" aria-label={text('Разделы карты', 'Карта бөлімдері', 'Map sections')}>
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}
    </nav>

    {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></div>}

    {tab === 'places' && <>
      <CityExploreMap />
      <section className="popular-routes-section">
        <div className="section-heading"><div><p className="kicker">{text('Готовые подборки', 'Дайын топтамалар', 'Curated picks')}</p><h2>{text('Популярные маршруты Алматы и Астаны', 'Алматы мен Астананың танымал бағыттары', 'Popular Almaty and Astana routes')}</h2></div><button type="button" className="text-link" onClick={() => setTab('routes')}>{text('Смотреть все →', 'Барлығын көру →', 'View all →')}</button></div>
        <div className="popular-city-tabs" aria-label={text('Город популярных маршрутов', 'Танымал бағыттар қаласы', 'Popular route city')}>{(Object.entries(popularCities) as [CityId, string][]).map(([id, name]) => <button type="button" className={popularCityId === id ? 'active' : ''} key={id} onClick={() => setPopularCityId(id)}>{name}</button>)}</div>
        {!ready ? <BikeLoader label={loadingRoutes} /> : cityRoutes.length ? <div className="route-grid">{cityRoutes.slice(0, 3).map((route) => <RoutePreview route={route} key={route.id} />)}</div> : <section className="empty-panel"><h3>{text('В этом городе маршрутов пока нет', 'Бұл қалада бағыттар әлі жоқ', 'No routes in this city yet')}</h3><p>{text('Создай первый маршрут и поделись им с городом.', 'Алғашқы бағытты жасап, қаламен бөліс.', 'Create the first route and share it with the city.')}</p><Link className="signal-button" href="/routes/new">{text('Создать маршрут', 'Бағыт жасау', 'Create route')}</Link></section>}
      </section>
    </>}

    {tab === 'routes' && <section className="popular-routes-page-section">
      <header className="section-heading"><div><p className="kicker">{popularCity}</p><h2>{text('Готовые веломаршруты', 'Дайын велобағыттар', 'Ready-to-ride routes')}</h2><p>{text('Открой маршрут или сразу нажми «В путь».', 'Бағытты аш немесе бірден «Жолға шығу» түймесін бас.', 'Open a route or tap Start right away.')}</p></div><Link className="signal-button" href="/routes/new">{text('Добавить свой', 'Өз бағытыңды қосу', 'Add yours')}</Link></header>
      <div className="popular-city-tabs" aria-label={text('Город популярных маршрутов', 'Танымал бағыттар қаласы', 'Popular route city')}>{(Object.entries(popularCities) as [CityId, string][]).map(([id, name]) => <button type="button" className={popularCityId === id ? 'active' : ''} key={id} onClick={() => setPopularCityId(id)}>{name}</button>)}</div>
      {!ready ? <BikeLoader label={loadingRoutes} /> : cityRoutes.length ? <div className="route-grid">{cityRoutes.map((route) => <RoutePreview route={route} key={route.id} />)}</div> : <section className="empty-panel"><h3>{text('Маршрутов пока нет', 'Бағыттар әлі жоқ', 'No routes yet')}</h3><p>{text('Создай маршрут и поделись им с городом.', 'Бағыт жасап, қаламен бөліс.', 'Create a route and share it with the city.')}</p><Link className="signal-button" href="/routes/new">{text('Создать маршрут', 'Бағыт жасау', 'Create route')}</Link></section>}
    </section>}

    {tab === 'hazards' && <section className="explore-list">{hazards.length ? hazards.map((hazard) => <article key={hazard.id}><AlertTriangle size={22} aria-hidden="true" /><div><strong>{hazardLabels[hazard.hazard_type]}</strong><span>{text('Подтверждений:', 'Растаулар:', 'Confirmations:')} {hazard.upvotes}</span><p>{hazard.description || text('Райдер отметил этот участок на карте.', 'Райдер бұл бөлікті картада белгіледі.', 'A rider marked this section on the map.')}</p></div></article>) : <section className="empty-panel"><h2>{text('Активных опасностей нет', 'Белсенді қауіптер жоқ', 'No active hazards')}</h2><p>{text('На карте пока нет отмеченных проблемных участков.', 'Картада әзірге проблемалы бөліктер белгіленбеген.', 'No problem areas have been marked yet.')}</p></section>}</section>}

    {tab === 'marketplace' && <section className="marketplace-grid">{marketplace.length ? marketplace.map((listing) => <Link className="marketplace-map-card" href={`/marketplace/${listing.id}`} key={listing.id}>{listing.photos[0] && <img src={listing.photos[0]} alt="" />}<div><p>{listing.category} · {listing.condition}</p><h2>{listing.title}</h2><strong>{Number(listing.price).toLocaleString()} ₸</strong><span>{listing.city || text('Город не указан', 'Қала көрсетілмеген', 'City not specified')}</span><small>{listing.description}</small></div></Link>) : <section className="empty-panel"><h2>{text('Объявлений пока нет', 'Хабарландырулар әлі жоқ', 'No listings yet')}</h2><p>{text('Новые велосипеды и запчасти появятся здесь.', 'Жаңа велосипедтер мен бөлшектер осында пайда болады.', 'New bikes and parts will appear here.')}</p><Link className="signal-button" href="/marketplace/new">{text('Разместить объявление', 'Хабарландыру беру', 'Create listing')}</Link></section>}</section>}
  </main></PageShell>;
}
