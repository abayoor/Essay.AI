import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Map as MapIcon, Route, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { CityExploreMap } from '../components/CityExploreMap';
import { HazardReportSheet } from '../components/HazardReportSheet';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { CycleRoute } from '../lib/cyclingModels';
import { loadMapOverview, type MarketplaceOverview } from '../lib/explore';
import { featuredRoutes } from '../lib/featuredRoutes';
import {
  confirmHazard,
  distanceBetweenHazardPointsMeters,
  loadHazards,
  reportHazard,
  resolveHazard,
  subscribeToHazards,
  unconfirmHazard,
  type HazardPoint,
  type HazardReport,
  type ReportHazardInput,
} from '../lib/hazards';
import { useLocaleText } from '../lib/localized';
import { loadRoutes } from '../lib/routes';
import { navigationUpdatedEvent } from '../lib/activeNavigation';

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
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceOverview[]>([]);
  const [riderLocation, setRiderLocation] = useState<HazardPoint | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [mapPicking, setMapPicking] = useState(false);
  const [mapReportLocation, setMapReportLocation] = useState<HazardPoint | null>(null);
  const [hazardBusyId, setHazardBusyId] = useState<string | null>(null);
  const [hazardSubmitting, setHazardSubmitting] = useState(false);
  const [hazardError, setHazardError] = useState('');
  const [hazardMessage, setHazardMessage] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const hazardCenter = useRef<HazardPoint | null>(null);
  const hazardRequestSequence = useRef(0);

  const popularCities: Record<CityId, string> = { almaty: text('Алматы', 'Алматы', 'Almaty'), astana: text('Астана', 'Астана', 'Astana') };
  const cityFilterNames: Record<CityId, string> = { almaty: 'Алматы', astana: 'Астана' };
  const tabs: { id: MapTab; label: string; icon: typeof Route }[] = [
    { id: 'places', label: text('Карта', 'Карта', 'Map'), icon: MapIcon },
    { id: 'routes', label: text('Популярные маршруты', 'Танымал бағыттар', 'Popular routes'), icon: Route },
    { id: 'hazards', label: text('Опасные места', 'Қауіпті орындар', 'Hazards'), icon: AlertTriangle },
    { id: 'marketplace', label: text('Маркет', 'Маркет', 'Market'), icon: ShoppingBag },
  ];

  useEffect(() => {
    const showSelectedRoute = () => setTab('places');
    window.addEventListener(navigationUpdatedEvent, showSelectedRoute);
    return () => window.removeEventListener(navigationUpdatedEvent, showSelectedRoute);
  }, []);
  const hazardLabels: Record<HazardReport['hazardType'], string> = {
    pothole: text('Яма', 'Шұңқыр', 'Pothole'),
    no_lighting: text('Нет освещения', 'Жарық жоқ', 'No lighting'),
    glass: text('Стекло', 'Шыны', 'Glass'),
    aggressive_dogs: text('Собаки', 'Иттер', 'Dogs'),
    road_closed: text('Дорога перекрыта', 'Жол жабық', 'Road closed'),
  };

  const refreshHazards = useCallback(async () => {
    const requestSequence = ++hazardRequestSequence.current;
    try {
      const result = await loadHazards({ center: hazardCenter.current ?? undefined, radiusKm: 35, limit: 180 });
      if (requestSequence !== hazardRequestSequence.current) return;
      setHazards(result.hazards);
      if (result.source === 'cache') {
        setHazardMessage(text(
          'Нет связи — показываем последние сохранённые отметки.',
          'Байланыс жоқ — соңғы сақталған белгілер көрсетіледі.',
          'You are offline — showing the latest saved reports.',
        ));
      }
    } catch (loadError) {
      if (requestSequence !== hazardRequestSequence.current) return;
      throw loadError;
    }
  }, [text]);

  const handleRiderLocationChange = useCallback((point: HazardPoint | null) => {
    setRiderLocation(point);
    if (!point) return;
    const previousCenter = hazardCenter.current;
    if (previousCenter && distanceBetweenHazardPointsMeters(previousCenter, point) < 8_000) return;
    hazardCenter.current = point;
    void refreshHazards();
  }, [refreshHazards]);

  const refresh = useCallback(async () => {
    setError('');
    const [routesResult, overviewResult, hazardsResult] = await Promise.allSettled([loadRoutes(), loadMapOverview(), refreshHazards()]);
    setRoutes(routesResult.status === 'fulfilled' ? routesResult.value : featuredRoutes);
    if (overviewResult.status === 'fulfilled') {
      setMarketplace(overviewResult.value.marketplace);
    }
    if (routesResult.status === 'rejected' || overviewResult.status === 'rejected' || hazardsResult.status === 'rejected') {
      setError(text(
        'Часть данных сообщества пока недоступна. Карта продолжает работать.',
        'Қауымдастық деректерінің бір бөлігі қолжетімсіз. Карта жұмысын жалғастырады.',
        'Some community data is unavailable. The map is still working.',
      ));
    }
    setReady(true);
  }, [refreshHazards, text]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  useEffect(() => {
    if (!session) return undefined;
    let timer: number | null = null;
    const unsubscribe = subscribeToHazards(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refreshHazards(), 350);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [refreshHazards, session]);

  useEffect(() => {
    if (!hazardMessage) return undefined;
    const timer = window.setTimeout(() => setHazardMessage(''), 6500);
    return () => window.clearTimeout(timer);
  }, [hazardMessage]);

  async function handleConfirm(hazard: HazardReport) {
    setHazardBusyId(hazard.id);
    setHazardError('');
    try {
      const confirmations = await confirmHazard(hazard.id);
      setHazards((current) => current.map((item) => item.id === hazard.id
        ? { ...item, confirmations, confirmedByMe: true, lastConfirmedAt: new Date().toISOString() }
        : item));
    } catch {
      setHazardError(text('Не удалось подтвердить отметку.', 'Белгіні растау мүмкін болмады.', 'Could not confirm this report.'));
    } finally {
      setHazardBusyId(null);
    }
  }

  async function handleUnconfirm(hazard: HazardReport) {
    setHazardBusyId(hazard.id);
    setHazardError('');
    try {
      const confirmations = await unconfirmHazard(hazard.id);
      setHazards((current) => current.map((item) => item.id === hazard.id
        ? { ...item, confirmations, confirmedByMe: false }
        : item));
    } catch {
      setHazardError(text('Не удалось изменить подтверждение.', 'Растауды өзгерту мүмкін болмады.', 'Could not update your confirmation.'));
    } finally {
      setHazardBusyId(null);
    }
  }

  async function handleResolve(hazard: HazardReport) {
    setHazardBusyId(hazard.id);
    setHazardError('');
    try {
      await resolveHazard(hazard.id);
      setHazards((current) => current.filter((item) => item.id !== hazard.id));
      setHazardMessage(text('Спасибо — отметка закрыта.', 'Рақмет — белгі жабылды.', 'Thanks — the report is now resolved.'));
    } catch {
      setHazardError(text('Не удалось закрыть отметку.', 'Белгіні жабу мүмкін болмады.', 'Could not resolve this report.'));
    } finally {
      setHazardBusyId(null);
    }
  }

  async function handleReport(input: ReportHazardInput) {
    setHazardSubmitting(true);
    setHazardError('');
    try {
      const result = await reportHazard(input);
      setReportOpen(false);
      setMapPicking(false);
      setMapReportLocation(null);
      setHazardMessage(result.merged
        ? text('Такая отметка уже есть на Safety Radar.', 'Мұндай белгі Safety Radar картасында бар.', 'This report is already on Safety Radar.')
        : text('Опасность появилась на Safety Radar.', 'Қауіп Safety Radar картасында пайда болды.', 'The hazard is now live on Safety Radar.'));
      await refreshHazards();
    } catch {
      setHazardError(text('Не удалось отправить отметку. Проверь соединение и попробуй снова.', 'Белгіні жіберу мүмкін болмады. Байланысты тексеріп, қайталап көр.', 'Could not send the report. Check your connection and try again.'));
    } finally {
      setHazardSubmitting(false);
    }
  }

  function openReportSheet() {
    setHazardError('');
    setMapReportLocation(null);
    setMapPicking(false);
    setReportOpen(true);
  }

  function requestMapPick() {
    setHazardError('');
    setReportOpen(false);
    setTab('places');
    setMapPicking(true);
  }

  function chooseHazardLocation(point: HazardPoint) {
    setMapReportLocation(point);
    setMapPicking(false);
    setReportOpen(true);
  }

  const popularCity = popularCities[popularCityId];
  const cityRoutes = routes.filter((route) => routeMatchesCity(route, cityFilterNames[popularCityId]));
  const loadingRoutes = text('Загружаем маршруты…', 'Бағыттар жүктелуде…', 'Loading routes…');

  return <PageShell><main className="cycle-page map-page">
    <header className="map-page-heading">
      <div><p className="kicker">Safety Radar · {text('живая карта города', 'қаланың тірі картасы', 'live city map')}</p><h1>{text('Едь безопаснее.', 'Қауіпсіз жүр.', 'Ride safer.')}</h1><p>{text('Сравни маршруты по опасностям и получай свежие предупреждения от райдеров.', 'Бағыттарды қауіп бойынша салыстырып, райдерлерден жаңа ескертулер ал.', 'Compare routes by risk and get fresh warnings from riders nearby.')}</p></div>
      <Link className="outline-inline-button" href="/routes/new">{text('Создать маршрут', 'Бағыт жасау', 'Create route')}</Link>
    </header>

    <nav className="section-tabs map-section-tabs" aria-label={text('Разделы карты', 'Карта бөлімдері', 'Map sections')}>
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}
    </nav>

    {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></div>}
    {hazardError && !reportOpen && <div className="inline-error" role="alert">{hazardError}<button type="button" onClick={() => setHazardError('')}>{text('Закрыть', 'Жабу', 'Dismiss')}</button></div>}
    {hazardMessage && <p className="safety-radar-status" role="status">{hazardMessage}</p>}

    {tab === 'places' && <>
      <CityExploreMap
        hazards={hazards}
        currentUserId={session?.user.id ?? null}
        busyHazardId={hazardBusyId}
        hazardPickMode={mapPicking}
        onConfirmHazard={handleConfirm}
        onUnconfirmHazard={handleUnconfirm}
        onResolveHazard={handleResolve}
        onOpenHazardReport={openReportSheet}
        onPickHazardLocation={chooseHazardLocation}
        onRiderLocationChange={handleRiderLocationChange}
      />
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

    {tab === 'hazards' && <section className="safety-radar-list-section">
      <header className="section-heading"><div><p className="kicker">Safety Radar</p><h2>{text('Что отмечают райдеры', 'Райдерлер нені белгіледі', 'What riders are reporting')}</h2><p>{text('Отметки исчезают автоматически, если сообщество их не подтверждает.', 'Қауымдастық растамаса, белгілер автоматты түрде жоғалады.', 'Reports expire automatically unless the community keeps confirming them.')}</p></div><button type="button" className="signal-button" onClick={openReportSheet}><AlertTriangle size={17} />{text('Сообщить', 'Хабарлау', 'Report')}</button></header>
      <div className="explore-list">{hazards.length ? hazards.map((hazard) => <article key={hazard.id}><AlertTriangle size={22} aria-hidden="true" /><div><strong>{hazardLabels[hazard.hazardType]}</strong><span>{text('Подтверждений:', 'Растаулар:', 'Confirmations:')} {hazard.confirmations}</span><p>{hazard.description || text('Райдер отметил этот участок на карте.', 'Райдер бұл бөлікті картада белгіледі.', 'A rider marked this section on the map.')}</p><div className="safety-list-actions">{hazard.reporterId === session?.user.id ? <button type="button" disabled={hazardBusyId === hazard.id} onClick={() => void handleResolve(hazard)}>{text('Проблема устранена', 'Мәселе шешілді', 'Mark resolved')}</button> : <button type="button" className={hazard.confirmedByMe ? 'is-confirmed' : ''} disabled={hazardBusyId === hazard.id} onClick={() => void (hazard.confirmedByMe ? handleUnconfirm(hazard) : handleConfirm(hazard))}>{hazard.confirmedByMe ? text('Подтверждено', 'Расталды', 'Confirmed') : text('Подтвердить', 'Растау', 'Confirm')}</button>}<button type="button" onClick={() => setTab('places')}>{text('На карте', 'Картада', 'View map')}</button></div></div></article>) : <section className="empty-panel"><h2>{text('Активных опасностей нет', 'Белсенді қауіптер жоқ', 'No active hazards')}</h2><p>{text('На карте пока нет отмеченных проблемных участков.', 'Картада әзірге проблемалы бөліктер белгіленбеген.', 'No problem areas have been marked yet.')}</p><button type="button" className="signal-button" onClick={openReportSheet}>{text('Добавить первую отметку', 'Алғашқы белгіні қосу', 'Add the first report')}</button></section>}</div>
    </section>}

    {tab === 'marketplace' && <section className="marketplace-grid">{marketplace.length ? marketplace.map((listing) => <Link className="marketplace-map-card" href={`/marketplace/${listing.id}`} key={listing.id}>{listing.photos[0] && <img src={listing.photos[0]} alt="" />}<div><p>{listing.category} · {listing.condition}</p><h2>{listing.title}</h2><strong>{Number(listing.price).toLocaleString()} ₸</strong><span>{listing.city || text('Город не указан', 'Қала көрсетілмеген', 'City not specified')}</span><small>{listing.description}</small></div></Link>) : <section className="empty-panel"><h2>{text('Объявлений пока нет', 'Хабарландырулар әлі жоқ', 'No listings yet')}</h2><p>{text('Новые велосипеды и запчасти появятся здесь.', 'Жаңа велосипедтер мен бөлшектер осында пайда болады.', 'New bikes and parts will appear here.')}</p><Link className="signal-button" href="/marketplace/new">{text('Разместить объявление', 'Хабарландыру беру', 'Create listing')}</Link></section>}</section>}
    <HazardReportSheet
      open={reportOpen}
      gpsLocation={riderLocation}
      mapLocation={mapReportLocation}
      mapPicking={mapPicking}
      submitting={hazardSubmitting}
      error={hazardError}
      onClose={() => { setReportOpen(false); setMapPicking(false); }}
      onRequestMapPick={requestMapPick}
      onSubmit={handleReport}
    />
  </main></PageShell>;
}
