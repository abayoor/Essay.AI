import { divIcon, latLngBounds } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  Clock3,
  Gauge,
  LocateFixed,
  MapPin,
  Mountain,
  Navigation,
  Play,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Square,
  Timer,
  Utensils,
  Trees,
  Landmark,
  Wrench,
  X,
} from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { useLocation } from 'wouter';
import { clearMapNavigation, loadMapNavigation, saveMapNavigation } from '../lib/activeNavigation';
import type { RoutePoint } from '../lib/cyclingModels';
import { routeCyclingWaypoints, type CyclingRoutePreference, type CyclingRouteResult } from '../lib/directions';
import { reverseMapLocation, searchMapPlaces, type MapPlace, type ResolvedMapLocation } from '../lib/places';
import { saveMapRouteDraft } from '../lib/routeDraft';
import { CommunityTileLayer } from './CommunityTileLayer';

type RouteOption = {
  preference: CyclingRoutePreference;
  result: CyclingRouteResult;
};

type RouteProgress = {
  closestIndex: number;
  distanceFromRouteM: number;
  remainingM: number;
};

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

const riderIcon = divIcon({
  className: 'rider-location-marker',
  html: '<span aria-hidden="true">🚴</span>',
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

const destinationIcon = divIcon({
  className: 'destination-location-marker',
  html: '<span aria-hidden="true"><b>B</b></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
});

function distanceMeters(first: RoutePoint, second: RoutePoint): number {
  const radius = 6371000;
  const firstLat = first.lat * Math.PI / 180;
  const secondLat = second.lat * Math.PI / 180;
  const dLat = (second.lat - first.lat) * Math.PI / 180;
  const dLng = (second.lng - first.lng) * Math.PI / 180;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function bearingDegrees(first: RoutePoint, second: RoutePoint): number {
  const firstLat = first.lat * Math.PI / 180;
  const secondLat = second.lat * Math.PI / 180;
  const dLng = (second.lng - first.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(secondLat);
  const x = Math.cos(firstLat) * Math.sin(secondLat)
    - Math.sin(firstLat) * Math.cos(secondLat) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function routeProgress(points: RoutePoint[], rider: RoutePoint): RouteProgress {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = distanceMeters(point, rider);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  let remainingM = distanceMeters(rider, points[closestIndex] ?? rider);
  for (let index = closestIndex; index < points.length - 1; index += 1) {
    remainingM += distanceMeters(points[index], points[index + 1]);
  }
  return { closestIndex, distanceFromRouteM: closestDistance, remainingM };
}

function nextNavigationInstruction(points: RoutePoint[], progress: RouteProgress): { text: string; distanceM: number; turn: 'left' | 'right' | 'straight' | 'finish' } {
  if (progress.remainingM < 30 || progress.closestIndex >= points.length - 2) {
    return { text: 'Вы прибыли', distanceM: 0, turn: 'finish' };
  }

  let coveredM = distanceMeters(points[progress.closestIndex], points[Math.min(progress.closestIndex + 1, points.length - 1)]);
  for (let index = progress.closestIndex + 2; index < points.length - 2 && coveredM < 900; index += 1) {
    coveredM += distanceMeters(points[index - 1], points[index]);
    if (coveredM < 35) continue;
    const before = bearingDegrees(points[Math.max(progress.closestIndex, index - 2)], points[index]);
    const after = bearingDegrees(points[index], points[Math.min(points.length - 1, index + 2)]);
    const turnAngle = ((after - before + 540) % 360) - 180;
    if (Math.abs(turnAngle) >= 38) {
      const turn = turnAngle > 0 ? 'right' : 'left';
      return {
        text: turn === 'right' ? 'Поверните направо' : 'Поверните налево',
        distanceM: Math.round(coveredM),
        turn,
      };
    }
  }
  return { text: 'Продолжайте прямо', distanceM: Math.min(Math.round(progress.remainingM), 900), turn: 'straight' };
}

function estimatedRideMinutes(route: CyclingRouteResult, distanceKm = route.distanceKm, elevationGainM = route.elevationGainM): number {
  const flatMinutes = distanceKm / 18 * 60;
  const climbingMinutes = elevationGainM / 600 * 60 * 0.55;
  return Math.max(1, Math.ceil(Math.max(route.durationMinutes * (distanceKm / Math.max(route.distanceKm, 0.01)), flatMinutes + climbingMinutes)));
}

function arrivalTime(minutes: number): string {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(Date.now() + minutes * 60_000));
}

function formatDistance(meters: number): string {
  return `${Math.max(0, Math.round(meters)).toLocaleString('ru-RU')} м`;
}

function MapViewport({ focus, route, recenterRequest, navigationActive }: {
  focus: RoutePoint | null;
  route: RoutePoint[];
  recenterRequest: { point: RoutePoint; id: number } | null;
  navigationActive: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (navigationActive) return;
    if (route.length > 1) {
      map.fitBounds(latLngBounds(route.map((point) => [point.lat, point.lng])), { padding: [48, 48], maxZoom: 16 });
    } else if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 14), { duration: 0.7 });
    }
  }, [focus, map, navigationActive, route]);
  useEffect(() => {
    if (recenterRequest && !navigationActive) {
      map.flyTo([recenterRequest.point.lat, recenterRequest.point.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
    }
  }, [map, navigationActive, recenterRequest]);
  return null;
}

function NavigationCamera({ active, rider }: { active: boolean; rider: RoutePoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (!active || !rider) return;
    map.invalidateSize();
    map.setView([rider.lat, rider.lng], 17, { animate: false });
  }, [active, map, rider]);
  return null;
}

function StartPicker({ enabled, onPick }: { enabled: boolean; onPick: (point: RoutePoint) => void }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function preferenceCopy(preference: CyclingRoutePreference): { title: string; description: string; icon: typeof Route } {
  return preference === 'recommended'
    ? { title: 'Лучший для велосипеда', description: 'Приоритет велодорожек и подходящих улиц', icon: ShieldCheck }
    : { title: 'Самый короткий', description: 'Минимальная дистанция по уличной сети', icon: Timer };
}

export function CityExploreMap() {
  const [, navigate] = useLocation();
  const restoredNavigation = useMemo(() => loadMapNavigation(), []);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [riderLocation, setRiderLocation] = useState<RoutePoint | null>(null);
  const [riderHeading, setRiderHeading] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null);
  const [routingOrigin, setRoutingOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<MapPlace | null>(() => restoredNavigation ? {
    id: restoredNavigation.id,
    name: restoredNavigation.destinationName,
    subtitle: restoredNavigation.destinationSubtitle,
    ...restoredNavigation.destination,
  } : null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedMapLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('Определяем твоё местоположение…');
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>(() => restoredNavigation ? [{
    preference: restoredNavigation.preference,
    result: restoredNavigation.result,
  }] : []);
  const [activePreference, setActivePreference] = useState<CyclingRoutePreference>(restoredNavigation?.preference ?? 'recommended');
  const [navigationSource, setNavigationSource] = useState<'search' | 'popular'>(restoredNavigation?.source ?? 'search');
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [navigationActive, setNavigationActive] = useState(restoredNavigation?.active ?? false);
  const [recenterRequest, setRecenterRequest] = useState<{ point: RoutePoint; id: number } | null>(null);
  const routeRequest = useRef(0);
  const hasCenteredOnRider = useRef(false);
  const lastAutoRerouteAt = useRef(0);
  const lastGpsPoint = useRef<RoutePoint | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  const activeRoute = useMemo(
    () => routeOptions.find((option) => option.preference === activePreference) ?? routeOptions[0] ?? null,
    [activePreference, routeOptions],
  );

  const progress = useMemo(
    () => activeRoute && riderLocation ? routeProgress(activeRoute.result.points, riderLocation) : null,
    [activeRoute, riderLocation],
  );

  const instruction = useMemo(
    () => activeRoute && progress ? nextNavigationInstruction(activeRoute.result.points, progress) : null,
    [activeRoute, progress],
  );

  const navigationRiderIcon = useMemo(() => divIcon({
    className: 'navigation-rider-marker',
    html: `<span aria-hidden="true" style="transform:rotate(${Math.round(riderHeading)}deg)">➤</span>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  }), [riderHeading]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Геолокация недоступна — нажми на карту, чтобы указать старт.');
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      const movedM = lastGpsPoint.current ? distanceMeters(lastGpsPoint.current, point) : 0;
      const gpsHeading = position.coords.heading;
      if (typeof gpsHeading === 'number' && Number.isFinite(gpsHeading)) {
        setRiderHeading(gpsHeading);
      } else if (lastGpsPoint.current && movedM > 2) {
        setRiderHeading(bearingDegrees(lastGpsPoint.current, point));
      }
      if (typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)) {
        setCurrentSpeedKmh(Math.max(0, position.coords.speed * 3.6));
      }
      lastGpsPoint.current = point;
      setRiderLocation(point);
      setLocationStatus(`GPS ±${Math.round(position.coords.accuracy)} м`);
      if (!hasCenteredOnRider.current) {
        hasCenteredOnRider.current = true;
        setRoutingOrigin((current) => current ?? point);
        void reverseMapLocation(point).then(setResolvedLocation).catch(() => undefined);
      }
    }, () => {
      setLocationStatus('Разреши геолокацию или нажми на карту, чтобы указать старт.');
    }, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 15000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!navigationActive) {
      if (wakeLock.current) void wakeLock.current.release().catch(() => undefined);
      wakeLock.current = null;
      return undefined;
    }
    const wakeLockNavigator = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    void wakeLockNavigator.wakeLock?.request('screen')
      .then((sentinel) => { wakeLock.current = sentinel; })
      .catch(() => undefined);
    return () => {
      if (wakeLock.current) void wakeLock.current.release().catch(() => undefined);
      wakeLock.current = null;
    };
  }, [navigationActive]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchMapPlaces(value, riderLocation, controller.signal)
        .then(setSearchResults)
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setSearchResults([]);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, riderLocation]);

  useEffect(() => {
    if (!navigationActive || !destination || !riderLocation || !progress) return;
    if (navigationSource === 'popular') return;
    if (progress.distanceFromRouteM < 55 || Date.now() - lastAutoRerouteAt.current < 15000) return;
    lastAutoRerouteAt.current = Date.now();
    setRoutingOrigin({ ...riderLocation });
  }, [destination, navigationActive, navigationSource, progress, riderLocation]);

  useEffect(() => {
    if (!activeRoute || !destination) return;
    saveMapNavigation({
      id: destination.id,
      destinationName: destination.name,
      destinationSubtitle: destination.subtitle,
      destination: { lat: destination.lat, lng: destination.lng },
      result: activeRoute.result,
      preference: activeRoute.preference,
      active: navigationActive,
      source: navigationSource,
      savedAt: new Date().toISOString(),
    });
  }, [activeRoute, destination, navigationActive, navigationSource]);

  useEffect(() => {
    const requestId = ++routeRequest.current;
    setRouteError('');
    if (navigationSource === 'popular' && routeOptions.length > 0) {
      setRouting(false);
      return;
    }
    if (!routingOrigin || !destination) {
      if (!destination) setRouteOptions([]);
      setRouting(false);
      return;
    }
    setRouting(true);
    const waypoints = [routingOrigin, { lat: destination.lat, lng: destination.lng }];
    void Promise.allSettled([
      routeCyclingWaypoints(waypoints, 'recommended'),
      routeCyclingWaypoints(waypoints, 'shortest'),
    ]).then((results) => {
      if (requestId !== routeRequest.current) return;
      const options = results.flatMap((result, index): RouteOption[] => result.status === 'fulfilled'
        ? [{ preference: index === 0 ? 'recommended' : 'shortest', result: result.value }]
        : []);
      if (!options.length) {
        setRouteError('Не удалось построить путь по улицам. Попробуй выбрать другой адрес.');
        return;
      }
      setRouteOptions(options);
      setActivePreference(options.some((option) => option.preference === 'recommended') ? 'recommended' : options[0].preference);
    }).finally(() => {
      if (requestId === routeRequest.current) setRouting(false);
    });
  }, [destination, navigationSource, routeOptions.length, routingOrigin]);

  function chooseDestination(place: MapPlace) {
    clearMapNavigation();
    setDestination(place);
    setNavigationSource('search');
    setNavigationActive(false);
    setRouteOptions([]);
    setQuery('');
    setSearchResults([]);
    if (riderLocation) {
      setRoutingOrigin(riderLocation);
      setRouteError('');
    } else {
      setRouteError('Сначала разреши геолокацию или нажми на карту, чтобы указать точку старта.');
    }
  }

  function chooseManualStart(point: RoutePoint) {
    if (riderLocation) return;
    setRiderLocation(point);
    setRoutingOrigin(point);
    setLocationStatus('Старт указан вручную');
    void reverseMapLocation(point).then(setResolvedLocation).catch(() => undefined);
  }

  function recenterOnRider() {
    if (!riderLocation) {
      setRouteError('Местоположение ещё не определено. Разреши доступ к геолокации.');
      return;
    }
    setRoutingOrigin(riderLocation);
    setRecenterRequest({ point: { ...riderLocation }, id: Date.now() });
  }

  function startNavigation() {
    if (!activeRoute || !riderLocation) return;
    setNavigationActive(true);
    setRoutingOrigin({ ...riderLocation });
  }

  function saveRoute() {
    if (!activeRoute || !routingOrigin || !destination) return;
    saveMapRouteDraft({
      title: `Маршрут до ${destination.name}`,
      region: resolvedLocation?.city || resolvedLocation?.country || '',
      waypoints: [routingOrigin, { lat: destination.lat, lng: destination.lng }],
      points: activeRoute.result.points,
      elevationGainM: activeRoute.result.elevationGainM,
    });
    navigate('/routes/new');
  }

  function resetRoute() {
    setNavigationActive(false);
    clearMapNavigation();
    setDestination(null);
    setRouteOptions([]);
    setRouteError('');
    setQuery('');
  }

  const focusPoint = destination ?? riderLocation;
  const visibleRoute = activeRoute?.result.points ?? [];
  const totalMinutes = activeRoute ? estimatedRideMinutes(activeRoute.result) : 0;
  const remainingRatio = activeRoute && progress
    ? Math.min(1, progress.remainingM / Math.max(activeRoute.result.distanceKm * 1000, 1))
    : 1;
  const remainingClimbM = activeRoute ? Math.round(activeRoute.result.elevationGainM * remainingRatio) : 0;
  const remainingMinutes = activeRoute && progress
    ? estimatedRideMinutes(activeRoute.result, progress.remainingM / 1000, remainingClimbM)
    : totalMinutes;

  const quickSearches = [
    { label: 'Кофе', query: 'кофейня', icon: Utensils },
    { label: 'Парки', query: 'парк', icon: Trees },
    { label: 'Интересные места', query: 'достопримечательность', icon: Landmark },
    { label: 'Веломастерские', query: 'веломастерская', icon: Wrench },
  ];

  return <section className={`city-explore global-city-map${navigationActive ? ' navigation-active' : ''}`}>
    <div className="city-map-layout global-map-layout">
      <div className="global-map-search">
        <div className="map-place-search">
          <Search size={19} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={destination ? 'Куда теперь?' : 'Куда поедем? Адрес или место'} aria-label="Поиск адреса или места" autoComplete="off" />
          {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={16} /></button>}
          {(searching || searchResults.length > 0) && <div className="map-search-results">
            {searching && <p>Сначала ищем рядом с тобой…</p>}
            {!searching && searchResults.map((place, index) => <button type="button" key={place.id} onClick={() => chooseDestination(place)}><MapPin size={16} /><span><strong>{place.name}{index === 0 && <em>Рядом</em>}</strong><small>{place.subtitle}</small></span></button>)}
          </div>}
        </div>
        <div className="rider-location-strip"><span><Bike size={17} /></span><div><strong>{resolvedLocation?.label || 'Твоё местоположение'}</strong><small>{locationStatus}</small></div><button type="button" onClick={recenterOnRider} aria-label="Показать моё местоположение"><LocateFixed size={18} /></button></div>
        {!destination && <div className="map-quick-searches">{quickSearches.map(({ label, query: quickQuery, icon: Icon }) => <button type="button" key={label} onClick={() => setQuery(quickQuery)}><Icon size={14} />{label}</button>)}</div>}
      </div>
      <div className="city-map-canvas global-map-canvas">
        <MapContainer center={[20, 0]} zoom={3} minZoom={2} maxZoom={18} zoomSnap={0.25} zoomDelta={0.5} wheelPxPerZoomLevel={180} touchZoom="center" scrollWheelZoom zoomControl={false} className="city-leaflet-map global-leaflet-map">
          <CommunityTileLayer />
          {!navigationActive && <ZoomControl position="bottomright" />}
          <StartPicker enabled={!riderLocation} onPick={chooseManualStart} />
          <MapViewport focus={focusPoint} route={visibleRoute} recenterRequest={recenterRequest} navigationActive={navigationActive} />
          <NavigationCamera active={navigationActive} rider={riderLocation} />
          {riderLocation && <Marker position={[riderLocation.lat, riderLocation.lng]} icon={navigationActive ? navigationRiderIcon : riderIcon} zIndexOffset={1000}><Popup>Твоё текущее местоположение</Popup></Marker>}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} zIndexOffset={900}><Popup><strong>{destination.name}</strong><br />{destination.subtitle}</Popup></Marker>}
          {routeOptions.map((option) => <Polyline key={option.preference} positions={option.result.points.map((point) => [point.lat, point.lng] as [number, number])} pathOptions={{ color: option.preference === 'recommended' ? '#1b8577' : '#6f5aa8', weight: activePreference === option.preference ? (navigationActive ? 9 : 7) : 4, opacity: activePreference === option.preference ? 0.95 : (navigationActive ? 0 : 0.45), lineCap: 'round', lineJoin: 'round' }} eventHandlers={{ click: () => !navigationActive && setActivePreference(option.preference) }} />)}
        </MapContainer>
        {!riderLocation && <div className="map-start-hint"><MapPin size={16} />Нажми на карту, чтобы указать старт</div>}

        {navigationActive && instruction && destination && <div className="navigation-instruction-card" role="status">
          <span className={`navigation-turn ${instruction.turn}`}><Navigation size={30} /></span>
          <div><strong>{instruction.text}</strong><small>{instruction.distanceM > 0 ? `через ${formatDistance(instruction.distanceM)}` : destination.name}</small></div>
        </div>}

        {navigationActive && activeRoute && progress && <div className="navigation-bottom-sheet">
          <div className="navigation-live-metrics">
            <span><strong>{formatDistance(progress.remainingM)}</strong><small>осталось</small></span>
            <span><strong>↑ {remainingClimbM} м</strong><small>подъём</small></span>
            <span><strong>{arrivalTime(remainingMinutes)}</strong><small>прибытие</small></span>
            <span><strong>{currentSpeedKmh === null ? '—' : currentSpeedKmh.toFixed(1)}</strong><small>км/ч</small></span>
          </div>
          {routing && <p className="navigation-rerouting"><RefreshCw size={14} />Перестраиваем маршрут по улицам…</p>}
          <button type="button" className="navigation-stop-button" onClick={() => setNavigationActive(false)}><Square size={15} />Завершить</button>
        </div>}
      </div>

      <aside className="city-map-panel global-route-panel">
        <div className="map-panel-heading"><span><Navigation size={19} /></span><div><p className="kicker">Маршрут по улицам</p><h2>{destination ? destination.name : 'Выбери место'}</h2></div>{destination && <button type="button" className="route-new-destination" onClick={resetRoute}><X size={17} /><span>Новый</span></button>}</div>
        {!destination ? <>
          <p className="map-panel-copy">Введи в поиск любой адрес, кафе, парк или достопримечательность. Поиск работает по всему миру, а карта открывается вокруг твоей позиции.</p>
          <div className="map-panel-tip"><Bike size={18} /><span><strong>Твоя позиция показана велосипедом</strong><small>При движении маркер обновляется по GPS.</small></span></div>
          <div className="map-panel-tip"><Route size={18} /><span><strong>Только реальные улицы</strong><small>Прямая линия не используется: оба варианта проходят по дорожной сети.</small></span></div>
        </> : <>
          <div className="route-addresses"><div><span className="route-address-marker start">A</span><p><small>Откуда</small><strong>{resolvedLocation?.label || 'Моё местоположение'}</strong></p></div><div><span className="route-address-marker finish">B</span><p><small>Куда</small><strong>{destination.name}</strong></p></div></div>
          {routing && <p className="route-build-status">Ищем два лучших пути по улицам…</p>}
          {routeError && <p className="form-note" role="alert">{routeError}</p>}
          {routeOptions.length > 0 && <div className="route-option-list">{routeOptions.map((option) => {
            const copy = preferenceCopy(option.preference);
            const Icon = copy.icon;
            const duration = estimatedRideMinutes(option.result);
            return <button type="button" className={activePreference === option.preference ? 'active' : ''} key={option.preference} onClick={() => setActivePreference(option.preference)}><Icon size={19} /><span><strong>{copy.title}</strong><small>{copy.description}</small></span><b>{formatDistance(option.result.distanceKm * 1000)}<small>≈ {duration} мин · ↑ {Math.round(option.result.elevationGainM)} м</small></b></button>;
          })}</div>}
          {activeRoute && <div className="route-navigation-summary">
            <span><Route size={17} /><small>Путь</small><strong>{formatDistance(activeRoute.result.distanceKm * 1000)}</strong></span>
            <span><Mountain size={17} /><small>Подъём</small><strong>{Math.round(activeRoute.result.elevationGainM)} м</strong></span>
            <span><Clock3 size={17} /><small>В дороге</small><strong>≈ {totalMinutes} мин</strong></span>
            <span><Gauge size={17} /><small>Прибытие</small><strong>{arrivalTime(totalMinutes)}</strong></span>
          </div>}
          <button type="button" className="start-navigation-button" disabled={!activeRoute || !riderLocation || routing} onClick={startNavigation}><Play size={19} fill="currentColor" />В путь</button>
          <div className="map-panel-actions global-route-actions"><button type="button" className="outline-inline-button" disabled={!riderLocation || routing} onClick={() => riderLocation && setRoutingOrigin({ ...riderLocation })}><RefreshCw size={16} />Перестроить</button><button type="button" className="signal-button" disabled={!activeRoute || routing} onClick={saveRoute}>Сохранить маршрут</button></div>
          <button type="button" className="quiet-button map-clear-route" onClick={resetRoute}>Выбрать другое место</button>
        </>}
      </aside>
    </div>
    <small className="map-attribution-note">Карта и адреса: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Веломаршруты: openrouteservice / BRouter.</small>
  </section>;
}
